// Per-seat election snapshot: incumbent, next election date (+ whether it's
// estimated), primary date, and 2026 candidate filings for every seat across
// governor / US Senate / US House / state senate / state house in all 50
// states. Read-only. Meant to be re-run repeatedly as filings/dates change
// between now and the midterms — pipe --json output to a dated file to diff
// snapshots over time.
//
// Run: npx tsx --env-file=.env.local scripts/probe-elections.ts [--json]

import { db } from "./lib/supabase-client";
import { US_STATES } from "./lib/us-states";

const CYCLE = 2026;
const PAGE = 1000;
const JSON_MODE = process.argv.includes("--json");

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

type OfficeRow = {
  id: string;
  slug: string;
  title: string;
  seat_label: string | null;
  district_id: string;
  next_election_at: string | null;
  next_election_estimated: boolean;
  primary_election_at: string | null;
  term_years: number | null;
};

type OfficialRow = {
  office_id: string;
  name: string;
  party: string | null;
  term_start: string | null;
  term_end: string | null;
};

type CandidateRow = {
  office_id: string;
  name: string;
  party: string | null;
  is_incumbent: boolean;
  status: string | null;
  source: string;
  election_date: string | null;
  fec_totals: { receipts?: number; cash_on_hand?: number } | null;
};

type SeatRecord = {
  officeId: string;
  state: string;
  kind: OfficeKind;
  title: string;
  seatLabel: string | null;
  nextElectionAt: string | null;
  nextElectionEstimated: boolean;
  primaryElectionAt: string | null;
  termYears: number | null;
  incumbent: { name: string; party: string | null; termEnd: string | null } | null;
  candidates: {
    name: string;
    party: string | null;
    isIncumbent: boolean;
    status: string | null;
    source: string;
    cashOnHand: number | null;
  }[];
};

async function main() {
  const districts = await selectAll<{ id: string; state: string | null }>(
    "Districts",
    "id, state"
  );
  const districtState = new Map(districts.map((d) => [d.id, d.state]));

  const offices = await selectAll<OfficeRow>(
    "Offices",
    "id, slug, title, seat_label, district_id, next_election_at, next_election_estimated, primary_election_at, term_years"
  );

  const seats = new Map<string, SeatRecord>();
  for (const o of offices) {
    const kind = classifySlug(o.slug);
    const state = districtState.get(o.district_id);
    if (!kind || !state || !US_STATES.some((s) => s.abbr === state)) continue;
    seats.set(o.id, {
      officeId: o.id,
      state,
      kind,
      title: o.title,
      seatLabel: o.seat_label,
      nextElectionAt: o.next_election_at,
      nextElectionEstimated: o.next_election_estimated,
      primaryElectionAt: o.primary_election_at,
      termYears: o.term_years,
      incumbent: null,
      candidates: [],
    });
  }

  const officials = await selectAll<OfficialRow>(
    "Officials",
    "office_id, name, party, term_start, term_end",
    ["is_current", true]
  );
  for (const o of officials) {
    const seat = seats.get(o.office_id);
    if (!seat) continue;
    seat.incumbent = { name: o.name, party: o.party, termEnd: o.term_end };
  }

  const candidates = await selectAll<CandidateRow>(
    "Candidates",
    "office_id, name, party, is_incumbent, status, source, election_date, fec_totals",
    ["cycle", CYCLE]
  );
  for (const c of candidates) {
    const seat = seats.get(c.office_id);
    if (!seat) continue;
    seat.candidates.push({
      name: c.name,
      party: c.party,
      isIncumbent: c.is_incumbent,
      status: c.status,
      source: c.source,
      cashOnHand: c.fec_totals?.cash_on_hand ?? null,
    });
  }

  const records = [...seats.values()].sort((a, b) =>
    a.state === b.state ? a.title.localeCompare(b.title) : a.state.localeCompare(b.state)
  );

  if (JSON_MODE) {
    process.stdout.write(
      JSON.stringify({ cycle: CYCLE, generatedAt: new Date().toISOString(), seats: records })
    );
    return;
  }

  console.log(`=== BallotCard Per-Seat Election Snapshot (cycle ${CYCLE}) ===\n`);
  console.log(`${records.length} seats across ${US_STATES.length} states.\n`);

  const byKind = new Map<OfficeKind, SeatRecord[]>();
  for (const r of records) {
    if (!byKind.has(r.kind)) byKind.set(r.kind, []);
    byKind.get(r.kind)!.push(r);
  }

  for (const [kind, seatsOfKind] of byKind) {
    const noIncumbent = seatsOfKind.filter((s) => !s.incumbent).length;
    const estimated = seatsOfKind.filter((s) => s.nextElectionEstimated).length;
    const noCandidates = seatsOfKind.filter((s) => s.candidates.length === 0).length;
    console.log(
      `${kind.padEnd(14)} ${String(seatsOfKind.length).padStart(5)} seats  ` +
        `${String(noIncumbent).padStart(4)} vacant  ` +
        `${String(estimated).padStart(4)} estimated dates  ` +
        `${String(noCandidates).padStart(4)} no ${CYCLE} candidates`
    );
  }

  console.log(`\nRun with --json to emit the full per-seat dataset for diffing over time.`);
}

main();
