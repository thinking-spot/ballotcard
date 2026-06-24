// FEC API /candidates/totals/ list fetcher.
// Pulls aggregated receipts/disbursements per candidate per cycle in bulk,
// which means we get all 3,000+ candidates with just ~37 paginated calls
// instead of one per candidate.

const BASE = "https://api.open.fec.gov/v1/candidates/totals/";

export type FecCandidateTotals = {
  candidateId: string;
  receipts: number;
  disbursements: number;
  coverageEndDate?: string; // YYYY-MM-DD (date of latest filing covered)
};

/**
 * Fetch totals for every candidate in a given office × cycle.
 * Internal pagination; respects FEC's 100-result page cap.
 */
export async function fetchFecCandidateTotals(
  office: "P" | "S" | "H",
  cycle: number,
  apiKey: string
): Promise<FecCandidateTotals[]> {
  const out: FecCandidateTotals[] = [];
  let page = 1;
  let pages = 1;
  while (page <= pages) {
    const url = new URL(BASE);
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("cycle", String(cycle));
    url.searchParams.set("office", office);
    url.searchParams.set("per_page", "100");
    url.searchParams.set("page", String(page));
    url.searchParams.set("sort", "-receipts");
    const res = await fetch(url);
    if (!res.ok) throw new Error(`FEC totals failed: ${res.status}`);
    const json = (await res.json()) as {
      results: Array<Record<string, unknown>>;
      pagination: { pages: number };
    };
    pages = json.pagination?.pages ?? 1;
    for (const r of json.results) {
      const id = String(r.candidate_id ?? "").trim();
      const receipts = Number(r.receipts ?? 0);
      const disbursements = Number(r.disbursements ?? 0);
      const cov = String(r.coverage_end_date ?? "").slice(0, 10);
      if (!id) continue;
      out.push({
        candidateId: id,
        receipts,
        disbursements,
        coverageEndDate: cov || undefined,
      });
    }
    page++;
  }
  // De-dupe by candidate_id — keep the highest receipts row (most recent reporting).
  const byId = new Map<string, FecCandidateTotals>();
  for (const r of out) {
    const existing = byId.get(r.candidateId);
    if (!existing || r.receipts > existing.receipts) byId.set(r.candidateId, r);
  }
  return Array.from(byId.values());
}
