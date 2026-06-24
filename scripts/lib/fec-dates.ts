// FEC API /election-dates/ fetcher.
// Returns the primary (and runoff, when applicable) election date for each
// state × office_type in a given cycle. The general election is uniform
// (first Tuesday after first Monday in November) and is already on Offices
// as `next_election_at` — this adds the more interesting primary date.

const BASE = "https://api.open.fec.gov/v1/election-dates/";

export type FecElectionDate = {
  state: string; // two-letter
  office: "P" | "S" | "H";
  /** "primary" | "runoff" | other — caller decides what to use. */
  type: string;
  date: string; // YYYY-MM-DD
};

/**
 * Fetch all election dates for a cycle. Paginates internally and returns the
 * flat list. The API caps page_size at 100; 2026 has ~98 entries total.
 */
export async function fetchFecElectionDates(
  cycle: number,
  apiKey: string
): Promise<FecElectionDate[]> {
  const out: FecElectionDate[] = [];
  let page = 1;
  let pages = 1;
  while (page <= pages) {
    const url = new URL(BASE);
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("election_year", String(cycle));
    url.searchParams.set("per_page", "100");
    url.searchParams.set("page", String(page));
    const res = await fetch(url);
    if (!res.ok) throw new Error(`FEC election-dates failed: ${res.status}`);
    const json = (await res.json()) as {
      results: Array<Record<string, unknown>>;
      pagination: { pages: number };
    };
    pages = json.pagination?.pages ?? 1;
    for (const r of json.results) {
      const state = String(r.election_state ?? "").trim();
      const office = String(r.office_sought ?? "").trim();
      const type = String(r.election_type_full ?? "").toLowerCase();
      const date = String(r.election_date ?? "").trim();
      if (!state || !office || !date) continue;
      if (office !== "P" && office !== "S" && office !== "H") continue;
      out.push({ state, office, type, date });
    }
    page++;
  }
  return out;
}

/**
 * Reduce a flat list to the *earliest* primary date per (state, office). When
 * a state runs a primary AND a runoff, the primary is the meaningful "first
 * decisive vote" date — that's what voters need to know.
 */
export function earliestPrimaryByStateOffice(
  dates: FecElectionDate[]
): Map<string, string> {
  const out = new Map<string, string>();
  for (const d of dates) {
    if (!d.type.includes("primary")) continue;
    const key = `${d.state}::${d.office}`;
    const existing = out.get(key);
    if (!existing || d.date < existing) out.set(key, d.date);
  }
  return out;
}
