import { describe, it, expect } from "vitest";
import {
  earliestPrimaryByStateOffice,
  type FecElectionDate,
} from "../fec-dates";

const d = (
  state: string,
  office: "P" | "S" | "H",
  type: string,
  date: string
): FecElectionDate => ({ state, office, type, date });

describe("earliestPrimaryByStateOffice", () => {
  it("keeps only primary entries (filters out general/runoff/special)", () => {
    const r = earliestPrimaryByStateOffice([
      d("NC", "H", "primary election", "2026-03-03"),
      d("NC", "H", "general election", "2026-11-03"),
      d("NC", "H", "runoff", "2026-05-12"),
      d("NC", "H", "special general", "2026-09-05"),
    ]);
    expect(r.size).toBe(1);
    expect(r.get("NC::H")).toBe("2026-03-03");
  });

  it("indexes per (state, office) — H and S can differ", () => {
    const r = earliestPrimaryByStateOffice([
      d("LA", "H", "primary election", "2026-08-07"),
      d("LA", "S", "primary election", "2026-05-16"),
    ]);
    expect(r.get("LA::H")).toBe("2026-08-07");
    expect(r.get("LA::S")).toBe("2026-05-16");
  });

  it("picks the earliest when a state has multiple primaries (open primary + runoff structure)", () => {
    const r = earliestPrimaryByStateOffice([
      d("AL", "H", "primary election", "2026-05-19"),
      d("AL", "H", "primary runoff election", "2026-08-11"),
    ]);
    // "runoff" still contains "primary" if labelled "primary runoff", so we
    // need the earlier date — that's the dispositive primary for voters.
    expect(r.get("AL::H")).toBe("2026-05-19");
  });

  it("returns an empty map when no primaries match", () => {
    const r = earliestPrimaryByStateOffice([
      d("NC", "H", "general election", "2026-11-03"),
    ]);
    expect(r.size).toBe(0);
  });

  it("type matching is case-insensitive — fetcher lowercases at ingest", () => {
    // The fetcher lowercases on the way in; the indexer just checks contains.
    const r = earliestPrimaryByStateOffice([
      d("GA", "S", "primary election", "2026-05-19"),
    ]);
    expect(r.get("GA::S")).toBe("2026-05-19");
  });
});
