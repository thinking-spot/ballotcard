// FEC API candidate fetcher (api.open.fec.gov, free .gov, requires a DATA.gov key).
// Federal candidates only — President (P), Senate (S), House (H).

export type FecCandidate = {
  candidateId: string;
  name: string; // normalized "First Last"
  party?: string;
  state: string; // two-letter
  district?: string; // House only, zero-padded ("07"); "00"/"AL" → at-large
  office: "P" | "S" | "H";
  isIncumbent: boolean;
  status?: string;
};

const BASE = "https://api.open.fec.gov/v1/candidates/";

// "ROUZER, DAVID" / "ABU-GHAZALAH, MAAD" → "David Rouzer" / "Maad Abu-Ghazalah".
function normalizeName(raw: string): string {
  const titleCase = (s: string) =>
    s
      .toLowerCase()
      .replace(/\b([a-z])/g, (m) => m.toUpperCase())
      .replace(/\bMc([a-z])/g, (_, c) => "Mc" + c.toUpperCase());

  const HONORIFICS = new Set(["DR", "DR.", "MR", "MR.", "MRS", "MRS.", "MS", "MS."]);
  const comma = raw.indexOf(",");
  if (comma === -1) return titleCase(raw.trim());

  const last = raw.slice(0, comma).trim();
  const rest = raw
    .slice(comma + 1)
    .trim()
    .split(/\s+/)
    .filter((t) => !HONORIFICS.has(t.toUpperCase()))
    .join(" ");
  return titleCase(`${rest} ${last}`.trim());
}

/**
 * Fetch every candidate for an office + cycle, following pagination.
 * `candidate_status=C` limits to statutory candidates (filed for this race).
 */
export async function fetchFecCandidates(
  office: "P" | "S" | "H",
  cycle: number,
  apiKey: string
): Promise<FecCandidate[]> {
  const out: FecCandidate[] = [];
  let page = 1;
  let pages = 1;

  do {
    const url = new URL(BASE);
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("office", office);
    url.searchParams.set("cycle", String(cycle));
    url.searchParams.set("candidate_status", "C");
    url.searchParams.set("per_page", "100");
    url.searchParams.set("page", String(page));
    url.searchParams.set("sort", "name");

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`FEC ${office}/${cycle} page ${page} failed: ${res.status}`);
    }
    const data = (await res.json()) as {
      pagination?: { pages?: number };
      results?: Array<Record<string, unknown>>;
    };
    pages = data.pagination?.pages ?? 1;

    for (const r of data.results ?? []) {
      const district = r.district as string | undefined;
      out.push({
        candidateId: r.candidate_id as string,
        name: normalizeName((r.name as string) ?? ""),
        party: (r.party_full as string) || (r.party as string) || undefined,
        state: (r.state as string) ?? "",
        district:
          office === "H"
            ? district === "00"
              ? "al"
              : district
            : undefined,
        office,
        isIncumbent: (r.incumbent_challenge_full as string) === "Incumbent",
        status: (r.candidate_status as string) || undefined,
      });
    }
    page++;
  } while (page <= pages);

  return out;
}
