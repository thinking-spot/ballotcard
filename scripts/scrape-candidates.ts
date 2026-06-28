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
import { STATE_CANDIDATE_SOURCES, type ScrapedCandidate } from "./lib/candidate-sources";
import { sldUpperSlug, sldLowerSlug } from "../src/lib/ballot-card";

const DEFAULT_CYCLES = [2026];

function log(state: string, msg: string) {
  console.log(`[scrape:${state.toLowerCase()}] ${msg}`);
}

// District slug for a state-leg seat — mirrors the ingestion convention so a
// scraped (state, chamber, district) tuple resolves to the right Districts row.
function districtSlug(
  state: string,
  officeSlug: "state-senate" | "state-house",
  district: string
): string {
  return officeSlug === "state-senate"
    ? sldUpperSlug(state.toLowerCase(), district)
    : sldLowerSlug(state.toLowerCase(), district);
}

async function loadDistrictAndOfficeMaps(state: string) {
  // Districts for this state, keyed by geo_slug.
  const { data: districts, error: dErr } = await db
    .from("Districts")
    .select("id, geo_slug")
    .eq("state", state)
    .in("kind", ["state_senate", "state_house"]);
  if (dErr) throw new Error(`Districts query failed: ${dErr.message}`);
  const districtIdBySlug = new Map(
    (districts ?? []).map((d) => [d.geo_slug as string, d.id as string])
  );

  // Offices for those districts, keyed by (district_id, slug).
  const districtIds = (districts ?? []).map((d) => d.id as string);
  const officeIdByKey = new Map<string, string>();
  if (districtIds.length > 0) {
    // Paginate — Supabase caps single SELECT at 1000; some big states are over.
    for (let from = 0; ; from += 1000) {
      const { data: offices, error: oErr } = await db
        .from("Offices")
        .select("id, district_id, slug")
        .in("district_id", districtIds)
        .in("slug", ["state-senate", "state-house"])
        .range(from, from + 999);
      if (oErr) throw new Error(`Offices query failed: ${oErr.message}`);
      for (const o of offices ?? []) {
        officeIdByKey.set(`${o.district_id}::${o.slug}`, o.id as string);
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

  // Sanity floor: if we previously had a healthy number of rows and the
  // current run returns zero, refuse to wipe the prior data — that almost
  // certainly means the source changed format.
  const { count: prior } = await db
    .from("Candidates")
    .select("*", { count: "exact", head: true })
    .eq("source", `${state.toLowerCase()}_sos`)
    .eq("cycle", cycle);
  if (scraped.length === 0 && (prior ?? 0) > 0) {
    log(state, `REJECTED: 0 rows scraped but ${prior} on file — keeping existing data`);
    return { state, cycle, inserted: 0, skipped: prior ?? 0, rejected: true };
  }

  const { districtIdBySlug, officeIdByKey } = await loadDistrictAndOfficeMaps(state);

  // Officials for incumbency detection.
  const officeIds = [...officeIdByKey.values()];
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
  let unmatched = 0;
  for (const c of scraped) {
    const dSlug = districtSlug(state, c.officeSlug, c.district);
    const districtId = districtIdBySlug.get(dSlug);
    if (!districtId) {
      unmatched++;
      continue;
    }
    const officeId = officeIdByKey.get(`${districtId}::${c.officeSlug}`);
    if (!officeId) {
      unmatched++;
      continue;
    }
    rows.push({
      office_id: officeId,
      name: c.name,
      party: c.party,
      cycle: c.cycle,
      election_date: c.electionDate ?? null,
      is_incumbent: isIncumbent(officeId, c.name),
      status: c.status,
      source: `${state.toLowerCase()}_sos`,
      external_refs: { [`${state.toLowerCase()}_acct_num`]: c.externalId, ...(c.extraRefs ?? {}) },
    });
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

  // Idempotent: clear this source/cycle, re-insert.
  await db
    .from("Candidates")
    .delete()
    .eq("source", `${state.toLowerCase()}_sos`)
    .eq("cycle", cycle);
  if (finalRows.length > 0) {
    for (let i = 0; i < finalRows.length; i += 200) {
      const chunk = finalRows.slice(i, i + 200);
      const { error } = await db.from("Candidates").insert(chunk);
      if (error) throw new Error(`${state} insert failed at ${i}: ${error.message}`);
    }
  }
  log(state, `Wrote ${finalRows.length} candidates (${rows.length - finalRows.length} duplicates collapsed)`);
  return { state, cycle, inserted: finalRows.length, skipped: 0 };
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

  const results: Awaited<ReturnType<typeof scrapeState>>[] = [];
  for (const state of targets) {
    for (const cycle of DEFAULT_CYCLES) {
      try {
        results.push(await scrapeState(state, cycle));
      } catch (err) {
        console.error(`[${state}] failed:`, (err as Error).message);
      }
    }
  }

  await revalidateLiveSite();

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n=== Done in ${elapsed}s ===`);
  console.table(results);
}

main();
