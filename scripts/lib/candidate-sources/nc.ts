// North Carolina — State Board of Elections (NCSBE) candidate filings.
//
// Source: https://s3.amazonaws.com/dl.ncsbe.gov/Elections/{YYYY}/Candidate%20Filing/Candidate_Listing_{YYYY}.csv
//   Single bulk CSV, updated daily, public (no auth). One row per candidate
//   per county — statewide races (US Senate, Council of State) repeat across
//   100 counties so we dedupe on (contest, name_on_ballot).
//
// Contest names we care about (everything else — county boards, school boards,
// soil & water districts — is below state-leg and out of scope for now):
//   "US SENATE"                              → us-senate-class-{ii|iii} (cycle-dependent)
//   "US HOUSE OF REPRESENTATIVES DISTRICT N" → us-house, district N
//   "NC SENATE DISTRICT NN"                  → state-senate, district NN
//   "NC HOUSE OF REPRESENTATIVES DISTRICT NNN" → state-house, district NNN

import type { ScrapedCandidate } from "./types";

const URL_TEMPLATE = (cycle: number) =>
  `https://s3.amazonaws.com/dl.ncsbe.gov/Elections/${cycle}/Candidate%20Filing/Candidate_Listing_${cycle}.csv`;

const GENERAL_DATE: Record<number, string> = {
  2026: "2026-11-03",
  2028: "2028-11-07",
};

// US Senate class up for election in each cycle. NC's two senators are Class
// II (Tillis seat, 2026) and Class III (Budd seat, 2028).
const US_SENATE_CLASS: Record<number, string> = {
  2026: "us-senate-class-ii",
  2028: "us-senate-class-iii",
};

/**
 * Parse the NCSBE candidate-filing CSV. Pure — no network.
 */
export function parseNcCandidateCsv(
  csv: string,
  cycle: number
): ScrapedCandidate[] {
  const lines = splitCsvLines(csv);
  if (lines.length === 0) return [];

  const header = parseCsvRow(lines[0]);
  const col = (name: string) => header.indexOf(name);
  const iContest = col("contest_name");
  const iName = col("name_on_ballot");
  const iParty = col("party_candidate");
  const iCandidacy = col("candidacy_dt");
  const iEmail = col("email");
  const iCity = col("city");
  if (iContest < 0 || iName < 0 || iParty < 0) {
    throw new Error("NC CSV missing expected columns — schema may have changed");
  }

  const electionDate = GENERAL_DATE[cycle];
  const senateSlug = US_SENATE_CLASS[cycle];

  // De-dup per (contest, name) — the CSV lists one row per county for
  // statewide races, so US Senate candidates appear ~100x each.
  const seen = new Set<string>();
  const out: ScrapedCandidate[] = [];

  for (let i = 1; i < lines.length; i++) {
    const f = parseCsvRow(lines[i]);
    const contest = (f[iContest] ?? "").trim();
    if (!contest) continue;

    const slugInfo = classifyContest(contest, senateSlug);
    if (!slugInfo) continue; // not a chamber we cover

    const name = (f[iName] ?? "").trim();
    if (!name) continue;

    const dedupKey = `${contest}::${name}`;
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);

    const extraRefs: Record<string, string> = {};
    const candidacyDt = (f[iCandidacy] ?? "").trim();
    if (candidacyDt) extraRefs.filed_at = candidacyDt;
    const email = (f[iEmail] ?? "").trim();
    if (email) extraRefs.email = email;
    const city = (f[iCity] ?? "").trim();
    if (city) extraRefs.city = city;

    // No stable per-candidate ID in the NC feed — synthesize from
    // contest + name. Stable across runs because both sides are normalized.
    const externalId = `${slugInfo.officeSlug}-${slugInfo.district}::${normalize(
      name
    )}`;

    out.push({
      source: "nc_sos",
      state: "NC",
      officeSlug: slugInfo.officeSlug,
      district: slugInfo.district,
      name,
      party: expandPartyCode((f[iParty] ?? "").trim()),
      status: "Filed",
      cycle,
      electionDate,
      externalId,
      extraRefs: Object.keys(extraRefs).length > 0 ? extraRefs : undefined,
    });
  }

  return out;
}

type Classified = { officeSlug: ScrapedCandidate["officeSlug"]; district: string };

function classifyContest(
  contest: string,
  senateSlug: string | undefined
): Classified | null {
  if (contest === "US SENATE") {
    if (!senateSlug) return null;
    // US Senate is a statewide office, no district — store as "0" because the
    // orchestrator's slug-builder ignores it for us-senate-class-* slugs.
    return { officeSlug: senateSlug as Classified["officeSlug"], district: "0" };
  }
  const usHouse = contest.match(/^US HOUSE OF REPRESENTATIVES DISTRICT (\d+)$/i);
  if (usHouse) return { officeSlug: "us-house", district: String(parseInt(usHouse[1], 10)) };
  // NC publishes state Senate as "NC STATE SENATE DISTRICT NN" but the older
  // "NC SENATE DISTRICT NN" form has appeared in past cycles — accept both.
  const ncSen = contest.match(/^NC (?:STATE )?SENATE DISTRICT (\d+)$/i);
  if (ncSen) return { officeSlug: "state-senate", district: String(parseInt(ncSen[1], 10)) };
  const ncHouse = contest.match(/^NC HOUSE OF REPRESENTATIVES DISTRICT (\d+)$/i);
  if (ncHouse) return { officeSlug: "state-house", district: String(parseInt(ncHouse[1], 10)) };
  return null;
}

// NC encodes parties as 3-letter codes (REP, DEM, LIB, GRE, NLB, CST, UNA).
// Expand to display labels so the chamber UI shows "Republican" not "REP".
const PARTY_LABELS: Record<string, string> = {
  REP: "Republican",
  DEM: "Democratic",
  LIB: "Libertarian",
  GRE: "Green",
  NLB: "No Labels",
  CST: "Constitution",
  UNA: "Unaffiliated",
};

function expandPartyCode(code: string): string | undefined {
  if (!code) return undefined;
  return PARTY_LABELS[code.toUpperCase()] ?? code;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

// ─── CSV parsing ──────────────────────────────────────────────────────────────
// NC's CSV uses standard RFC-4180 quoting (fields wrapped in ", "" escapes a ",
// newlines INSIDE a field are kept by the writer). Implement a small parser —
// pulling in a CSV dep for one source is overkill.

/** Split a CSV blob into logical rows, honoring quoted newlines. */
function splitCsvLines(csv: string): string[] {
  const rows: string[] = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    if (ch === '"') {
      // toggle, but `""` (escaped quote) stays inside the quoted state
      if (inQuote && csv[i + 1] === '"') {
        cur += '""';
        i++;
        continue;
      }
      inQuote = !inQuote;
      cur += ch;
      continue;
    }
    if (!inQuote && (ch === "\n" || ch === "\r")) {
      if (cur.length > 0) rows.push(cur);
      cur = "";
      // swallow paired \r\n
      if (ch === "\r" && csv[i + 1] === "\n") i++;
      continue;
    }
    cur += ch;
  }
  if (cur.length > 0) rows.push(cur);
  return rows;
}

/** Parse one CSV row into its fields. Handles quoted values + escaped quotes. */
function parseCsvRow(row: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (ch === '"') {
      if (inQuote && row[i + 1] === '"') {
        cur += '"';
        i++;
        continue;
      }
      inQuote = !inQuote;
      continue;
    }
    if (!inQuote && ch === ",") {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

/**
 * Fetch + parse NC's 2026 candidate listing. Bulk CSV — single HTTPS call.
 */
export async function fetchNorthCarolinaCandidates(
  cycle: number
): Promise<ScrapedCandidate[]> {
  const url = URL_TEMPLATE(cycle);
  const res = await fetch(url, {
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`NC CSV returned ${res.status}`);
  const csv = await res.text();
  return parseNcCandidateCsv(csv, cycle);
}
