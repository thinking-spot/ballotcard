// Ingestion pipeline for BallotCard seeded tier.
// Run: npx tsx --env-file=.env.local scripts/ingest.ts

import { db } from "./lib/supabase-client";
import { US_STATES, houseGeoSlug, houseDistrictName, senateSlug, senateClassLabel, senateNextElection } from "./lib/us-states";
import type { Legislator, GovernorEntry, MayorEntry } from "./lib/types";
import { parse as parseYaml } from "yaml";
import governors from "../seed-data/governors.json";
import mayors from "../seed-data/mayors.json";

const CONGRESS_URL = "https://raw.githubusercontent.com/unitedstates/congress-legislators/main/legislators-current.yaml";
const US_COUNTRY_ID = "00000000-0000-0000-0000-000000000001";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function log(phase: string, msg: string) {
  console.log(`[${phase}] ${msg}`);
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ─── Phase 1: Districts ──────────────────────────────────────────────────────

async function ingestDistricts() {
  log("districts", "Fetching existing districts...");
  const { data: existing } = await db.from("Districts").select("geo_slug");
  const existingSlugs = new Set((existing ?? []).map((d) => d.geo_slug));

  // 1a. State districts
  const newStates = US_STATES.filter((s) => !existingSlugs.has(s.abbr.toLowerCase()));
  if (newStates.length > 0) {
    const stateRows = newStates.map((s) => ({
      name: s.name,
      kind: "state",
      state: s.abbr,
      parent_id: US_COUNTRY_ID,
      geo_slug: s.abbr.toLowerCase(),
      external_refs: { census_fips: s.fips },
    }));
    const { error } = await db.from("Districts").insert(stateRows);
    if (error) throw new Error(`State insert failed: ${error.message}`);
    log("districts", `Inserted ${newStates.length} state districts`);
  } else {
    log("districts", "All 50 state districts exist");
  }

  // Refresh slug→id map after state inserts
  const { data: allDistricts } = await db.from("Districts").select("id, geo_slug");
  const slugToId = new Map((allDistricts ?? []).map((d) => [d.geo_slug, d.id]));

  // 1b. US House districts
  const houseDistricts: Array<{
    name: string;
    kind: string;
    state: string;
    parent_id: string;
    geo_slug: string;
  }> = [];
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
    // Insert in chunks of 200 to stay within Supabase limits
    for (let i = 0; i < houseDistricts.length; i += 200) {
      const chunk = houseDistricts.slice(i, i + 200);
      const { error } = await db.from("Districts").insert(chunk);
      if (error) throw new Error(`House district insert failed: ${error.message}`);
    }
    log("districts", `Inserted ${houseDistricts.length} US House districts`);
  } else {
    log("districts", "All 435 House districts exist");
  }

  // 1c. Municipality districts for mayors
  // Re-fetch slugToId after house inserts
  const { data: refreshed } = await db.from("Districts").select("id, geo_slug");
  const slugToIdFull = new Map((refreshed ?? []).map((d) => [d.geo_slug, d.id]));

  const mayorEntries = mayors as MayorEntry[];
  const newMunis: Array<{
    name: string;
    kind: string;
    state: string;
    parent_id: string;
    geo_slug: string;
  }> = [];
  for (const m of mayorEntries) {
    if (slugToIdFull.has(m.geoSlug)) continue;
    const stateSlug = m.state.toLowerCase();
    const stateId = slugToIdFull.get(stateSlug);
    if (!stateId) {
      log("districts", `WARN: No state district for ${m.state}, skipping ${m.cityName}`);
      continue;
    }
    newMunis.push({
      name: m.cityName,
      kind: "municipality",
      state: m.state,
      parent_id: stateId,
      geo_slug: m.geoSlug,
    });
  }
  if (newMunis.length > 0) {
    const { error } = await db.from("Districts").insert(newMunis);
    if (error) throw new Error(`Municipality insert failed: ${error.message}`);
    log("districts", `Inserted ${newMunis.length} municipality districts`);
  } else {
    log("districts", "All municipality districts exist");
  }

  // Final count
  const { count } = await db.from("Districts").select("*", { count: "exact", head: true });
  log("districts", `Total districts: ${count}`);
}

// ─── Phase 2: Offices ────────────────────────────────────────────────────────

async function ingestOffices() {
  // Build slug→id map
  const { data: districts } = await db.from("Districts").select("id, geo_slug");
  const slugToId = new Map((districts ?? []).map((d) => [d.geo_slug, d.id]));

  // Fetch existing offices
  const { data: existingOffices } = await db.from("Offices").select("district_id, slug");
  const existingSet = new Set(
    (existingOffices ?? []).map((o) => `${o.district_id}::${o.slug}`)
  );

  function isNew(districtId: string, slug: string): boolean {
    return !existingSet.has(`${districtId}::${slug}`);
  }

  const toInsert: Array<Record<string, unknown>> = [];

  // 2a. US House offices
  for (const s of US_STATES) {
    for (let d = 1; d <= s.houseSeats; d++) {
      const geoSlug = houseGeoSlug(s.abbr, d, s.houseSeats);
      const districtId = slugToId.get(geoSlug);
      if (!districtId) continue;
      if (!isNew(districtId, "us-house")) continue;
      toInsert.push({
        district_id: districtId,
        title: `US House, ${houseDistrictName(s.abbr, d, s.houseSeats)}`,
        slug: "us-house",
        kind: "legislative",
        term_years: 2,
        next_election_at: "2026-11-03",
        is_seeded: true,
      });
    }
  }
  log("offices", `${toInsert.length} new House offices to insert`);

  // 2b. US Senate offices
  const senateCount = toInsert.length;
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
        seat_label: `Class ${senateClassLabel(cls)}`,
        term_years: 6,
        next_election_at: senateNextElection(cls),
        is_seeded: true,
      });
    }
  }
  log("offices", `${toInsert.length - senateCount} new Senate offices to insert`);

  // 2c. Governor offices
  const govCount = toInsert.length;
  const govEntries = governors as GovernorEntry[];
  for (const g of govEntries) {
    const stateId = slugToId.get(g.state.toLowerCase());
    if (!stateId) continue;
    if (!isNew(stateId, "governor")) continue;
    toInsert.push({
      district_id: stateId,
      title: `Governor of ${US_STATES.find((s) => s.abbr === g.state)?.name ?? g.state}`,
      slug: "governor",
      kind: "executive",
      term_years: g.termYears,
      next_election_at: g.nextElection,
      is_seeded: true,
    });
  }
  log("offices", `${toInsert.length - govCount} new Governor offices to insert`);

  // 2d. Mayor offices
  const mayorCount = toInsert.length;
  const mayorEntries = mayors as MayorEntry[];
  for (const m of mayorEntries) {
    const districtId = slugToId.get(m.geoSlug);
    if (!districtId) continue;
    if (!isNew(districtId, "mayor")) continue;
    toInsert.push({
      district_id: districtId,
      title: `Mayor of ${m.cityName}`,
      slug: "mayor",
      kind: "executive",
      term_years: m.termYears,
      next_election_at: m.nextElection,
      is_seeded: true,
    });
  }
  log("offices", `${toInsert.length - mayorCount} new Mayor offices to insert`);

  // Insert in chunks
  if (toInsert.length > 0) {
    for (let i = 0; i < toInsert.length; i += 200) {
      const chunk = toInsert.slice(i, i + 200);
      const { error } = await db.from("Offices").insert(chunk);
      if (error) throw new Error(`Office insert failed at chunk ${i}: ${error.message}`);
    }
    log("offices", `Inserted ${toInsert.length} offices total`);
  }

  const { count } = await db.from("Offices").select("*", { count: "exact", head: true });
  log("offices", `Total offices: ${count}`);
}

// ─── Phase 3: Officials ──────────────────────────────────────────────────────

async function ingestOfficials() {
  // Build lookup: (geo_slug, office_slug) → office_id
  const { data: offices } = await db
    .from("Offices")
    .select("id, slug, district_id");
  const { data: districts } = await db
    .from("Districts")
    .select("id, geo_slug");

  const districtIdToSlug = new Map((districts ?? []).map((d) => [d.id, d.geo_slug]));
  const officeKey = (geoSlug: string, officeSlug: string) => `${geoSlug}::${officeSlug}`;
  const officeMap = new Map(
    (offices ?? []).map((o) => [
      officeKey(districtIdToSlug.get(o.district_id) ?? "", o.slug),
      o.id,
    ])
  );

  // Fetch existing current officials by office_id
  const { data: existingOfficials } = await db
    .from("Officials")
    .select("id, office_id, name, external_refs")
    .eq("is_current", true);
  const currentByOffice = new Map(
    (existingOfficials ?? []).map((o) => [o.office_id, o])
  );

  const toInsert: Array<Record<string, unknown>> = [];
  const toUpdate: Array<{ id: string; external_refs: Record<string, string> }> = [];
  let skipped = 0;

  // 3a. Congress members
  log("officials", "Fetching legislators-current.yaml...");
  const res = await fetch(CONGRESS_URL);
  if (!res.ok) throw new Error(`Congress fetch failed: ${res.status}`);
  const yamlText = await res.text();
  const legislators: Legislator[] = parseYaml(yamlText);
  log("officials", `Fetched ${legislators.length} legislators`);

  for (const leg of legislators) {
    const currentTerm = leg.terms[leg.terms.length - 1];
    if (!currentTerm) continue;

    let geoSlug: string;
    let officeSlug: string;

    if (currentTerm.type === "rep") {
      const stateData = US_STATES.find((s) => s.abbr === currentTerm.state);
      if (!stateData) continue;
      const dist = currentTerm.district ?? 0;
      geoSlug = houseGeoSlug(currentTerm.state, dist === 0 ? 1 : dist, stateData.houseSeats);
      officeSlug = "us-house";
    } else {
      // senator
      geoSlug = currentTerm.state.toLowerCase();
      officeSlug = senateSlug(currentTerm.class ?? 1);
    }

    const oid = officeMap.get(officeKey(geoSlug, officeSlug));
    if (!oid) {
      log("officials", `WARN: No office for ${leg.name.official_full ?? leg.name.last} at ${geoSlug}/${officeSlug}`);
      continue;
    }

    const name = leg.name.official_full ?? `${leg.name.first} ${leg.name.last}`;
    const bioguide = leg.id.bioguide;
    const existing = currentByOffice.get(oid);

    if (existing) {
      // Office already has a current official — merge external_refs if needed
      const existingRefs = (existing.external_refs ?? {}) as Record<string, string>;
      if (!existingRefs.bioguide) {
        toUpdate.push({
          id: existing.id,
          external_refs: { ...existingRefs, bioguide },
        });
      }
      skipped++;
      continue;
    }

    toInsert.push({
      office_id: oid,
      name,
      party: currentTerm.party,
      term_start: currentTerm.start,
      term_end: currentTerm.end,
      is_current: true,
      external_refs: { bioguide },
    });
  }
  log("officials", `Congress: ${toInsert.length} to insert, ${skipped} skipped, ${toUpdate.length} to update refs`);

  // 3b. Governors
  const govEntries = governors as GovernorEntry[];
  for (const g of govEntries) {
    const oid = officeMap.get(officeKey(g.state.toLowerCase(), "governor"));
    if (!oid) {
      log("officials", `WARN: No governor office for ${g.state}`);
      continue;
    }
    const existing = currentByOffice.get(oid);
    if (existing) {
      skipped++;
      continue;
    }
    toInsert.push({
      office_id: oid,
      name: g.name,
      party: g.party,
      term_start: g.termStart,
      term_end: g.termEnd,
      is_current: true,
      external_refs: g.ballotpedia ? { ballotpedia: g.ballotpedia } : {},
    });
  }

  // 3c. Mayors
  const mayorEntries = mayors as MayorEntry[];
  for (const m of mayorEntries) {
    const oid = officeMap.get(officeKey(m.geoSlug, "mayor"));
    if (!oid) {
      log("officials", `WARN: No mayor office for ${m.cityName} at ${m.geoSlug}`);
      continue;
    }
    const existing = currentByOffice.get(oid);
    if (existing) {
      skipped++;
      continue;
    }
    toInsert.push({
      office_id: oid,
      name: m.name,
      party: m.party,
      term_start: m.termStart,
      term_end: m.termEnd,
      is_current: true,
      external_refs: m.ballotpedia ? { ballotpedia: m.ballotpedia } : {},
    });
  }

  // Execute inserts
  if (toInsert.length > 0) {
    for (let i = 0; i < toInsert.length; i += 200) {
      const chunk = toInsert.slice(i, i + 200);
      const { error } = await db.from("Officials").insert(chunk);
      if (error) throw new Error(`Official insert failed at chunk ${i}: ${error.message}`);
    }
    log("officials", `Inserted ${toInsert.length} officials`);
  }

  // Execute ref updates
  for (const u of toUpdate) {
    await db.from("Officials").update({ external_refs: u.external_refs }).eq("id", u.id);
  }
  if (toUpdate.length > 0) {
    log("officials", `Updated external_refs on ${toUpdate.length} existing officials`);
  }

  const { count } = await db
    .from("Officials")
    .select("*", { count: "exact", head: true })
    .eq("is_current", true);
  log("officials", `Total current officials: ${count}`);
}

// ─── Phase 4: Tags ───────────────────────────────────────────────────────────

async function ingestTags() {
  // Get all current officials
  const { data: officials } = await db
    .from("Officials")
    .select("id, name")
    .eq("is_current", true);

  if (!officials || officials.length === 0) {
    log("tags", "No officials found, skipping");
    return;
  }

  // Get existing official tags
  const { data: existingTags } = await db
    .from("Tags")
    .select("ref_id")
    .eq("kind", "official");
  const existingRefIds = new Set((existingTags ?? []).map((t) => t.ref_id));

  const newTags = officials
    .filter((o) => !existingRefIds.has(o.id))
    .map((o) => ({
      kind: "official",
      ref_id: o.id,
      label: o.name,
    }));

  if (newTags.length > 0) {
    for (let i = 0; i < newTags.length; i += 200) {
      const chunk = newTags.slice(i, i + 200);
      const { error } = await db.from("Tags").insert(chunk);
      if (error) throw new Error(`Tag insert failed at chunk ${i}: ${error.message}`);
    }
    log("tags", `Inserted ${newTags.length} official tags`);
  } else {
    log("tags", "All official tags exist");
  }

  const { count } = await db
    .from("Tags")
    .select("*", { count: "exact", head: true })
    .eq("kind", "official");
  log("tags", `Total official tags: ${count}`);

  // 4b. District tags
  const tagKinds = ["state", "us_house", "county", "municipality"];
  const { data: taggableDistricts } = await db
    .from("Districts")
    .select("id, name, kind")
    .in("kind", tagKinds);

  if (taggableDistricts && taggableDistricts.length > 0) {
    const { data: existingDistrictTags } = await db
      .from("Tags")
      .select("ref_id")
      .eq("kind", "district");
    const existingDistrictRefIds = new Set(
      (existingDistrictTags ?? []).map((t) => t.ref_id)
    );

    const newDistrictTags = taggableDistricts
      .filter((d) => !existingDistrictRefIds.has(d.id))
      .map((d) => ({
        kind: "district",
        ref_id: d.id,
        label: d.name,
      }));

    if (newDistrictTags.length > 0) {
      for (let i = 0; i < newDistrictTags.length; i += 200) {
        const chunk = newDistrictTags.slice(i, i + 200);
        const { error } = await db.from("Tags").insert(chunk);
        if (error) throw new Error(`District tag insert failed at chunk ${i}: ${error.message}`);
      }
      log("tags", `Inserted ${newDistrictTags.length} district tags`);
    } else {
      log("tags", "All district tags exist");
    }
  }

  const { count: districtTagCount } = await db
    .from("Tags")
    .select("*", { count: "exact", head: true })
    .eq("kind", "district");
  log("tags", `Total district tags: ${districtTagCount}`);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== BallotCard Ingestion Pipeline ===\n");
  const start = Date.now();

  try {
    await ingestDistricts();
    console.log();
    await ingestOffices();
    console.log();
    await ingestOfficials();
    console.log();
    await ingestTags();
  } catch (err) {
    console.error("\n❌ Ingestion failed:", err);
    process.exit(1);
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n=== Done in ${elapsed}s ===`);
}

main();
