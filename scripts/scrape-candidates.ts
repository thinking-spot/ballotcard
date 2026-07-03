// State-legislative candidate scraping pipeline.
// Run: npm run scrape (or: tsx --env-file=.env.local scripts/scrape-candidates.ts)
//
// Walks the STATE_CANDIDATE_SOURCES registry, fetches each state's filings,
// maps them onto BallotCard's Offices + Districts, and upserts into the
// Candidates table. Idempotent per (source, cycle): each run deletes the
// scraped rows for that source/cycle and re-inserts, so dropouts and status
// changes are reflected without orphaning rows.
//
// Then triggers the same /api/revalidate webhook that the main ingest uses
// so the ISR cache flushes immediately.

import { db } from "./lib/supabase-client";
import {
  STATE_CANDIDATE_SOURCES,
  PRIMARY_SOURCE_STATES,
  type ScrapedCandidate,
} from "./lib/candidate-sources";
import { resolveStaggeredSeats } from "./lib/resolve-staggered";
import { sldUpperSlug, sldLowerSlug } from "../src/lib/ballot-card";
import { houseGeoSlug, US_STATES } from "./lib/us-states";

const DEFAULT_CYCLES = [2026];

function log(state: string, msg: string) {
  console.log(`[scrape:${state.toLowerCase()}] ${msg}`);
}

// District slug for a scraped (state, chamber, district) tuple. Mirrors the
// slug conventions baked into ingest.ts so the lookup hits.
//
// For US Senate, the office lives directly on the state district — no
// per-district child — so we return the state slug itself; callers match the
// office by (state district id, "us-senate-class-X" slug).
function districtSlug(
  state: string,
  officeSlug: ScrapedCandidate["officeSlug"],
  district: string
): string {
  const lo = state.toLowerCase();
  if (officeSlug === "state-senate") return sldUpperSlug(lo, district);
  if (officeSlug === "state-house") return sldLowerSlug(lo, district);
  if (officeSlug === "us-house") {
    // CD slug: matches ingestDistricts' houseGeoSlug() — handles AL/AK-style
    // single-district states ("al") and zero-pads two-digit district numbers.
    const houseSeats =
      US_STATES.find((s) => s.abbr === state.toUpperCase())?.houseSeats ?? 0;
    const d = parseInt(district, 10);
    if (!d || !houseSeats) return `${lo}/${district}`;
    return houseGeoSlug(state.toUpperCase(), d, houseSeats);
  }
  if (officeSlug.startsWith("us-senate-class-")) return lo;
  throw new Error(`Unknown officeSlug: ${officeSlug}`);
}

async function loadDistrictAndOfficeMaps(state: string) {
  // Districts for this state — state-leg + US House + the state row itself
  // (the state row is the parent of US Senate offices).
  const { data: districts, error: dErr } = await db
    .from("Districts")
    .select("id, geo_slug")
    .eq("state", state)
    .in("kind", ["state_senate", "state_house", "us_house", "state"]);
  if (dErr) throw new Error(`Districts query failed: ${dErr.message}`);
  const districtIdBySlug = new Map(
    (districts ?? []).map((d) => [d.geo_slug as string, d.id as string])
  );

  // Offices for those districts, keyed by (district_id, slug). Most keys
  // resolve to one office; multi-member districts (migration 0011 — AZ/MD/
  // NH/NJ/ND/SD/VT/WA House, VT/WV Senate) resolve to several, one per real
  // seat. A scraped race is one shared at-large candidate pool per district
  // — we don't get per-seat sub-division from the source — so every
  // candidate row is attached to all sibling offices for that key.
  const districtIds = (districts ?? []).map((d) => d.id as string);
  const officeIdByKey = new Map<string, string[]>();
  if (districtIds.length > 0) {
    for (let from = 0; ; from += 1000) {
      const { data: offices, error: oErr } = await db
        .from("Offices")
        .select("id, district_id, slug")
        .in("district_id", districtIds)
        .in("slug", [
          "state-senate",
          "state-house",
          "us-house",
          "us-senate-class-i",
          "us-senate-class-ii",
          "us-senate-class-iii",
        ])
        .range(from, from + 999);
      if (oErr) throw new Error(`Offices query failed: ${oErr.message}`);
      for (const o of offices ?? []) {
        const key = `${o.district_id}::${o.slug}`;
        if (!officeIdByKey.has(key)) officeIdByKey.set(key, []);
        officeIdByKey.get(key)!.push(o.id as string);
      }
      if (!offices || offices.length < 1000) break;
    }
  }
  return { districtIdBySlug, officeIdByKey };
}

// Detect incumbency by matching scraped candidate names to the current
// officeholder of the same office. FL doesn't ship an incumbency flag in the
// extract, and the ones that do still benefit from cross-checking against
// our own Officials table — it's the source of truth for "who currently sits".
function buildIncumbentMatcher(officials: Array<{ office_id: string; name: string }>) {
  const incumbentByOffice = new Map<string, string>();
  for (const o of officials) {
    incumbentByOffice.set(o.office_id, normalizeName(o.name));
  }
  return (officeId: string, candidateName: string) => {
    const inc = incumbentByOffice.get(officeId);
    if (!inc) return false;
    return inc === normalizeName(candidateName);
  };
}

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/['’.,]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Looser match for cross-source dedup (e.g. FEC's "Eric Burlison" vs MO SoS's
// "Eric W. Burlison"): drop middle name(s) so two names match when their first
// and last tokens agree. Conservative: requires ≥2 tokens to even attempt.
function firstLastKey(s: string): string {
  const tokens = normalizeName(s).split(" ");
  if (tokens.length < 2) return normalizeName(s);
  return `${tokens[0]} ${tokens[tokens.length - 1]}`;
}

// Common nicknames → legal first name, so a Secretary-of-State "Bob Harvie"
// dedups against FEC's "Robert J Harvie". One-directional and deliberately
// conservative — only well-known diminutives; anything unlisted is left as-is.
// Ambiguous chains (e.g. John/Jonathan/Jack) are intentionally omitted to avoid
// merging genuinely different candidates.
const NICKNAMES: Record<string, string> = {
  bob: "robert", rob: "robert", bobby: "robert", robbie: "robert",
  bill: "william", will: "william", billy: "william", willie: "william",
  dick: "richard", rick: "richard", ricky: "richard", rich: "richard", richie: "richard",
  jim: "james", jimmy: "james", jamie: "james",
  joe: "joseph", joey: "joseph",
  mike: "michael", mikey: "michael",
  tom: "thomas", tommy: "thomas",
  tony: "anthony",
  dave: "david", davey: "david",
  dan: "daniel", danny: "daniel",
  ed: "edward", eddie: "edward",
  steve: "steven", stevie: "steven",
  chris: "christopher",
  chuck: "charles", charlie: "charles",
  matt: "matthew",
  greg: "gregory",
  ken: "kenneth", kenny: "kenneth",
  ron: "ronald", ronnie: "ronald",
  don: "donald", donnie: "donald",
  pat: "patrick",
  pete: "peter",
  sam: "samuel", sammy: "samuel",
  ben: "benjamin", benny: "benjamin",
  andy: "andrew", drew: "andrew",
  fred: "frederick", freddie: "frederick",
  gabe: "gabriel",
  nate: "nathaniel",
  nick: "nicholas",
  phil: "philip",
  ray: "raymond",
  vince: "vincent",
  walt: "walter",
  kate: "katherine", katie: "katherine", kathy: "katherine",
  cathy: "catherine",
  beth: "elizabeth", liz: "elizabeth", lizzie: "elizabeth", betty: "elizabeth", betsy: "elizabeth",
  sue: "susan", susie: "susan",
  peg: "margaret", peggy: "margaret", meg: "margaret", maggie: "margaret",
  patty: "patricia", patti: "patricia", trish: "patricia",
  jen: "jennifer", jenny: "jennifer",
  jess: "jessica",
  abby: "abigail",
  becky: "rebecca",
  vicky: "victoria",
  val: "valerie",
};

const NAME_SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv", "v"]);

function canonicalNickname(token: string): string {
  return NICKNAMES[token] ?? token;
}

// First and last meaningful tokens of a name, with trailing generational
// suffixes (Jr, III…) stripped so they don't masquerade as the surname.
function firstAndLastToken(s: string): [string, string] | null {
  const tokens = normalizeName(s).split(" ").filter(Boolean);
  while (tokens.length > 1 && NAME_SUFFIXES.has(tokens[tokens.length - 1])) {
    tokens.pop();
  }
  if (tokens.length < 2) return null;
  return [tokens[0], tokens[tokens.length - 1]];
}

// Nickname-tolerant cross-source key: canonical-first + last, so both
// "Bob Harvie" and "Robert J Harvie" reduce to "robert harvie".
function nicknameKey(s: string): string | null {
  const fl = firstAndLastToken(s);
  if (!fl) return null;
  return `${canonicalNickname(fl[0])} ${fl[1]}`;
}

async function scrapeState(state: string, cycle: number) {
  const fetcher = STATE_CANDIDATE_SOURCES[state];
  if (!fetcher) {
    log(state, `No scraper registered — skipping`);
    return { state, cycle, inserted: 0, skipped: 0 };
  }

  log(state, `Fetching ${cycle} state-leg candidates…`);
  let scraped: ScrapedCandidate[];
  try {
    scraped = await fetcher(cycle);
  } catch (err) {
    log(state, `ERROR: ${(err as Error).message}`);
    throw err;
  }
  log(state, `Fetched ${scraped.length} rows`);

  // Source label comes from the scraper (e.g. "fl_sos", "oh_ballotpedia").
  // A zero-row scrape has no row to read .source from, so fall back to the
  // label this state's registered source actually uses — primary-source
  // states ("{state}_sos") vs. the Ballotpedia fallback ("{state}_ballotpedia").
  // Guessing "_sos" unconditionally here previously made the REJECTED
  // safety-net check the wrong label for every Ballotpedia state, silently
  // no-oping instead of protecting existing data on a failed fetch.
  const sourceLabel =
    scraped[0]?.source ??
    (PRIMARY_SOURCE_STATES.has(state)
      ? `${state.toLowerCase()}_sos`
      : `${state.toLowerCase()}_ballotpedia`);

  // Sanity floor: if we previously had a healthy number of rows and the
  // current run returns zero, refuse to wipe the prior data — that almost
  // certainly means the source changed format.
  const { count: prior } = await db
    .from("Candidates")
    .select("*", { count: "exact", head: true })
    .eq("source", sourceLabel)
    .eq("cycle", cycle);
  if (scraped.length === 0 && (prior ?? 0) > 0) {
    log(state, `REJECTED: 0 rows scraped but ${prior} on file — keeping existing data`);
    return { state, cycle, inserted: 0, skipped: prior ?? 0, rejected: true };
  }

  const { districtIdBySlug, officeIdByKey } = await loadDistrictAndOfficeMaps(state);

  // Officials for incumbency detection.
  const officeIds = [...officeIdByKey.values()].flat();
  const officials: Array<{ office_id: string; name: string }> = [];
  if (officeIds.length > 0) {
    for (let from = 0; ; from += 1000) {
      const { data } = await db
        .from("Officials")
        .select("office_id, name")
        .in("office_id", officeIds)
        .eq("is_current", true)
        .range(from, from + 999);
      if (!data || data.length === 0) break;
      officials.push(...(data as Array<{ office_id: string; name: string }>));
      if (data.length < 1000) break;
    }
  }
  const isIncumbent = buildIncumbentMatcher(officials);

  // Build candidate rows.
  const rows: Array<Record<string, unknown>> = [];
  const federalOfficeIds = new Set<string>();
  let unmatched = 0;
  for (const c of scraped) {
    const dSlug = districtSlug(state, c.officeSlug, c.district);
    const districtId = districtIdBySlug.get(dSlug);
    if (!districtId) {
      unmatched++;
      continue;
    }
    const officeIds = officeIdByKey.get(`${districtId}::${c.officeSlug}`);
    if (!officeIds || officeIds.length === 0) {
      unmatched++;
      continue;
    }
    // Multi-member districts share one at-large candidate pool across their
    // seats (the source doesn't sub-divide by seat), so the same scraped
    // candidate becomes one row per sibling office — but incumbency is
    // still per-seat (matched against that specific office's officeholder).
    for (const officeId of officeIds) {
      if (c.officeSlug === "us-house" || c.officeSlug.startsWith("us-senate-class-")) {
        federalOfficeIds.add(officeId);
      }
      rows.push({
        office_id: officeId,
        name: c.name,
        party: c.party,
        cycle: c.cycle,
        election_date: c.electionDate ?? null,
        is_incumbent: isIncumbent(officeId, c.name),
        status: c.status,
        source: c.source ?? sourceLabel,
        external_refs: {
          // Use a source-specific external-ID key so two sources for the same
          // state (e.g. nc_sos + a future nc_ballotpedia) don't collide.
          [`${sourceLabel}_id`]: c.externalId,
          ...(c.extraRefs ?? {}),
        },
      });
    }
  }

  if (unmatched > 0) {
    log(state, `WARN: ${unmatched} candidates had no matching office/district`);
  }

  // Dedup on (office_id, cycle, name) — Candidates has a unique constraint
  // there. Prefer the incumbent row when a name collision happens.
  const deduped = new Map<string, Record<string, unknown>>();
  for (const r of rows) {
    const key = `${r.office_id}::${r.cycle}::${r.name}`;
    const existing = deduped.get(key);
    if (!existing) deduped.set(key, r);
    else if (r.is_incumbent && !existing.is_incumbent) deduped.set(key, r);
  }
  const finalRows = [...deduped.values()];

  // Idempotent: clear this source/cycle, then dedupe against authoritative
  // sources (FEC) before re-inserting. The Candidates UNIQUE constraint is
  // (office_id, cycle, name) and is NOT scoped by source — so a state SoS
  // run that hits a federal race would collide with the FEC row. FEC has
  // money totals + better incumbency data, so we let FEC win and skip
  // overlapping rows from the SoS feed.
  await db
    .from("Candidates")
    .delete()
    .eq("source", sourceLabel)
    .eq("cycle", cycle);

  let skipFedKeys = new Set<string>();
  const incumbentFedOfficeIds = new Set<string>();
  if (federalOfficeIds.size > 0) {
    const { data: existing } = await db
      .from("Candidates")
      .select("office_id, name, is_incumbent")
      .eq("cycle", cycle)
      .in("office_id", [...federalOfficeIds]);
    // Index by both exact-normalized name AND first/last-only — covers the
    // common "Eric Burlison" (FEC) vs "Eric W. Burlison" (state) divergence.
    skipFedKeys = new Set();
    for (const r of existing ?? []) {
      const n = r.name as string;
      skipFedKeys.add(`${r.office_id}::${normalizeName(n)}`);
      skipFedKeys.add(`${r.office_id}::${firstLastKey(n)}`);
      const nk = nicknameKey(n);
      if (nk) skipFedKeys.add(`${r.office_id}::nick::${nk}`);
      if (r.is_incumbent) incumbentFedOfficeIds.add(r.office_id as string);
    }
  }
  const filteredRows = finalRows.filter((r) => {
    if (!federalOfficeIds.has(r.office_id as string)) return true;
    const officeId = r.office_id as string;
    // A seat has exactly one incumbent. If FEC already contributed an
    // incumbent-flagged row for this office and our own matcher also thinks
    // this scraped candidate is the incumbent (matched against Officials —
    // the source of truth), they're the same person even when the name
    // strings don't overlap at all (FEC's legal "George J. Kelly Jr." vs the
    // PA SoS's "Mike Kelly"; a nickname chain we deliberately don't guess at,
    // like "Jack" for "John"). This invariant catches those without growing
    // the nickname map — see the flagged-incumbent audit that found them.
    if (r.is_incumbent && incumbentFedOfficeIds.has(officeId)) return false;
    const exact = `${officeId}::${normalizeName(r.name as string)}`;
    const loose = `${officeId}::${firstLastKey(r.name as string)}`;
    const nk = nicknameKey(r.name as string);
    const nick = nk ? `${officeId}::nick::${nk}` : null;
    return (
      !skipFedKeys.has(exact) &&
      !skipFedKeys.has(loose) &&
      !(nick !== null && skipFedKeys.has(nick))
    );
  });
  const skippedFederal = finalRows.length - filteredRows.length;

  if (filteredRows.length > 0) {
    for (let i = 0; i < filteredRows.length; i += 200) {
      const chunk = filteredRows.slice(i, i + 200);
      const { error } = await db.from("Candidates").insert(chunk);
      if (error) throw new Error(`${state} insert failed at ${i}: ${error.message}`);
    }
  }
  const dupes = rows.length - finalRows.length;
  log(
    state,
    `Wrote ${filteredRows.length} candidates (${dupes} dupes collapsed, ${skippedFederal} federal skipped — FEC has them)`
  );
  return { state, cycle, inserted: filteredRows.length, skipped: skippedFederal };
}


async function revalidateLiveSite(): Promise<void> {
  const siteUrl = process.env.SITE_URL;
  const secret = process.env.REVALIDATE_SECRET;
  if (!siteUrl || !secret) {
    console.log("[revalidate] Skipped (SITE_URL or REVALIDATE_SECRET not set)");
    return;
  }
  try {
    const res = await fetch(`${siteUrl.replace(/\/+$/, "")}/api/revalidate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(10_000),
    });
    console.log(res.ok ? "[revalidate] Flushed ISR cache" : `[revalidate] ${res.status}`);
  } catch (err) {
    console.log(`[revalidate] Webhook failed: ${(err as Error).message}`);
  }
}

async function main() {
  console.log("=== State-leg candidate scrape ===\n");
  const start = Date.now();

  const states = process.argv.slice(2).filter((a) => /^[A-Z]{2}$/i.test(a));
  const targets = (states.length > 0 ? states : Object.keys(STATE_CANDIDATE_SOURCES)).map(
    (s) => s.toUpperCase()
  );

  // Run states with bounded concurrency. Ballotpedia rate-limits aggressively
  // at >2 simultaneous requests (each state opens 2 chamber requests, so 2
  // states = 4 concurrent HTTP requests against the same host). The per-state
  // retry-with-backoff in fetchBallotpediaChamber handles short blips.
  const CONC = 2;
  type Result = Awaited<ReturnType<typeof scrapeState>>;
  const results: Result[] = [];
  const queue = [...targets];
  let active = 0;
  await new Promise<void>((resolve) => {
    const launch = () => {
      while (active < CONC && queue.length > 0) {
        const state = queue.shift()!;
        active++;
        (async () => {
          for (const cycle of DEFAULT_CYCLES) {
            try {
              results.push(await scrapeState(state, cycle));
            } catch (err) {
              console.error(`[${state}] failed:`, (err as Error).message);
            }
          }
        })().finally(() => {
          active--;
          if (queue.length === 0 && active === 0) resolve();
          else launch();
        });
      }
    };
    launch();
  });

  // Filings are seat-level election evidence — re-derive the staggered-chamber
  // estimated flags before flushing the cache so a seat resolved by this scrape
  // renders an exact date immediately. Non-fatal to the run — the scrape
  // itself succeeded and revalidate should still happen — but a persistent
  // resolver failure (or a tripped mass-revert guard, which usually means a
  // prior scrape lost data) should not go unnoticed forever on the weekly
  // cron: mark the process exit code without aborting.
  try {
    const result = await resolveStaggeredSeats();
    if (result.guardTripped) process.exitCode = 1;
  } catch (err) {
    console.error(`[staggered] resolution failed: ${(err as Error).message}`);
    process.exitCode = 1;
  }

  await revalidateLiveSite();

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n=== Done in ${elapsed}s ===`);
  console.table(results);
}

main();
