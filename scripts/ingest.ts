// Ingestion pipeline for BallotCard.
// Run: npx tsx --env-file=.env.local scripts/ingest.ts
//
// Idempotent upserts keyed on external IDs. Every run is recorded in
// IngestionRuns so pages can show an honest "data as of" stamp.
// Sources: unitedstates/congress-legislators (YAML), Open States bulk people
// (CSV), and curated seeds in seed-data/.

import { db } from "./lib/supabase-client";
import {
  US_STATES,
  US_TERRITORIES,
  houseGeoSlug,
  houseDistrictName,
  senateSlug,
  senateClassLabel,
  senateNextElection,
  sldUpperSlug,
  sldLowerSlug,
  normDistrict,
} from "./lib/us-states";
import type {
  Legislator,
  GovernorEntry,
  MayorEntry,
  StatewideExecEntry,
  FederalExecEntry,
  OpenStatesPerson,
} from "./lib/types";
import { fetchOpenStatesPeople } from "./lib/openstates";
import { fetchFecCandidates, type FecCandidate } from "./lib/fec";
import {
  fetchFecElectionDates,
  earliestPrimaryByStateOffice,
} from "./lib/fec-dates";
import { fetchFecCandidateTotals } from "./lib/fec-totals";
import { parse as parseYaml } from "yaml";
import governors from "../seed-data/governors.json";
import mayors from "../seed-data/mayors.json";
import statewideExecs from "../seed-data/statewide-execs.json";
import federalExecs from "../seed-data/federal-execs.json";
import legislatureSchedule from "../seed-data/legislature-schedule.json";
import counties from "../seed-data/counties.json";

type CountyEntry = { state: string; fips: string; name: string; slug: string };

// Per-state legislative election schedule (term length + next general + whether
// the chamber is a staggered estimate). Indexed by "STATE::chamber".
type ChamberSchedule = {
  termYears: number;
  nextElection: string;
  estimated: boolean;
};
const LEG_SCHEDULE = new Map<string, ChamberSchedule>();
for (const row of legislatureSchedule.states) {
  LEG_SCHEDULE.set(`${row.state}::house`, row.house);
  LEG_SCHEDULE.set(`${row.state}::senate`, row.senate);
}
const legSchedule = (state: string, chamber: "house" | "senate") =>
  LEG_SCHEDULE.get(`${state}::${chamber}`);

const CONGRESS_URL =
  "https://raw.githubusercontent.com/unitedstates/congress-legislators/main/legislators-current.yaml";
const US_COUNTRY_ID = "00000000-0000-0000-0000-000000000001";

function log(phase: string, msg: string) {
  console.log(`[${phase}] ${msg}`);
}

const stateName = (abbr: string) =>
  US_STATES.find((s) => s.abbr === abbr)?.name ?? abbr;

const congressPhoto = (bioguide: string) =>
  `https://unitedstates.github.io/images/congress/450x550/${bioguide}.jpg`;

// Insert helper: chunked to stay within payload limits.
async function insertChunked(
  table: string,
  rows: Array<Record<string, unknown>>
) {
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    const { error } = await db.from(table).insert(chunk);
    if (error) throw new Error(`${table} insert failed at ${i}: ${error.message}`);
  }
}

// Paginated full-table read. Supabase caps a single SELECT at 1000 rows, so
// any "fetch everything" read (districts, offices, officials) MUST paginate or
// it silently drops rows — a subtle source of broken lookups.
async function selectAll<T = Record<string, unknown>>(
  table: string,
  columns: string,
  eq?: [string, unknown]
): Promise<T[]> {
  const PAGE = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    let query = db.from(table).select(columns);
    if (eq) query = query.eq(eq[0], eq[1]);
    const { data, error } = await query.range(from, from + PAGE - 1);
    if (error) throw new Error(`${table} select failed: ${error.message}`);
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

// ─── Source data (fetched once) ──────────────────────────────────────────────

type Sources = {
  legislators: Legislator[];
  openStatesByState: Map<string, OpenStatesPerson[]>;
};

async function fetchSources(): Promise<Sources> {
  log("fetch", "Fetching legislators-current.yaml...");
  const res = await fetch(CONGRESS_URL);
  if (!res.ok) throw new Error(`Congress fetch failed: ${res.status}`);
  const legislators: Legislator[] = parseYaml(await res.text());
  log("fetch", `Fetched ${legislators.length} members of Congress`);

  log("fetch", "Fetching Open States people for all states...");
  const openStatesByState = new Map<string, OpenStatesPerson[]>();
  let total = 0;
  // Sequential to be polite to the static host; the files are small.
  for (const s of US_STATES) {
    try {
      const people = await fetchOpenStatesPeople(s.abbr);
      openStatesByState.set(s.abbr, people);
      total += people.length;
    } catch (err) {
      log("fetch", `WARN: ${s.abbr} Open States fetch failed: ${(err as Error).message}`);
      openStatesByState.set(s.abbr, []);
    }
  }
  log("fetch", `Fetched ${total} state legislators across ${US_STATES.length} states`);

  return { legislators, openStatesByState };
}

// ─── Phase 1: Districts ──────────────────────────────────────────────────────

async function ingestDistricts(sources: Sources) {
  const existing = await selectAll<{ geo_slug: string }>("Districts", "geo_slug");
  const existingSlugs = new Set(existing.map((d) => d.geo_slug));

  // 1a. States
  const newStates = US_STATES.filter((s) => !existingSlugs.has(s.abbr.toLowerCase()));
  if (newStates.length > 0) {
    await insertChunked(
      "Districts",
      newStates.map((s) => ({
        name: s.name,
        kind: "state",
        state: s.abbr,
        parent_id: US_COUNTRY_ID,
        geo_slug: s.abbr.toLowerCase(),
        external_refs: { census_fips: s.fips },
      }))
    );
    log("districts", `Inserted ${newStates.length} state districts`);
  }

  // 1a-bis. Territories with non-voting House representation.
  const newTerritories = US_TERRITORIES.filter(
    (t) => !existingSlugs.has(t.abbr.toLowerCase())
  );
  if (newTerritories.length > 0) {
    await insertChunked(
      "Districts",
      newTerritories.map((t) => ({
        name: t.name,
        kind: "territory",
        state: t.abbr,
        parent_id: US_COUNTRY_ID,
        geo_slug: t.abbr.toLowerCase(),
        external_refs: { census_fips: t.fips },
      }))
    );
    log("districts", `Inserted ${newTerritories.length} territory districts`);
  }

  // refresh map
  let all = await selectAll<{ id: string; geo_slug: string }>("Districts", "id, geo_slug");
  let slugToId = new Map(all.map((d) => [d.geo_slug, d.id]));

  // 1b. US House districts
  const houseDistricts: Array<Record<string, unknown>> = [];
  for (const s of US_STATES) {
    const stateId = slugToId.get(s.abbr.toLowerCase());
    if (!stateId) continue;
    for (let d = 1; d <= s.houseSeats; d++) {
      const slug = houseGeoSlug(s.abbr, d, s.houseSeats);
      if (existingSlugs.has(slug)) continue;
      houseDistricts.push({
        name: `${houseDistrictName(s.abbr, d, s.houseSeats)} (US House)`,
        kind: "us_house",
        state: s.abbr,
        parent_id: stateId,
        geo_slug: slug,
      });
    }
  }
  if (houseDistricts.length > 0) {
    await insertChunked("Districts", houseDistricts);
    log("districts", `Inserted ${houseDistricts.length} US House districts`);
  }

  // 1c. State legislative districts (derived from Open States people)
  const sldDistricts: Array<Record<string, unknown>> = [];
  const seenSld = new Set<string>();
  for (const s of US_STATES) {
    const stateId = slugToId.get(s.abbr.toLowerCase());
    if (!stateId) continue;
    for (const p of sources.openStatesByState.get(s.abbr) ?? []) {
      if (!p.current_district) continue;
      const slug =
        p.current_chamber === "upper"
          ? sldUpperSlug(s.abbr, p.current_district)
          : sldLowerSlug(s.abbr, p.current_district);
      if (existingSlugs.has(slug) || seenSld.has(slug)) continue;
      seenSld.add(slug);
      const chamberWord = p.current_chamber === "upper" ? "Senate" : "House";
      sldDistricts.push({
        name: `${s.abbr} State ${chamberWord} District ${normDistrict(p.current_district)}`,
        kind: p.current_chamber === "upper" ? "state_senate" : "state_house",
        state: s.abbr,
        parent_id: stateId,
        geo_slug: slug,
      });
    }
  }
  if (sldDistricts.length > 0) {
    await insertChunked("Districts", sldDistricts);
    log("districts", `Inserted ${sldDistricts.length} state legislative districts`);
  }

  // 1c-bis. Counties (50 states + DC, from Census ANSI national_county2020).
  // These power the per-county "sample ballot in [X] county" sub-pages. No
  // county-level offices are seeded yet (no national source for sheriffs /
  // commissioners / etc.); the district rows exist so the catchall route
  // resolves the slug and the page renders federal + statewide offices
  // aggregated upward plus an honest "address for exact districts" CTA.
  const newCounties: Array<Record<string, unknown>> = [];
  for (const c of counties as CountyEntry[]) {
    if (existingSlugs.has(c.slug)) continue;
    const stateId = slugToId.get(c.state.toLowerCase());
    if (!stateId) continue;
    newCounties.push({
      name: c.name,
      kind: "county",
      state: c.state,
      parent_id: stateId,
      geo_slug: c.slug,
      external_refs: { census_fips: c.fips },
    });
  }
  if (newCounties.length > 0) {
    await insertChunked("Districts", newCounties);
    log("districts", `Inserted ${newCounties.length} county districts`);
  }

  // 1d. Municipalities for mayors
  all = await selectAll<{ id: string; geo_slug: string }>("Districts", "id, geo_slug");
  slugToId = new Map(all.map((d) => [d.geo_slug, d.id]));
  const newMunis: Array<Record<string, unknown>> = [];
  for (const m of mayors as MayorEntry[]) {
    if (slugToId.has(m.geoSlug)) continue;
    const stateId = slugToId.get(m.state.toLowerCase());
    if (!stateId) continue;
    newMunis.push({
      name: m.cityName,
      kind: "municipality",
      state: m.state,
      parent_id: stateId,
      geo_slug: m.geoSlug,
    });
  }
  if (newMunis.length > 0) {
    await insertChunked("Districts", newMunis);
    log("districts", `Inserted ${newMunis.length} municipality districts`);
  }

  const { count } = await db
    .from("Districts")
    .select("*", { count: "exact", head: true });
  log("districts", `Total districts: ${count}`);
}

// ─── Phase 2: Offices ────────────────────────────────────────────────────────

async function ingestOffices(sources: Sources) {
  const districts = await selectAll<{ id: string; geo_slug: string }>(
    "Districts",
    "id, geo_slug"
  );
  const slugToId = new Map(districts.map((d) => [d.geo_slug, d.id]));

  const existingOffices = await selectAll<{ district_id: string; slug: string }>(
    "Offices",
    "district_id, slug"
  );
  const existingSet = new Set(
    existingOffices.map((o) => `${o.district_id}::${o.slug}`)
  );
  const isNew = (districtId: string, slug: string) =>
    !existingSet.has(`${districtId}::${slug}`);

  const toInsert: Array<Record<string, unknown>> = [];

  // 2a. President + Vice President (national)
  for (const e of federalExecs as FederalExecEntry[]) {
    if (!isNew(US_COUNTRY_ID, e.office)) continue;
    toInsert.push({
      district_id: US_COUNTRY_ID,
      title: e.title,
      slug: e.office,
      kind: "executive",
      branch: "executive",
      level: "federal",
      selection_method: "elected_partisan",
      term_years: e.termYears,
      next_election_at: e.nextElection,
      is_seeded: true,
    });
  }

  // 2b. US House
  for (const s of US_STATES) {
    for (let d = 1; d <= s.houseSeats; d++) {
      const districtId = slugToId.get(houseGeoSlug(s.abbr, d, s.houseSeats));
      if (!districtId || !isNew(districtId, "us-house")) continue;
      toInsert.push({
        district_id: districtId,
        title: `US House, ${houseDistrictName(s.abbr, d, s.houseSeats)}`,
        slug: "us-house",
        kind: "legislative",
        branch: "legislative",
        level: "federal",
        selection_method: "elected_partisan",
        term_years: 2,
        next_election_at: "2026-11-03",
        is_seeded: true,
      });
    }
  }

  // 2b-bis. US House non-voting delegates (DC, GU, VI, AS, MP) +
  //         resident commissioner (PR). These ride alongside voting House
  //         seats but live directly under the territory district.
  for (const t of US_TERRITORIES) {
    const territoryId = slugToId.get(t.abbr.toLowerCase());
    if (!territoryId || !isNew(territoryId, "us-house")) continue;
    const isPR = t.delegateKind === "resident_commissioner";
    toInsert.push({
      district_id: territoryId,
      title: isPR
        ? `Resident Commissioner of ${t.name}`
        : `US House Delegate, ${t.name}`,
      slug: "us-house",
      kind: "legislative",
      branch: "legislative",
      level: "federal",
      selection_method: "elected_partisan",
      term_years: isPR ? 4 : 2,
      next_election_at: isPR ? "2028-11-07" : "2026-11-03",
      description: isPR
        ? "Non-voting member of the US House; 4-year term."
        : "Non-voting member of the US House; 2-year term.",
      is_seeded: true,
    });
  }

  // 2c. US Senate
  for (const s of US_STATES) {
    const stateId = slugToId.get(s.abbr.toLowerCase());
    if (!stateId) continue;
    for (const cls of s.senateClasses) {
      const slug = senateSlug(cls);
      if (!isNew(stateId, slug)) continue;
      toInsert.push({
        district_id: stateId,
        title: `US Senate, ${s.name}`,
        slug,
        kind: "legislative",
        branch: "legislative",
        level: "federal",
        selection_method: "elected_partisan",
        seat_label: `Class ${senateClassLabel(cls)}`,
        term_years: 6,
        next_election_at: senateNextElection(cls),
        is_seeded: true,
      });
    }
  }

  // 2d. Governors
  for (const g of governors as GovernorEntry[]) {
    const stateId = slugToId.get(g.state.toLowerCase());
    if (!stateId || !isNew(stateId, "governor")) continue;
    toInsert.push({
      district_id: stateId,
      title: `Governor of ${stateName(g.state)}`,
      slug: "governor",
      kind: "executive",
      branch: "executive",
      level: "state",
      selection_method: "elected_partisan",
      term_years: g.termYears,
      next_election_at: g.nextElection,
      is_seeded: true,
    });
  }

  // 2e. Statewide executives (Lt. Gov, AG, SoS, Treasurer)
  for (const e of statewideExecs as StatewideExecEntry[]) {
    const stateId = slugToId.get(e.state.toLowerCase());
    const slug = e.office.replace(/_/g, "-");
    if (!stateId || !isNew(stateId, slug)) continue;
    toInsert.push({
      district_id: stateId,
      title: `${e.title} of ${stateName(e.state)}`,
      slug,
      kind: "executive",
      branch: "executive",
      level: "state",
      selection_method: e.selection,
      description: e.selectionDetail,
      next_election_at: e.nextElection,
      is_seeded: true,
    });
  }

  // 2f. State legislators (one office per district)
  const seenSld = new Set<string>();
  for (const s of US_STATES) {
    for (const p of sources.openStatesByState.get(s.abbr) ?? []) {
      if (!p.current_district) continue;
      const slug = p.current_chamber === "upper" ? "state-senate" : "state-house";
      const geoSlug =
        p.current_chamber === "upper"
          ? sldUpperSlug(s.abbr, p.current_district)
          : sldLowerSlug(s.abbr, p.current_district);
      const districtId = slugToId.get(geoSlug);
      if (!districtId) continue;
      const dedupe = `${districtId}::${slug}`;
      if (seenSld.has(dedupe) || !isNew(districtId, slug)) continue;
      seenSld.add(dedupe);
      const chamberWord = p.current_chamber === "upper" ? "Senate" : "House";
      const sched = legSchedule(
        s.abbr,
        p.current_chamber === "upper" ? "senate" : "house"
      );
      toInsert.push({
        district_id: districtId,
        title: `${s.abbr} State ${chamberWord}, District ${normDistrict(p.current_district)}`,
        slug,
        kind: "legislative",
        branch: "legislative",
        level: "state",
        selection_method: "elected_partisan",
        term_years: sched?.termYears ?? (p.current_chamber === "upper" ? 4 : 2),
        next_election_at: sched?.nextElection ?? "2026-11-03",
        next_election_estimated: sched?.estimated ?? false,
        is_seeded: true,
      });
    }
  }

  // 2g. Mayors
  for (const m of mayors as MayorEntry[]) {
    const districtId = slugToId.get(m.geoSlug);
    if (!districtId || !isNew(districtId, "mayor")) continue;
    toInsert.push({
      district_id: districtId,
      title: `Mayor of ${m.cityName}`,
      slug: "mayor",
      kind: "executive",
      branch: "executive",
      level: "municipal",
      selection_method: "elected_nonpartisan",
      term_years: m.termYears,
      next_election_at: m.nextElection,
      is_seeded: true,
    });
  }

  if (toInsert.length > 0) {
    await insertChunked("Offices", toInsert);
    log("offices", `Inserted ${toInsert.length} offices`);
  }

  const { count } = await db
    .from("Offices")
    .select("*", { count: "exact", head: true });
  log("offices", `Total offices: ${count}`);
}

// ─── Phase 3: Officials ──────────────────────────────────────────────────────

async function ingestOfficials(sources: Sources) {
  const offices = await selectAll<{ id: string; slug: string; district_id: string }>(
    "Offices",
    "id, slug, district_id"
  );
  const districts = await selectAll<{ id: string; geo_slug: string }>(
    "Districts",
    "id, geo_slug"
  );
  const districtIdToSlug = new Map(districts.map((d) => [d.id, d.geo_slug]));
  const key = (geoSlug: string, officeSlug: string) => `${geoSlug}::${officeSlug}`;
  const officeMap = new Map(
    offices.map((o) => [
      key(districtIdToSlug.get(o.district_id) ?? "", o.slug),
      o.id,
    ])
  );

  // Existing current officials, keyed by office.
  type Existing = {
    id: string;
    office_id: string;
    name: string;
    party: string | null;
    external_refs: Record<string, string> | null;
  };
  const existingOfficials = await selectAll<Existing>(
    "Officials",
    "id, office_id, name, party, external_refs",
    ["is_current", true]
  );
  const currentByOffice = new Map<string, Existing>(
    existingOfficials.map((o) => [o.office_id, o])
  );

  const toInsert: Array<Record<string, unknown>> = [];
  const toUpdate: Array<{ id: string; row: Record<string, unknown> }> = [];
  let skipped = 0;

  // Authoritative upsert of the current officeholder: insert when the seat is
  // empty, update in place when the source disagrees with what we have (fixes
  // stale records and absorbs mid-term replacements), otherwise skip.
  const place = (oid: string | undefined, row: Record<string, unknown>) => {
    if (!oid) return false;
    const existing = currentByOffice.get(oid);
    if (existing) {
      if (existing.id === "pending") return false; // already placed this run
      const sameName = existing.name === row.name;
      const sameParty = (existing.party ?? null) === ((row.party as string) ?? null);
      if (!sameName || !sameParty) {
        const mergedRefs = {
          ...(existing.external_refs ?? {}),
          ...((row.external_refs as Record<string, string>) ?? {}),
        };
        toUpdate.push({ id: existing.id, row: { ...row, external_refs: mergedRefs } });
      } else {
        skipped++;
      }
      return false;
    }
    toInsert.push({ office_id: oid, is_current: true, ...row });
    // Guard against two source rows targeting the same office in one run.
    currentByOffice.set(oid, {
      id: "pending",
      office_id: oid,
      name: row.name as string,
      party: (row.party as string) ?? null,
      external_refs: {},
    });
    return true;
  };

  // 3.pre. Federal execs (President, VP)
  for (const e of federalExecs as FederalExecEntry[]) {
    const refs: Record<string, string> = {};
    if (e.wikipedia) refs.wikipedia = e.wikipedia;
    if (e.ballotpedia) refs.ballotpedia = e.ballotpedia;
    place(officeMap.get(key("us", e.office)), {
      name: e.name,
      party: e.party,
      term_start: e.termStart,
      term_end: e.termEnd,
      first_took_office: e.firstTookOffice,
      photo_url: e.photoUrl ?? undefined,
      external_refs: refs,
    });
  }

  // 3a. Congress
  for (const leg of sources.legislators) {
    const term = leg.terms[leg.terms.length - 1];
    if (!term) continue;
    let geoSlug: string;
    let officeSlug: string;
    if (term.type === "rep") {
      const sd = US_STATES.find((s) => s.abbr === term.state);
      const td = US_TERRITORIES.find((t) => t.abbr === term.state);
      if (sd) {
        const dist = term.district ?? 0;
        geoSlug = houseGeoSlug(term.state, dist === 0 ? 1 : dist, sd.houseSeats);
        officeSlug = "us-house";
      } else if (td) {
        // Territories have one delegate (or resident commissioner) per
        // territory; the district is the territory itself, not a numbered seat.
        geoSlug = td.abbr.toLowerCase();
        officeSlug = "us-house";
      } else {
        continue;
      }
    } else {
      geoSlug = term.state.toLowerCase();
      officeSlug = senateSlug(term.class ?? 1);
    }
    const oid = officeMap.get(key(geoSlug, officeSlug));
    const bioguide = leg.id.bioguide;
    place(oid, {
      name: leg.name.official_full ?? `${leg.name.first} ${leg.name.last}`,
      party: term.party,
      term_start: term.start,
      term_end: term.end,
      photo_url: congressPhoto(bioguide),
      external_refs: {
        bioguide,
        ...(leg.id.fec?.length ? { fec: leg.id.fec[0] } : {}),
        ...(term.url ? { official_site: term.url } : {}),
      },
    });
  }
  log("officials", `Congress queued (running total ${toInsert.length})`);

  // 3b. Governors
  for (const g of governors as GovernorEntry[]) {
    place(officeMap.get(key(g.state.toLowerCase(), "governor")), {
      name: g.name,
      party: g.party,
      term_start: g.termStart,
      term_end: g.termEnd,
      external_refs: g.ballotpedia ? { ballotpedia: g.ballotpedia } : {},
    });
  }

  // 3c. Statewide execs
  for (const e of statewideExecs as StatewideExecEntry[]) {
    const slug = e.office.replace(/_/g, "-");
    const tookOffice = e.tookOffice
      ? /^\d{4}$/.test(e.tookOffice)
        ? `${e.tookOffice}-01-01`
        : e.tookOffice
      : null;
    place(officeMap.get(key(e.state.toLowerCase(), slug)), {
      name: e.name,
      party: e.party ?? undefined,
      first_took_office: tookOffice,
      external_refs: {},
    });
  }

  // 3d. State legislators
  for (const s of US_STATES) {
    for (const p of sources.openStatesByState.get(s.abbr) ?? []) {
      if (!p.current_district) continue;
      const officeSlug = p.current_chamber === "upper" ? "state-senate" : "state-house";
      const geoSlug =
        p.current_chamber === "upper"
          ? sldUpperSlug(s.abbr, p.current_district)
          : sldLowerSlug(s.abbr, p.current_district);
      const osId = p.id.replace("ocd-person/", "");
      place(officeMap.get(key(geoSlug, officeSlug)), {
        name: p.name,
        party: p.current_party || undefined,
        photo_url: p.image || undefined,
        external_refs: { openstates: osId },
      });
    }
  }

  // 3e. Mayors
  for (const m of mayors as MayorEntry[]) {
    place(officeMap.get(key(m.geoSlug, "mayor")), {
      name: m.name,
      party: m.party,
      term_start: m.termStart,
      term_end: m.termEnd,
      external_refs: m.ballotpedia ? { ballotpedia: m.ballotpedia } : {},
    });
  }

  if (toInsert.length > 0) {
    await insertChunked("Officials", toInsert);
  }
  for (const u of toUpdate) {
    const { error } = await db.from("Officials").update(u.row).eq("id", u.id);
    if (error) throw new Error(`Official update failed: ${error.message}`);
  }
  log(
    "officials",
    `Inserted ${toInsert.length}, updated ${toUpdate.length}, skipped ${skipped} existing`
  );

  const { count } = await db
    .from("Officials")
    .select("*", { count: "exact", head: true })
    .eq("is_current", true);
  log("officials", `Total current officials: ${count}`);
}

// ─── Phase 4: Candidates (FEC, federal only) ─────────────────────────────────

async function ingestCandidates(): Promise<number> {
  const apiKey = process.env.FEC_API_KEY;
  if (!apiKey) {
    log("candidates", "FEC_API_KEY not set — skipping candidate ingestion");
    return 0;
  }

  // Federal offices, with the district geo_slug + election year for mapping.
  const offices = await selectAll<{
    id: string;
    slug: string;
    district_id: string;
    next_election_at: string | null;
  }>("Offices", "id, slug, district_id, next_election_at");
  const districts = await selectAll<{ id: string; geo_slug: string }>(
    "Districts",
    "id, geo_slug"
  );
  const districtIdToSlug = new Map(districts.map((d) => [d.id, d.geo_slug]));
  const electionYear = (o: { next_election_at: string | null }) =>
    o.next_election_at ? Number(o.next_election_at.slice(0, 4)) : null;

  // House: geo_slug (nc/07) → office. Senate: state geo_slug + year → office.
  const houseByGeo = new Map<string, (typeof offices)[number]>();
  const senateByStateYear = new Map<string, (typeof offices)[number]>();
  let presidentOffice: (typeof offices)[number] | undefined;
  for (const o of offices) {
    const geo = districtIdToSlug.get(o.district_id) ?? "";
    if (o.slug === "us-house") houseByGeo.set(geo, o);
    else if (o.slug.startsWith("us-senate-class-"))
      senateByStateYear.set(`${geo}::${electionYear(o)}`, o);
    else if (o.slug === "president") presidentOffice = o;
  }

  // Pull the cycles our seats actually face (House 2026, Senate 2026/2028,
  // President 2028). Skip 2030 Senate — too early for meaningful filings.
  const fetches: Array<["P" | "S" | "H", number]> = [
    ["H", 2026],
    ["S", 2026],
    ["S", 2028],
    ["P", 2028],
  ];

  const rows: Array<Record<string, unknown>> = [];
  const cyclesTouched = new Set<number>();

  // Per-candidate money totals indexed by FEC ID. Bulk-fetched per (office,
  // cycle) so 3,000+ candidates take ~30 paginated calls instead of 3,000.
  type Totals = { receipts: number; disbursements: number; coverage_end_date?: string };
  const totalsById = new Map<string, Totals>();

  for (const [office, cycle] of fetches) {
    let fec: FecCandidate[];
    try {
      fec = await fetchFecCandidates(office, cycle, apiKey);
    } catch (err) {
      log("candidates", `WARN: ${office}/${cycle} — ${(err as Error).message}`);
      continue;
    }
    cyclesTouched.add(cycle);
    log("candidates", `FEC ${office}/${cycle}: ${fec.length} candidates`);

    // Pull aggregate totals for this office × cycle in bulk.
    try {
      const totals = await fetchFecCandidateTotals(office, cycle, apiKey);
      for (const t of totals) {
        totalsById.set(`${t.candidateId}::${cycle}`, {
          receipts: t.receipts,
          disbursements: t.disbursements,
          coverage_end_date: t.coverageEndDate,
        });
      }
      log("candidates", `FEC ${office}/${cycle} totals: ${totals.length}`);
    } catch (err) {
      log("candidates", `WARN: ${office}/${cycle} totals — ${(err as Error).message}`);
    }

    for (const c of fec) {
      let office_id: string | undefined;
      if (c.office === "H" && c.district) {
        const sd = US_STATES.find((s) => s.abbr === c.state);
        if (!sd) continue;
        const geo =
          c.district === "al"
            ? `${c.state.toLowerCase()}/al`
            : houseGeoSlug(c.state, Number(c.district), sd.houseSeats);
        office_id = houseByGeo.get(geo)?.id;
      } else if (c.office === "S") {
        office_id = senateByStateYear.get(`${c.state.toLowerCase()}::${cycle}`)?.id;
      } else if (c.office === "P") {
        office_id = presidentOffice?.id;
      }
      if (!office_id) continue;

      const target = offices.find((o) => o.id === office_id);
      const totals = totalsById.get(`${c.candidateId}::${cycle}`);
      rows.push({
        office_id,
        name: c.name,
        party: c.party,
        cycle,
        election_date: target?.next_election_at ?? null,
        is_incumbent: c.isIncumbent,
        status: c.status,
        source: "fec",
        external_refs: { fec_candidate_id: c.candidateId },
        fec_totals: totals ?? null,
      });
    }
  }

  // Dedupe on the table's unique key (office_id, cycle, name) — FEC can list a
  // person under multiple committee records, and rarely two people share a name
  // in one race (keep the first, preferring an incumbent flag).
  const deduped = new Map<string, Record<string, unknown>>();
  for (const r of rows) {
    const key = `${r.office_id}::${r.cycle}::${r.name}`;
    const existing = deduped.get(key);
    if (!existing) deduped.set(key, r);
    else if (r.is_incumbent && !existing.is_incumbent) deduped.set(key, r);
  }
  const finalRows = [...deduped.values()];

  // Idempotent refresh: clear the FEC rows for the cycles we re-fetched, then
  // insert fresh (handles candidates who dropped out since the last run).
  for (const cycle of cyclesTouched) {
    await db.from("Candidates").delete().eq("source", "fec").eq("cycle", cycle);
  }
  if (finalRows.length > 0) await insertChunked("Candidates", finalRows);
  log("candidates", `Inserted ${finalRows.length} federal candidates`);
  return finalRows.length;
}

// ─── Phase 5: Primary election dates (FEC) ───────────────────────────────────

async function ingestPrimaryDates(): Promise<number> {
  const apiKey = process.env.FEC_API_KEY;
  if (!apiKey) {
    log("primaries", "FEC_API_KEY not set — skipping primary date ingestion");
    return 0;
  }

  // 2026: House (all states) + Senate (Class II). 2028 primary calendar isn't
  // populated by FEC this far out; reattempt next year.
  const dates2026 = await fetchFecElectionDates(2026, apiKey);
  log("primaries", `FEC 2026 election dates: ${dates2026.length} entries`);
  const byKey = earliestPrimaryByStateOffice(dates2026);

  const offices = await selectAll<{
    id: string;
    slug: string;
    district_id: string;
    next_election_at: string | null;
  }>("Offices", "id, slug, district_id, next_election_at");
  const districts = await selectAll<{ id: string; geo_slug: string; state: string | null }>(
    "Districts",
    "id, geo_slug, state"
  );
  const districtStateById = new Map(districts.map((d) => [d.id, d.state]));

  // For each federal office with a 2026 next election, find the matching
  // (state, office_type) primary date and queue an update.
  let queued = 0;
  for (const o of offices) {
    if (!o.next_election_at?.startsWith("2026")) continue;
    let officeType: "H" | "S" | null = null;
    if (o.slug === "us-house") officeType = "H";
    else if (o.slug.startsWith("us-senate-class-")) officeType = "S";
    if (!officeType) continue;

    const state = districtStateById.get(o.district_id);
    if (!state) continue;
    const primary = byKey.get(`${state}::${officeType}`);
    if (!primary) continue;

    // Update only when changed (avoids no-op writes).
    const { error } = await db
      .from("Offices")
      .update({ primary_election_at: primary })
      .eq("id", o.id);
    if (!error) queued++;
  }
  log("primaries", `Updated primary_election_at on ${queued} offices`);
  return queued;
}

// ─── Phase 6: Legislature schedule (term + next election + staggered) ─────────
// Idempotent: brings every state-house/state-senate office in line with the
// curated per-state schedule. Most state senates are 4-year staggered, so the
// flat "2026 for everything" default is wrong for off-cycle states (LA/MS/NJ/VA
// → 2027, KS/NM/SC senate → 2028) and imprecise for staggered ones (estimated).
async function applyLegislatureSchedule(): Promise<number> {
  const offices = await selectAll<{ id: string; slug: string; district_id: string }>(
    "Offices",
    "id, slug, district_id"
  );
  const districts = await selectAll<{ id: string; state: string | null }>(
    "Districts",
    "id, state"
  );
  const stateByDistrict = new Map(districts.map((d) => [d.id, d.state]));

  let updated = 0;
  for (const o of offices) {
    const chamber =
      o.slug === "state-senate" ? "senate" : o.slug === "state-house" ? "house" : null;
    if (!chamber) continue;
    const state = stateByDistrict.get(o.district_id);
    if (!state) continue;
    const sched = legSchedule(state, chamber);
    if (!sched) continue;
    const { error } = await db
      .from("Offices")
      .update({
        term_years: sched.termYears,
        next_election_at: sched.nextElection,
        next_election_estimated: sched.estimated,
      })
      .eq("id", o.id);
    if (!error) updated++;
  }
  log("schedule", `Applied legislature schedule to ${updated} offices`);
  return updated;
}

// ─── Cache revalidation hook ─────────────────────────────────────────────────
// Tells the running Next app to flush its Full Route Cache for the catchall
// permalink route + homepage + sitemap. Configure SITE_URL and REVALIDATE_SECRET
// (both env vars) in production; both are optional locally.

async function revalidateLiveSite(): Promise<void> {
  const siteUrl = process.env.SITE_URL;
  const secret = process.env.REVALIDATE_SECRET;
  if (!siteUrl || !secret) {
    log("revalidate", "Skipped (SITE_URL or REVALIDATE_SECRET not set)");
    return;
  }
  try {
    const res = await fetch(`${siteUrl.replace(/\/+$/, "")}/api/revalidate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      log("revalidate", `Webhook returned ${res.status}`);
      return;
    }
    log("revalidate", "Flushed ISR cache");
  } catch (err) {
    // Non-fatal: ingestion succeeded; pages will revalidate on their next tick.
    log("revalidate", `Webhook failed: ${(err as Error).message}`);
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== BallotCard Ingestion Pipeline ===\n");
  const start = Date.now();

  // Open a run record for the "data as of" stamp.
  const { data: run } = await db
    .from("IngestionRuns")
    .insert({ source: "full", status: "running" })
    .select("id")
    .single();
  const runId = run?.id as string | undefined;

  try {
    const sources = await fetchSources();
    console.log();
    await ingestDistricts(sources);
    console.log();
    await ingestOffices(sources);
    console.log();
    await ingestOfficials(sources);
    console.log();
    await applyLegislatureSchedule();
    console.log();
    const candidates = await ingestCandidates();
    console.log();
    await ingestPrimaryDates();

    if (runId) {
      const [{ count: districts }, { count: offices }, { count: officials }] =
        await Promise.all([
          db.from("Districts").select("*", { count: "exact", head: true }),
          db.from("Offices").select("*", { count: "exact", head: true }),
          db
            .from("Officials")
            .select("*", { count: "exact", head: true })
            .eq("is_current", true),
        ]);
      await db
        .from("IngestionRuns")
        .update({
          status: "succeeded",
          finished_at: new Date().toISOString(),
          counts: { districts, offices, officials, candidates },
        })
        .eq("id", runId);
    }

  } catch (err) {
    console.error("\n❌ Ingestion failed:", err);
    if (runId) {
      await db
        .from("IngestionRuns")
        .update({
          status: "failed",
          finished_at: new Date().toISOString(),
          error: (err as Error).message,
        })
        .eq("id", runId);
    }
    // Partial-failure runs (e.g. FEC rate-limit on a late phase) still wrote
    // useful data — flush the cache anyway, then re-throw so the exit code
    // reflects the underlying failure.
    await revalidateLiveSite();
    process.exit(1);
  }

  // Happy-path flush — covered by the catch's flush too via the finally pattern
  // would be cleaner, but exit(1) inside catch makes finally unreachable here.
  await revalidateLiveSite();

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n=== Done in ${elapsed}s ===`);
}

main();
