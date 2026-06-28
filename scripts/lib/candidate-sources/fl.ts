// Florida — Division of Elections candidate-tracking system.
//
// Source: https://dos.elections.myflorida.com/candidates/downloadcanlist.asp
//   POSTs to extractCanList.asp with elecID + office=LEG + cantype=STA, returns
//   a tab-delimited file with one row per candidate. Stable since well before
//   2016 — same columns, same office codes.
//
// Office codes in the feed: STR = State Representative (state House),
// STS = State Senator. We map those to BallotCard's "state-house" / "state-
// senate" office slugs. The district number lives in Juris1num.
//
// The endpoint sits behind a Cloudflare "managed" challenge — a realistic
// browser User-Agent + Accept headers pass the challenge from a plain HTTPS
// request (no JS exec needed). If FL ever tightens this, fall back to a
// headless browser fetcher.

import type { ScrapedCandidate } from "./types";

const FL_EXTRACT_URL =
  "https://dos.elections.myflorida.com/candidates/extractCanList.asp";

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
  Referer: "https://dos.elections.myflorida.com/candidates/downloadcanlist.asp",
};

// Map a four-digit cycle to FL's election ID. The general election in even
// years is YYYY1103-GEN (always the November date). For 2026 specifically the
// form lists 20261103-GEN.
function flElectionId(cycle: number): string {
  // FL's election dates so far: 2024-11-05, 2026-11-03, 2028-11-07, 2030-11-05.
  // We keep a small lookup rather than computing — the off-by-a-day variations
  // are too easy to get wrong.
  const known: Record<number, string> = {
    2024: "20241105-GEN",
    2026: "20261103-GEN",
    2028: "20281107-GEN",
    2030: "20301105-GEN",
  };
  const id = known[cycle];
  if (!id) throw new Error(`FL: no known election ID for cycle ${cycle}`);
  return id;
}

const FL_GENERAL_DATE: Record<number, string> = {
  2024: "2024-11-05",
  2026: "2026-11-03",
  2028: "2028-11-07",
  2030: "2030-11-05",
};

// FL office codes → BallotCard office slugs.
const OFFICE_SLUG: Record<string, ScrapedCandidate["officeSlug"]> = {
  STR: "state-house",
  STS: "state-senate",
};

/**
 * Fetch FL state-legislative candidates for one general-election cycle and
 * return them normalized. Includes ALL statuses (Qualified, Withdrew, etc.) —
 * the orchestrator decides what to surface; withdrawn candidates still belong
 * in the historical record.
 */
export async function fetchFloridaStateLegCandidates(
  cycle: number
): Promise<ScrapedCandidate[]> {
  const body = new URLSearchParams({
    elecID: flElectionId(cycle),
    office: "LEG",
    status: "All",
    cantype: "STA",
    FormSubmit: "Download Candidate List",
  });

  const res = await fetch(FL_EXTRACT_URL, {
    method: "POST",
    headers: {
      ...BROWSER_HEADERS,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    throw new Error(`FL extract returned ${res.status}`);
  }
  const text = await res.text();
  return parseFloridaCandidateTsv(text, cycle);
}

/**
 * Pure parser — split out from the fetch so tests can exercise the shape
 * without hitting the network. The TSV has a header row; tab is `\t`; values
 * are not quoted (so a value containing a literal tab would break — FL has
 * never produced one in practice).
 */
export function parseFloridaCandidateTsv(
  tsv: string,
  cycle: number
): ScrapedCandidate[] {
  const lines = tsv.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length === 0) return [];

  const header = lines[0].split("\t");
  const col = (name: string) => header.indexOf(name);
  const iAcct = col("AcctNum");
  const iVoter = col("VoterID");
  const iOffice = col("OfficeCode");
  const iDistrict = col("Juris1num");
  const iStatus = col("StatusDesc");
  const iParty = col("PartyDesc");
  const iLast = col("NameLast");
  const iFirst = col("NameFirst");
  const iMiddle = col("NameMiddle");
  const iEmail = col("Email");
  const iCity = col("City");
  const iCounty = col("County");
  const iPhone = col("Phone");

  if (iAcct < 0 || iOffice < 0 || iDistrict < 0 || iLast < 0) {
    throw new Error("FL TSV missing expected columns — schema may have changed");
  }

  const electionDate = FL_GENERAL_DATE[cycle];
  const out: ScrapedCandidate[] = [];

  for (let i = 1; i < lines.length; i++) {
    const f = lines[i].split("\t");
    const officeCode = f[iOffice]?.trim();
    const slug = OFFICE_SLUG[officeCode];
    if (!slug) continue; // FED / CAB / JUD / SPD slip through if office=LEG widens

    const districtRaw = f[iDistrict]?.trim();
    // FL pads to three digits ("055"); our slug convention is unpadded.
    const district = String(parseInt(districtRaw, 10));
    if (!district || district === "NaN") continue;

    const last = (f[iLast] ?? "").trim();
    const first = (f[iFirst] ?? "").trim();
    const middle = (f[iMiddle] ?? "").trim();
    const name = [first, middle, last].filter(Boolean).join(" ");
    if (!name) continue;

    const extraRefs: Record<string, string> = {};
    const voter = (f[iVoter] ?? "").trim();
    if (voter && voter !== "0") extraRefs.fl_voter_id = voter;
    const email = (f[iEmail] ?? "").trim();
    if (email) extraRefs.email = email;
    const phone = (f[iPhone] ?? "").trim();
    if (phone) extraRefs.phone = phone;
    const city = (f[iCity] ?? "").trim();
    if (city) extraRefs.city = city;
    const county = (f[iCounty] ?? "").trim();
    if (county) extraRefs.county = county;

    out.push({
      source: "fl_sos",
      state: "FL",
      officeSlug: slug,
      district,
      name,
      party: (f[iParty] ?? "").trim() || undefined,
      status: (f[iStatus] ?? "").trim() || undefined,
      cycle,
      electionDate,
      externalId: f[iAcct].trim(),
      extraRefs: Object.keys(extraRefs).length > 0 ? extraRefs : undefined,
    });
  }

  return out;
}
