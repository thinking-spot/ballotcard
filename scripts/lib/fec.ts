// FEC API candidate fetcher (api.open.fec.gov, free .gov, requires a DATA.gov key).
// Federal candidates only — President (P), Senate (S), House (H).

import { toDisplayCase } from "./name-case";

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

// Normalize an FEC candidate name to "First [M.] Last [Suffix]".
//   "ROUZER, DAVID"          → "David Rouzer"
//   "ABU-GHAZALAH, MAAD"     → "Maad Abu-Ghazalah"
//   "JACKSON, JEFFREY R"     → "Jeffrey R. Jackson"   (initials get a period)
//   "CARTER, JOHN R REP."    → "John R. Carter"       (honorific stripped)
//   "DOWELL, STEVEN CLAY JR" → "Steven Clay Dowell Jr." (suffix moved to end)
//   "HAMDEN, RAYMOND H II"   → "Raymond H. Hamden II"
// Casing (Mc/Mac, O', hyphens, particles) is delegated to toDisplayCase; this
// function owns the FEC-specific structure: comma flip, honorific stripping,
// suffix relocation, and single-letter initial dotting. Exported for tests.
const HONORIFICS = new Set(["DR", "MR", "MRS", "MS", "MISS", "HON", "REP", "SEN", "REV"]);
const SUFFIXES: Record<string, string> = {
  JR: "Jr.", SR: "Sr.", II: "II", III: "III", IV: "IV", V: "V",
};
// Strip punctuation and upper-case a token for set/map lookups ("Rep." → "REP").
const bare = (t: string) => t.replace(/[.,]/g, "").toUpperCase();
// "R" → "R.", but leave real words and existing "R." untouched.
const dotInitials = (s: string) =>
  s
    .split(" ")
    .map((t) => (/^[A-Za-z]$/.test(t) ? `${t}.` : t))
    .join(" ");

export function normalizeName(raw: string): string {
  const comma = raw.indexOf(",");

  if (comma === -1) {
    const tokens = raw
      .trim()
      .split(/\s+/)
      .filter((t) => t && !HONORIFICS.has(bare(t)));
    return dotInitials(toDisplayCase(tokens.join(" ")));
  }

  const last = raw.slice(0, comma).trim();
  const rest = raw
    .slice(comma + 1)
    .trim()
    .split(/\s+/)
    .filter((t) => t && !HONORIFICS.has(bare(t)));

  // Peel trailing generational suffixes (keep at least one given-name token).
  const suffixes: string[] = [];
  while (rest.length > 1 && SUFFIXES[bare(rest[rest.length - 1])]) {
    suffixes.unshift(SUFFIXES[bare(rest.pop()!)]);
  }

  const given = dotInitials(toDisplayCase(rest.join(" ")));
  const surname = toDisplayCase(last);
  return [given, surname, ...suffixes].filter(Boolean).join(" ").trim();
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
