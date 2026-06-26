import { describe, it, expect } from "vitest";
import {
  dedupeByHighestReceipts,
  type FecCandidateTotals,
} from "../fec-totals";

const t = (
  candidateId: string,
  receipts: number,
  disbursements = 0,
  coverageEndDate?: string
): FecCandidateTotals => ({
  candidateId,
  receipts,
  disbursements,
  coverageEndDate,
});

describe("dedupeByHighestReceipts", () => {
  it("collapses duplicate candidate_id rows to one", () => {
    const r = dedupeByHighestReceipts([
      t("H2NC07096", 1_000_000),
      t("H2NC07096", 1_500_000),
    ]);
    expect(r).toHaveLength(1);
    expect(r[0].receipts).toBe(1_500_000);
  });

  it("keeps the row with the highest receipts (most recent cumulative report)", () => {
    const r = dedupeByHighestReceipts([
      t("H2NC07096", 500_000, 0, "2025-12-31"),
      t("H2NC07096", 1_538_563, 968_178, "2026-03-31"),
      t("H2NC07096", 1_200_000, 0, "2025-09-30"),
    ]);
    expect(r).toHaveLength(1);
    expect(r[0].receipts).toBe(1_538_563);
    expect(r[0].disbursements).toBe(968_178);
    expect(r[0].coverageEndDate).toBe("2026-03-31");
  });

  it("preserves distinct candidates", () => {
    const r = dedupeByHighestReceipts([
      t("H2NC07096", 1_500_000),
      t("H6CA12055", 12_643_779),
      t("S8NY00132", 4_068_879),
    ]);
    expect(r).toHaveLength(3);
    const ids = r.map((x) => x.candidateId).sort();
    expect(ids).toEqual(["H2NC07096", "H6CA12055", "S8NY00132"]);
  });

  it("handles an empty input", () => {
    expect(dedupeByHighestReceipts([])).toEqual([]);
  });
});
