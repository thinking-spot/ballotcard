// Per-seat election-year resolution for staggered chambers, derived from
// candidate filings.
//
// legislature-schedule.json can only speak chamber-level: a staggered 4-year
// senate is stamped estimated=true on every seat (rendered "2026 or 2028")
// because our roster source (OpenStates bulk) carries no per-seat class data.
// Candidate filings are seat-level facts, though: a seat with a qualifying
// filing for the chamber's next general IS on that ballot, whatever the
// chamber-wide prior says. This module derives the flag per seat:
//
//   next_election_estimated = staggered chamber AND no qualifying filing
//
// It is deterministic in both directions — a seat whose filings disappear
// (withdrawals, a source correction) honestly reverts to estimated — and runs
// after ingest Phase 6 (which re-stamps the chamber schedule) and after every
// candidate scrape, so the flags converge no matter which cron ran last.
//
// Seats without filings keep the chamber-wide date + estimated=true: absence
// of filings is absence of evidence, not proof of an off-cycle seat, because
// scrape coverage varies by state. Only the positive inference is stored.

import legislatureSchedule from "../../seed-data/legislature-schedule.json";
import { isOnUpcomingBallot } from "../../src/lib/candidate-filters";

export type SeatRow = {
  id: string;
  slug: string; // "state-senate" | "state-house"
  state: string;
  next_election_estimated: boolean;
  // The office row's current exact-or-chamber-wide date. Only ingest Phase 6
  // writes this column; this module never does. Used as a lockstep check —
  // see computeStaggeredResolution.
  next_election_at: string | null;
};

export type FilingRow = {
  office_id: string;
  cycle: number;
  status?: string | null;
};

/** Staggered chambers ("STATE::office-slug") → the cycle a filing must match. */
export function staggeredCycles(): Map<string, number> {
  const m = new Map<string, number>();
  for (const row of legislatureSchedule.states) {
    if (row.senate.estimated) {
      m.set(`${row.state}::state-senate`, Number(row.senate.nextElection.slice(0, 4)));
    }
    if (row.house.estimated) {
      m.set(`${row.state}::state-house`, Number(row.house.nextElection.slice(0, 4)));
    }
  }
  return m;
}

export type ComputeOpts = {
  // Circuit breaker: reverting a seat is the dangerous direction — it
  // degrades an exact, user-visible date back to "2026 or 2028". A handful of
  // legitimate reverts (a seat's only filer withdraws) is normal; a run that
  // wants to revert a lot of seats at once is the signature of upstream data
  // loss (a partial/failed scrape wiping a state's filings — see
  // scrape-candidates.ts), not a wave of real seats leaving their races
  // simultaneously. Resolving is the safe direction (only added on positive
  // evidence) and is never guarded.
  maxReverts?: number;
};

/**
 * Decide which seats change flag. Pure — exported for tests.
 *
 * A seat resolves (estimated → exact) when it has at least one filing for its
 * chamber's cycle that passes isOnUpcomingBallot (withdrawn / did-not-qualify
 * rows prove nothing). A resolved seat reverts when its filings are gone.
 * Seats outside staggered chambers are never touched.
 *
 * Lockstep guard: a seat is only touched when its own next_election_at year
 * matches the chamber's currently-scheduled cycle. Only ingest Phase 6 writes
 * next_election_at (from the same seed this module reads); if the seed rolls
 * to a new cycle on a run where Phase 6 hasn't executed yet (e.g. the weekly
 * scrape-only cron), this module would otherwise mark seats "exact" against a
 * date the office row doesn't have yet, or mass-revert everything because the
 * new cycle has no filings. Skipping mismatched seats leaves them untouched
 * until a full ingest catches the date up — self-healing, never wrong.
 */
export function computeStaggeredResolution(
  seats: SeatRow[],
  filings: FilingRow[],
  cycles: Map<string, number>,
  opts: ComputeOpts = {}
): {
  resolveIds: string[];
  revertIds: string[];
  seatsWithFilings: number;
  lockstepMismatches: number;
  guardTripped: boolean;
} {
  const { maxReverts = 10 } = opts;

  const cycleBySeat = new Map<string, number>();
  for (const s of seats) {
    const cycle = cycles.get(`${s.state}::${s.slug}`);
    if (cycle !== undefined) cycleBySeat.set(s.id, cycle);
  }

  const hasFiling = new Set<string>();
  for (const f of filings) {
    if (cycleBySeat.get(f.office_id) === f.cycle && isOnUpcomingBallot(f)) {
      hasFiling.add(f.office_id);
    }
  }

  let lockstepMismatches = 0;
  const resolveIds: string[] = [];
  const revertIds: string[] = [];
  for (const s of seats) {
    const cycle = cycleBySeat.get(s.id);
    if (cycle === undefined) continue; // not in a staggered chamber

    const seatYear = s.next_election_at ? Number(s.next_election_at.slice(0, 4)) : undefined;
    if (seatYear !== cycle) {
      lockstepMismatches++;
      continue;
    }

    const estimated = !hasFiling.has(s.id);
    if (estimated === s.next_election_estimated) continue; // already correct
    (estimated ? revertIds : resolveIds).push(s.id);
  }

  const guardTripped = revertIds.length > maxReverts;
  return {
    resolveIds,
    revertIds: guardTripped ? [] : revertIds,
    seatsWithFilings: hasFiling.size,
    lockstepMismatches,
    guardTripped,
  };
}

export type StaggeredResolutionResult = {
  staggeredSeats: number;
  seatsWithFilings: number;
  resolved: number;
  reverted: number;
  lockstepMismatches: number;
  guardTripped: boolean;
};

/**
 * Load seats + filings from Supabase, compute the resolution, and apply it.
 * The db client is imported lazily so tests can import the pure helpers above
 * without Supabase env vars configured.
 */
export async function resolveStaggeredSeats(
  opts: { dryRun?: boolean; log?: (msg: string) => void; maxReverts?: number } = {}
): Promise<StaggeredResolutionResult> {
  const { dryRun = false, log = (m: string) => console.log(`[staggered] ${m}`), maxReverts } =
    opts;
  const { db } = await import("./supabase-client");

  const cycles = staggeredCycles();

  // All state-leg seats with their state, via the district join. Paginated —
  // PostgREST caps selects at 1000 rows. Ordered so page boundaries are
  // stable across requests (Postgres gives no order without ORDER BY, and a
  // concurrent write between pages can otherwise skip or duplicate rows).
  const seats: SeatRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("Offices")
      .select("id, slug, next_election_estimated, next_election_at, Districts!inner(state)")
      .in("slug", ["state-senate", "state-house"])
      .order("id")
      .range(from, from + 999);
    if (error) throw new Error(`staggered: offices load failed: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const r of data as unknown as Array<{
      id: string;
      slug: string;
      next_election_estimated: boolean;
      next_election_at: string | null;
      Districts: { state: string | null };
    }>) {
      if (!r.Districts?.state) continue;
      seats.push({
        id: r.id,
        slug: r.slug,
        state: r.Districts.state,
        next_election_estimated: r.next_election_estimated,
        next_election_at: r.next_election_at,
      });
    }
    if (data.length < 1000) break;
  }
  const staggered = seats.filter((s) => cycles.has(`${s.state}::${s.slug}`));

  // Filings for the staggered cycles. Fetched by cycle and filtered in memory —
  // an .in("office_id", ~1000 ids) filter would blow the PostgREST URL limit.
  const staggeredIds = new Set(staggered.map((s) => s.id));
  const wantedCycles = [...new Set(cycles.values())];
  const filings: FilingRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("Candidates")
      .select("office_id, cycle, status")
      .in("cycle", wantedCycles)
      .order("id")
      .range(from, from + 999);
    if (error) throw new Error(`staggered: candidates load failed: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const r of data as FilingRow[]) {
      if (staggeredIds.has(r.office_id)) filings.push(r);
    }
    if (data.length < 1000) break;
  }

  const { resolveIds, revertIds, seatsWithFilings, lockstepMismatches, guardTripped } =
    computeStaggeredResolution(staggered, filings, cycles, { maxReverts });
  log(
    `${staggered.length} seats in staggered chambers; ${seatsWithFilings} have qualifying filings; ` +
      `${resolveIds.length} to resolve → exact, ${revertIds.length} to revert → estimated` +
      (lockstepMismatches > 0 ? `; ${lockstepMismatches} skipped (schedule/date lockstep mismatch — will self-heal after the next ingest)` : "")
  );
  if (guardTripped) {
    log(
      `WARNING: revert guard tripped — more than ${maxReverts ?? 10} seats would have reverted ` +
        `to estimated in one run. This usually means a candidate scrape lost data (partial ` +
        `delete/insert failure), not that seats genuinely left their races. Reverts were SKIPPED ` +
        `this run; investigate the source data before re-running.`
    );
  }

  if (!dryRun) {
    for (const [ids, value] of [
      [resolveIds, false],
      [revertIds, true],
    ] as const) {
      for (let i = 0; i < ids.length; i += 100) {
        const chunk = ids.slice(i, i + 100);
        const { error } = await db
          .from("Offices")
          .update({ next_election_estimated: value })
          .in("id", chunk);
        if (error) throw new Error(`staggered: flag update failed: ${error.message}`);
      }
    }
    if (resolveIds.length + revertIds.length > 0) {
      log(`updated ${resolveIds.length + revertIds.length} seats`);
    }
  }

  return {
    staggeredSeats: staggered.length,
    seatsWithFilings,
    resolved: resolveIds.length,
    reverted: revertIds.length,
    lockstepMismatches,
    guardTripped,
  };
}
