// Michigan — Bureau of Elections (BOE) qualified candidate roster.
//
// Source: https://mi-boe.entellitrak.com/etk-mi-boe-prod/page.request.do
//   ?page=page.miboePublicReport&electionType=PRI&electionYear=2026
//
// Returns a ~1MB JasperReports HTML page. Each office×district section is
// announced by an <a id="..."> anchor whose ID encodes both the office and
// the district, e.g.
//
//   "1st_District_State_Senator_4_Year_Term__1__Position_Files_In_WAYNE_County"
//   "12th_District_Representative_in_State_Legislature_2_Year_Term__1__Position_Files_In_OAKLAND_County"
//   "7th_District_Representative_in_Congress_2_Year_Term__1__Position_Files_In_OAKLAND_County"
//
// Between two consecutive anchors, candidate rows appear as deeply-nested
// <td>/<span> cells in positional order: party, name (LAST, FIRST), address,
// date filed, fee/petition type. Regex parsing is more reliable than DOM
// traversal here — JasperReports breaks every cell across many empty spacer
// <td>s, so a CSS selector approach is brittle.
//
// Multi-county districts repeat their anchor under each county the seat
// touches. Dedup on (district, party, name) collapses these to one row.

import type { ScrapedCandidate } from "./types";

const URL_TEMPLATE = (cycle: number) =>
  `https://mi-boe.entellitrak.com/etk-mi-boe-prod/page.request.do?page=page.miboePublicReport&electionType=PRI&electionYear=${cycle}`;

const GENERAL_DATE: Record<number, string> = {
  2026: "2026-11-03",
  2028: "2028-11-07",
};

const PRIMARY_DATE: Record<number, string> = {
  2026: "2026-08-04",
  2028: "2028-08-04",
};

// MI's two US Senate seats: Class II = 2026 (Slotkin's seat), Class I = 2030.
// (MI's Class III seat — Peters — is up 2028.)
const US_SENATE_CLASS: Record<number, string> = {
  2026: "us-senate-class-ii",
  2028: "us-senate-class-iii",
};

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
};

const PARTIES = [
  "Democratic",
  "Republican",
  "Libertarian",
  "US Taxpayers",
  "Working Class",
  "Green",
  "Natural Law",
  "Independent",
  "No Party Affiliation",
];

// MI office anchor signatures → BallotCard office slug. The anchor IDs use
// underscore-joined English so the substring match is enough.
function officeSlugFromAnchor(
  anchorId: string,
  cycle: number
): ScrapedCandidate["officeSlug"] | null {
  const a = anchorId.toLowerCase();
  if (a.includes("state_senator")) return "state-senate";
  if (a.includes("representative_in_state_legislature")) return "state-house";
  if (a.includes("representative_in_congress")) return "us-house";
  if (a.includes("united_states_senator")) {
    return (US_SENATE_CLASS[cycle] ?? null) as ScrapedCandidate["officeSlug"] | null;
  }
  return null;
}

/** Strip "1st"/"12th"/"203rd" → "1"/"12"/"203". */
function ordinalToNumber(ord: string): string | null {
  const m = ord.match(/^(\d+)(?:st|nd|rd|th)$/i);
  return m ? m[1] : null;
}

type AnchorMatch = {
  anchorId: string;
  district: string;
  officeSlug: ScrapedCandidate["officeSlug"];
  start: number; // index AFTER the anchor tag
  end?: number; // set in second pass
};

/**
 * Find every office×district anchor in the page and compute the byte range
 * containing its candidate rows (up to the next anchor or end of document).
 */
function findOfficeSections(html: string, cycle: number): AnchorMatch[] {
  // <a id="1st_District_State_Senator_4_Year_Term__1__Position_Files_In_WAYNE_County"></a>
  const re = /<a\s+id="(\d+(?:st|nd|rd|th))_District_([^"]+)"><\/a>/gi;
  const found: AnchorMatch[] = [];
  for (const m of html.matchAll(re)) {
    const ord = m[1];
    const rest = m[2];
    const district = ordinalToNumber(ord);
    if (!district) continue;
    const officeSlug = officeSlugFromAnchor(rest, cycle);
    if (!officeSlug) continue;
    found.push({
      anchorId: `${ord}_District_${rest}`,
      district,
      officeSlug,
      start: m.index! + m[0].length,
    });
  }
  // Compute end = next anchor's start, or end of document for the last.
  for (let i = 0; i < found.length; i++) {
    found[i].end = i + 1 < found.length ? found[found.length === i + 1 ? i : i + 1].start : html.length;
    // The line above is incorrect for the middle; fix:
    found[i].end = i + 1 < found.length ? found[i + 1].start : html.length;
  }
  return found;
}

/** Pull (party, name) pairs out of a slice of MI HTML using the cell pattern. */
function extractCandidates(section: string): Array<{ party: string; name: string; filedAt?: string }> {
  // Build alternation of known parties. Add lookahead to ensure we don't
  // gobble across non-candidate spans.
  const partyAlt = PARTIES.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const re = new RegExp(
    `>(${partyAlt})\\s*</span>` + // party label
      `[\\s\\S]{0,400}?` + // jasper spacer cells
      `>([A-Z][A-Za-z'\\-]+,\\s+[A-Z][A-Za-z'\\-.\\s]+?)\\s*</span>` + // "Last, First [Middle]"
      `[\\s\\S]{0,1200}?` + // address + spacers
      `>(\\d{1,2}/\\d{1,2}/\\d{4})\\s*</span>`, // filing date
    "g"
  );
  const out: Array<{ party: string; name: string; filedAt?: string }> = [];
  for (const m of section.matchAll(re)) {
    out.push({ party: m[1].trim(), name: m[2].trim(), filedAt: m[3].trim() });
  }
  return out;
}

/** Convert MI's "Last, First Middle" → "First Middle Last" for display. */
function flipName(s: string): string {
  const m = s.match(/^([^,]+),\s+(.+?)\s*$/);
  if (!m) return s.trim();
  const last = m[1].trim();
  const rest = m[2].replace(/\s+/g, " ").trim();
  return `${rest} ${last}`;
}

/**
 * Parse MI's BOE report HTML into normalized candidate rows.
 *
 * Pure — tests exercise the shape without hitting the network.
 */
export function parseMiCandidateHtml(
  html: string,
  cycle: number
): ScrapedCandidate[] {
  const sections = findOfficeSections(html, cycle);
  const electionDate = GENERAL_DATE[cycle];
  const primaryDate = PRIMARY_DATE[cycle];

  // dedupKey = (officeSlug, district, party, name) — collapses multi-county
  // repeats of the same seat.
  const seen = new Set<string>();
  const out: ScrapedCandidate[] = [];

  for (const sec of sections) {
    const slice = html.slice(sec.start, sec.end);
    const cands = extractCandidates(slice);
    for (const c of cands) {
      const flipped = flipName(c.name);
      const dedupKey = `${sec.officeSlug}::${sec.district}::${c.party}::${flipped.toLowerCase()}`;
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);

      const extraRefs: Record<string, string> = {};
      if (c.filedAt) extraRefs.filed_at = c.filedAt;
      if (primaryDate) extraRefs.primary_date = primaryDate;
      // Synthesize a stable per-candidate ID — MI's report doesn't ship a
      // CandidateNumber.
      const externalId = `${sec.officeSlug}-${sec.district}-${c.party
        .toLowerCase()
        .replace(/[^a-z]+/g, "")}-${flipped.toLowerCase().replace(/[^a-z]+/g, "-")}`;

      out.push({
        source: "mi_sos",
        state: "MI",
        officeSlug: sec.officeSlug,
        district: sec.district,
        name: flipped,
        party: c.party,
        status: "Filed",
        cycle,
        electionDate,
        externalId,
        extraRefs: Object.keys(extraRefs).length > 0 ? extraRefs : undefined,
      });
    }
  }

  return out;
}

/** Fetch + parse MI BOE candidate roster for the cycle. */
export async function fetchMichiganCandidates(
  cycle: number
): Promise<ScrapedCandidate[]> {
  const res = await fetch(URL_TEMPLATE(cycle), {
    headers: BROWSER_HEADERS,
    signal: AbortSignal.timeout(45_000), // 1MB page, ~3-5s on warm cache
  });
  if (!res.ok) throw new Error(`MI BOE returned ${res.status}`);
  const html = await res.text();
  return parseMiCandidateHtml(html, cycle);
}
