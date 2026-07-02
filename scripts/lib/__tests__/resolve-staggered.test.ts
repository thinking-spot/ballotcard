import { describe, it, expect } from "vitest";
import {
  computeStaggeredResolution,
  staggeredCycles,
  type SeatRow,
  type FilingRow,
} from "../resolve-staggered";

const CYCLES = new Map([
  ["PA::state-senate", 2026],
  ["ND::state-house", 2026],
]);

const seat = (id: string, over: Partial<SeatRow> = {}): SeatRow => ({
  id,
  slug: "state-senate",
  state: "PA",
  next_election_estimated: true,
  next_election_at: "2026-11-03", // matches CYCLES' PA senate / ND house cycle
  ...over,
});

const filing = (office_id: string, over: Partial<FilingRow> = {}): FilingRow => ({
  office_id,
  cycle: 2026,
  status: "Filed",
  ...over,
});

describe("computeStaggeredResolution", () => {
  it("resolves an estimated seat that has a qualifying filing", () => {
    const r = computeStaggeredResolution([seat("a")], [filing("a")], CYCLES);
    expect(r.resolveIds).toEqual(["a"]);
    expect(r.revertIds).toEqual([]);
    expect(r.seatsWithFilings).toBe(1);
  });

  it("leaves an estimated seat estimated when it has no filings", () => {
    const r = computeStaggeredResolution([seat("a")], [], CYCLES);
    expect(r.resolveIds).toEqual([]);
    expect(r.revertIds).toEqual([]);
  });

  it("ignores filings from a different cycle", () => {
    const r = computeStaggeredResolution(
      [seat("a")],
      [filing("a", { cycle: 2028 })],
      CYCLES
    );
    expect(r.resolveIds).toEqual([]);
  });

  it("ignores withdrawn / did-not-qualify filings", () => {
    const r = computeStaggeredResolution(
      [seat("a")],
      [filing("a", { status: "Withdrew" }), filing("a", { status: "Did Not Qualify" })],
      CYCLES
    );
    expect(r.resolveIds).toEqual([]);
    expect(r.seatsWithFilings).toBe(0);
  });

  it("counts 'Primary filed' and missing status as qualifying", () => {
    const r = computeStaggeredResolution(
      [seat("a"), seat("b")],
      [filing("a", { status: "Primary filed" }), filing("b", { status: null })],
      CYCLES
    );
    expect(r.resolveIds.sort()).toEqual(["a", "b"]);
  });

  it("reverts a resolved seat whose filings disappeared", () => {
    const r = computeStaggeredResolution(
      [seat("a", { next_election_estimated: false })],
      [],
      CYCLES
    );
    expect(r.revertIds).toEqual(["a"]);
    expect(r.resolveIds).toEqual([]);
  });

  it("never touches seats outside staggered chambers", () => {
    const exactChamber = [
      seat("a", { state: "AZ" }), // AZ senate not in CYCLES
      seat("b", { slug: "state-house" }), // PA house not in CYCLES
    ];
    const r = computeStaggeredResolution(
      exactChamber,
      [filing("a"), filing("b")],
      CYCLES
    );
    expect(r.resolveIds).toEqual([]);
    expect(r.revertIds).toEqual([]);
    expect(r.seatsWithFilings).toBe(0);
  });

  it("is a no-op when flags already match the evidence", () => {
    const r = computeStaggeredResolution(
      [seat("a", { next_election_estimated: false }), seat("b")],
      [filing("a")],
      CYCLES
    );
    expect(r.resolveIds).toEqual([]);
    expect(r.revertIds).toEqual([]);
  });

  it("handles the ND house (staggered lower chamber) too", () => {
    const r = computeStaggeredResolution(
      [seat("a", { state: "ND", slug: "state-house" })],
      [filing("a")],
      CYCLES
    );
    expect(r.resolveIds).toEqual(["a"]);
  });

  describe("lockstep guard (next_election_at vs. schedule cycle)", () => {
    it("does not resolve a seat whose next_election_at hasn't caught up to the schedule cycle", () => {
      // Seed says 2026, but the office row is still stamped with a stale/older
      // year — only ingest Phase 6 advances it, and hasn't run yet this cycle.
      const r = computeStaggeredResolution(
        [seat("a", { next_election_at: "2028-11-07" })],
        [filing("a")],
        CYCLES
      );
      expect(r.resolveIds).toEqual([]);
      expect(r.revertIds).toEqual([]);
      expect(r.lockstepMismatches).toBe(1);
    });

    it("does not revert a seat with a mismatched date, even with zero filings", () => {
      const r = computeStaggeredResolution(
        [seat("a", { next_election_estimated: false, next_election_at: "2028-11-07" })],
        [],
        CYCLES
      );
      expect(r.revertIds).toEqual([]);
      expect(r.lockstepMismatches).toBe(1);
    });

    it("treats a null next_election_at as a mismatch, not a pass-through", () => {
      const r = computeStaggeredResolution(
        [seat("a", { next_election_at: null })],
        [filing("a")],
        CYCLES
      );
      expect(r.resolveIds).toEqual([]);
      expect(r.lockstepMismatches).toBe(1);
    });

    it("resolves normally once next_election_at matches the schedule cycle", () => {
      const r = computeStaggeredResolution(
        [seat("a", { next_election_at: "2026-11-03" })],
        [filing("a")],
        CYCLES
      );
      expect(r.resolveIds).toEqual(["a"]);
      expect(r.lockstepMismatches).toBe(0);
    });
  });

  describe("mass-revert circuit breaker", () => {
    it("skips applying reverts when the count exceeds maxReverts, and reports guardTripped", () => {
      const seats = Array.from({ length: 15 }, (_, i) =>
        seat(`s${i}`, { next_election_estimated: false })
      );
      const r = computeStaggeredResolution(seats, [], CYCLES, { maxReverts: 10 });
      expect(r.revertIds).toEqual([]);
      expect(r.guardTripped).toBe(true);
    });

    it("applies reverts normally when the count is at or below maxReverts", () => {
      const seats = Array.from({ length: 10 }, (_, i) =>
        seat(`s${i}`, { next_election_estimated: false })
      );
      const r = computeStaggeredResolution(seats, [], CYCLES, { maxReverts: 10 });
      expect(r.revertIds).toHaveLength(10);
      expect(r.guardTripped).toBe(false);
    });

    it("never guards resolves, only reverts", () => {
      const seats = Array.from({ length: 15 }, (_, i) => seat(`s${i}`));
      const filings = seats.map((s) => filing(s.id));
      const r = computeStaggeredResolution(seats, filings, CYCLES, { maxReverts: 10 });
      expect(r.resolveIds).toHaveLength(15);
      expect(r.guardTripped).toBe(false);
    });
  });
});

describe("staggeredCycles", () => {
  it("derives staggered chambers from the schedule seed", () => {
    const m = staggeredCycles();
    // Staggered 4-year senates carry the estimated flag.
    expect(m.get("PA::state-senate")).toBe(2026);
    expect(m.get("TX::state-senate")).toBe(2026);
    // ND's house is the one staggered lower chamber (with NE's dead entry).
    expect(m.get("ND::state-house")).toBe(2026);
    // 2-year and whole-chamber senates are exact, not staggered.
    expect(m.has("AZ::state-senate")).toBe(false);
    expect(m.has("AL::state-senate")).toBe(false);
    // Ordinary 2-year houses are exact.
    expect(m.has("PA::state-house")).toBe(false);
  });
});
