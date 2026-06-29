// Pennsylvania — Department of State "Official Candidate Listing".
//
// Source: https://www.pavoterservices.pa.gov/ElectionInfo/FooterLinkReport.aspx?ID={N}
//   The DoS publishes the qualified-candidate roster as a single HTML page
//   per election cycle, with the candidate data stored as JSON inside hidden
//   <input> elements named "ElectionOfficeNdataJson". One hidden input per
//   office group (Governor, Senator in the General Assembly, etc.). Each
//   value holds a JSON array of candidate records with Office, District,
//   Party, Candidate Name, Ballot Position, and a few other fields.
//
// 2026 cycle = report ID 1410. Cycle → report-ID mapping is not stable
// across years; new IDs need to be discovered each cycle (PA's URL scheme
// uses sequential integer IDs without a documented index page).
//
// Office mappings:
//   "SENATOR IN THE GENERAL ASSEMBLY"     → state-senate
//   "REPRESENTATIVE IN THE GENERAL ASSEMBLY" → state-house
//   "REPRESENTATIVE IN CONGRESS"          → us-house
//   "GOVERNOR" / "LIEUTENANT GOVERNOR"    → ignored (no office slug yet)
//   "MEMBER OF * STATE COMMITTEE"         → ignored (party internal)
//
// District format: ordinal English ("1st Congressional District", "12th
// Senatorial District", "203rd Legislative District") — strip the suffix.

import type { ScrapedCandidate } from "./types";
import { toDisplayCase } from "../name-case";

const URL_TEMPLATE = (reportId: string) =>
  `https://www.pavoterservices.pa.gov/ElectionInfo/FooterLinkReport.aspx?ID=${reportId}`;

const REPORT_ID_BY_CYCLE: Record<number, string> = {
  2026: "1410",
};

const GENERAL_DATE: Record<number, string> = {
  2026: "2026-11-03",
};

// PA office name → our office slug. Anything not in this map is ignored
// (Governor, Lt Gov, state-committee internal elections, etc.).
const OFFICE_SLUG: Record<string, ScrapedCandidate["officeSlug"]> = {
  "SENATOR IN THE GENERAL ASSEMBLY": "state-senate",
  "REPRESENTATIVE IN THE GENERAL ASSEMBLY": "state-house",
  "REPRESENTATIVE IN CONGRESS": "us-house",
};

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
};

/** Strip the English ordinal suffix from "1st", "12th", "203rd" → "1", "12", "203". */
function ordinalToNumber(s: string): string | null {
  const m = s.trim().match(/^(\d+)(?:st|nd|rd|th)$/i);
  return m ? m[1] : null;
}

/** Parse "12th Senatorial District" → "12"; "203rd Legislative District" → "203". */
function districtNumberFrom(districtField: string): string | null {
  const m = districtField.match(
    /^(\d+(?:st|nd|rd|th))\s+(Senatorial|Legislative|Congressional)\s+District$/i
  );
  if (!m) return null;
  return ordinalToNumber(m[1]);
}

type PaCandidateRow = {
  Office?: string;
  District?: string;
  Party?: string;
  "Candidate Name"?: string;
  CandidateNumber?: string;
  "Ballot Position"?: number;
  Link2?: string;
};

/**
 * Parse PA's candidate-roster HTML into normalized rows. Pure — no network.
 *
 * Walks every `ElectionOfficeNdataJson` hidden input, JSON-parses its value,
 * filters to the office slugs we cover, and emits one ScrapedCandidate per
 * row.
 */
export function parsePaCandidateHtml(
  html: string,
  cycle: number
): ScrapedCandidate[] {
  const blobs = [
    ...html.matchAll(
      /ElectionOffice\d+dataJson['"]\s+type=['"]hidden['"]\s+value=['"](\[.*?\])['"]/g
    ),
  ];
  const out: ScrapedCandidate[] = [];
  const electionDate = GENERAL_DATE[cycle];

  for (const m of blobs) {
    let rows: PaCandidateRow[];
    try {
      rows = JSON.parse(m[1]);
    } catch {
      continue; // a malformed blob shouldn't kill the whole run
    }
    for (const r of rows) {
      const officeRaw = (r.Office ?? "").trim();
      const officeSlug = OFFICE_SLUG[officeRaw];
      if (!officeSlug) continue;

      const district = districtNumberFrom(r.District ?? "");
      if (!district) continue;

      // PA publishes names in ALL CAPS; normalize to display case. The synthetic
      // externalId below lowercases the name, so it is unaffected by this change.
      const name = toDisplayCase((r["Candidate Name"] ?? "").trim());
      if (!name) continue;

      const externalId =
        (r.CandidateNumber ?? "").trim() ||
        // Fall back to a synthetic stable key when PA hasn't issued a number.
        `${officeSlug}-${district}-${(r.Party ?? "")
          .toLowerCase()
          .replace(/[^a-z]+/g, "")}-${name.toLowerCase().replace(/[^a-z]+/g, "-")}`;

      const extraRefs: Record<string, string> = {};
      if (typeof r["Ballot Position"] === "number") {
        extraRefs.pa_ballot_position = String(r["Ballot Position"]);
      }
      if (r.Link2) extraRefs.pa_profile_url = r.Link2;

      out.push({
        source: "pa_sos",
        state: "PA",
        officeSlug,
        district,
        name,
        party: (r.Party ?? "").trim() || undefined,
        status: "Filed", // PA publishes only qualified filers in this report
        cycle,
        electionDate,
        externalId,
        extraRefs: Object.keys(extraRefs).length > 0 ? extraRefs : undefined,
      });
    }
  }
  return out;
}

/** Fetch PA's candidate roster for the cycle and parse it. */
export async function fetchPennsylvaniaCandidates(
  cycle: number
): Promise<ScrapedCandidate[]> {
  const reportId = REPORT_ID_BY_CYCLE[cycle];
  if (!reportId) throw new Error(`PA: no report ID for cycle ${cycle}`);

  const res = await fetch(URL_TEMPLATE(reportId), {
    headers: BROWSER_HEADERS,
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`PA roster returned ${res.status}`);
  const html = await res.text();
  return parsePaCandidateHtml(html, cycle);
}
