// Comprehensive per-state coverage probe: officeholders, candidates, and
// registered candidate sources across all 50 states. Read-only — a wider,
// per-state companion to verify.ts (which only checks national totals).
// Run: npx tsx --env-file=.env.local scripts/probe-coverage.ts

import { db } from "./lib/supabase-client";
import { US_STATES } from "./lib/us-states";
import { STATE_CANDIDATE_SOURCES } from "./lib/candidate-sources";

const CYCLE = 2026;
const PAGE = 1000;

// Nebraska's Legislature is unicameral — it has no state-house seats by
// design (see scripts/ingest.ts 2f), so "0 state house officials" is correct
// there, not a gap.
const UNICAMERAL_NO_HOUSE = new Set(["NE"]);

// No 2026 state-leg elections, so no scraper is registered for these states
// (see the "Intentionally absent" comment in candidate-sources/ballotpedia.ts).
// Federal candidates still show up via the FEC source regardless.
const NO_2026_STATE_LEG_CYCLE = new Set(["LA", "MS", "NJ", "VA"]);

async function selectAll<T = Record<string, unknown>>(
  table: string,
  columns: string,
  eq?: [string, unknown]
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    let query = db.from(table).select(columns);
    if (eq) query = query.eq(eq[0], eq[1]);
    const { data, error } = await query.order("id").range(from, from + PAGE - 1);
    if (error) throw new Error(`${table} select failed: ${error.message}`);
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

type OfficeKind = "governor" | "us-senate" | "us-house" | "state-senate" | "state-house";

function classifySlug(slug: string): OfficeKind | null {
  if (slug === "governor") return "governor";
  if (slug.startsWith("us-senate-class-")) return "us-senate";
  if (slug === "us-house") return "us-house";
  if (slug === "state-senate") return "state-senate";
  if (slug === "state-house") return "state-house";
  return null;
}

async function main() {
  console.log("=== BallotCard Coverage Probe (officeholders, candidates, sources) ===\n");

  const districts = await selectAll<{ id: string; state: string | null }>(
    "Districts",
    "id, state"
  );
  const districtState = new Map(districts.map((d) => [d.id, d.state]));

  const offices = await selectAll<{ id: string; slug: string; district_id: string }>(
    "Offices",
    "id, slug, district_id"
  );
  type OfficeMeta = { state: string; kind: OfficeKind };
  const officeMeta = new Map<string, OfficeMeta>();
  for (const o of offices) {
    const kind = classifySlug(o.slug);
    const state = districtState.get(o.district_id);
    if (kind && state) officeMeta.set(o.id, { state, kind });
  }

  const officials = await selectAll<{ office_id: string }>(
    "Officials",
    "office_id",
    ["is_current", true]
  );
  const officialCounts = new Map<string, number>(); // "STATE::kind" -> count
  for (const o of officials) {
    const meta = officeMeta.get(o.office_id);
    if (!meta) continue;
    const key = `${meta.state}::${meta.kind}`;
    officialCounts.set(key, (officialCounts.get(key) ?? 0) + 1);
  }

  const candidates = await selectAll<{ office_id: string; source: string; cycle: number }>(
    "Candidates",
    "office_id, source, cycle",
    ["cycle", CYCLE]
  );
  const candidateCountByState = new Map<string, number>();
  const candidateRacesByState = new Map<string, Set<string>>(); // distinct offices with >=1 candidate
  const candidateSourcesByState = new Map<string, Set<string>>();
  for (const c of candidates) {
    const meta = officeMeta.get(c.office_id);
    if (!meta) continue;
    candidateCountByState.set(meta.state, (candidateCountByState.get(meta.state) ?? 0) + 1);
    if (!candidateRacesByState.has(meta.state)) candidateRacesByState.set(meta.state, new Set());
    candidateRacesByState.get(meta.state)!.add(c.office_id);
    if (!candidateSourcesByState.has(meta.state)) candidateSourcesByState.set(meta.state, new Set());
    candidateSourcesByState.get(meta.state)!.add(c.source);
  }

  const header = [
    "ST",
    "Gov",
    "Sen",
    "House",
    "SSen",
    "SHouse",
    "Cands",
    "Races",
    "Scraper",
  ];
  console.log(header.map((h) => h.padEnd(8)).join(""));
  console.log("-".repeat(header.length * 8));

  const gaps: string[] = [];

  for (const s of US_STATES) {
    const gov = officialCounts.get(`${s.abbr}::governor`) ?? 0;
    const sen = officialCounts.get(`${s.abbr}::us-senate`) ?? 0;
    const house = officialCounts.get(`${s.abbr}::us-house`) ?? 0;
    const sSen = officialCounts.get(`${s.abbr}::state-senate`) ?? 0;
    const sHouse = officialCounts.get(`${s.abbr}::state-house`) ?? 0;
    const cands = candidateCountByState.get(s.abbr) ?? 0;
    const races = candidateRacesByState.get(s.abbr)?.size ?? 0;
    const hasScraper = Boolean(STATE_CANDIDATE_SOURCES[s.abbr]);
    const scraperLabel = hasScraper
      ? [...(candidateSourcesByState.get(s.abbr) ?? [])].join("|") || "registered/0"
      : "NONE";

    console.log(
      [
        s.abbr,
        String(gov),
        String(sen),
        `${house}/${s.houseSeats}`,
        String(sSen),
        String(sHouse),
        String(cands),
        String(races),
        scraperLabel,
      ]
        .map((v) => v.padEnd(8))
        .join("")
    );

    if (gov === 0) gaps.push(`${s.abbr}: no current governor`);
    if (sen < 2) gaps.push(`${s.abbr}: only ${sen}/2 US Senate seats held`);
    if (house < s.houseSeats)
      gaps.push(`${s.abbr}: only ${house}/${s.houseSeats} US House seats held`);
    if (sSen === 0) gaps.push(`${s.abbr}: no state senate officials`);
    if (sHouse === 0 && !UNICAMERAL_NO_HOUSE.has(s.abbr))
      gaps.push(`${s.abbr}: no state house officials`);
    if (!hasScraper && !NO_2026_STATE_LEG_CYCLE.has(s.abbr))
      gaps.push(`${s.abbr}: no candidate scraper registered`);
    else if (hasScraper && cands === 0)
      gaps.push(`${s.abbr}: scraper registered but 0 candidates for ${CYCLE}`);
  }

  console.log(`\n=== Gaps (${gaps.length}) ===`);
  if (gaps.length === 0) {
    console.log("  none — full coverage across all 50 states");
  } else {
    for (const g of gaps) console.log(`  ✗ ${g}`);
  }

  const statesWithScraper = US_STATES.filter((s) => STATE_CANDIDATE_SOURCES[s.abbr]).length;
  const statesWithCandidates = US_STATES.filter(
    (s) => (candidateCountByState.get(s.abbr) ?? 0) > 0
  ).length;
  console.log(
    `\nSummary: ${statesWithScraper}/50 states have a registered scraper, ` +
      `${statesWithCandidates}/50 have ≥1 ${CYCLE} candidate row.`
  );
}

main();
