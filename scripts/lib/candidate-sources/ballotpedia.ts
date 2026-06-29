// Ballotpedia — fallback source for states whose official SoS endpoints are
// inaccessible to plain HTTPS scraping (Akamai-protected: OH, GA, others).
//
// Ballotpedia publishes a structured candidate roster per state per chamber
// at predictable URLs:
//   https://ballotpedia.org/{State}_House_of_Representatives_elections,_{year}
//   https://ballotpedia.org/{State}_State_Senate_elections,_{year}
//
// Inside each page is a <table class="wikitable sortable collapsible
// candidateListTablePartisan"> with columns: Office | Democratic |
// Republican | Other. Each row is one district. Candidate names live in
// <span class="candidate"><a>Name</a></span> with optional "(i)" suffix
// for incumbents and party annotations like "(Independent)" or "(Write-in)"
// in the Other column.
//
// IMPORTANT — sourcing & licensing:
//   - Ballotpedia text is CC-BY-SA 3.0. We ingest the underlying facts
//     (name, party, district, incumbency) which under Feist v. Rural
//     Telephone are not copyrightable in the US — only Ballotpedia's
//     expression of them is.
//   - We DON'T copy their prose, analysis, biographies, or commentary —
//     just the public-record facts.
//   - We attribute Ballotpedia at render time when this source backs a row
//     (e.g. a "Data via Ballotpedia" footnote). The orchestrator records
//     source="{state}_ballotpedia" so the UI can branch on it.
//   - Use ONLY for states where the primary SoS source is unreachable. If
//     OH/GA SoS sites ever become scrapable, prefer the primary source.

import { parse } from "node-html-parser";
import type { ScrapedCandidate } from "./types";

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
};

const GENERAL_DATE: Record<number, string> = {
  2026: "2026-11-03",
  2028: "2028-11-07",
};

// State-name slug used in Ballotpedia URLs. "New_Hampshire", "North_Carolina".
const STATE_NAMES: Record<string, string> = {
  OH: "Ohio",
  GA: "Georgia",
  // Add others as needed when the SoS primary path is unavailable.
};

/** Build the canonical Ballotpedia URL for a state's chamber elections. */
export function ballotpediaUrl(
  state: string,
  chamber: "state-senate" | "state-house",
  cycle: number
): string {
  const stateName = STATE_NAMES[state.toUpperCase()];
  if (!stateName) {
    throw new Error(`Ballotpedia: no state-name mapping for ${state}`);
  }
  const slug = stateName.replace(/\s+/g, "_");
  const chamberPath =
    chamber === "state-senate"
      ? "State_Senate"
      : "House_of_Representatives"; // both OH and GA use this name
  return `https://ballotpedia.org/${slug}_${chamberPath}_elections,${cycle}`.replace(
    /,(\d)/,
    ",_$1"
  );
}

type ParsedCandidate = {
  name: string;
  isIncumbent: boolean;
  /** Optional party annotation from the "Other" column ("Libertarian", "Write-in"). */
  altParty?: string;
};

/**
 * Extract candidates from one party-column cell. Each candidate is one
 * <span class="candidate"><a>Name</a></span> followed by optional " (i)"
 * for incumbents. The cell may contain multiple candidates (primary races).
 *
 * Returns an array — empty when the cell has no candidate (no filer that
 * party in that race).
 */
function parsePartyCell(cellHtml: string): ParsedCandidate[] {
  // Use a regex on the cell's HTML — node-html-parser's text() collapses
  // the "(i)" marker away from the name in some cases. Working on the raw
  // HTML is more reliable.
  const out: ParsedCandidate[] = [];
  // After the candidate link Ballotpedia may insert:
  //   - "&#160;" (non-breaking space entity)
  //   - the Candidate Connection survey icon (an <a><img/></a>)
  //   - more whitespace/entities
  // ...before the optional "(i)" incumbent flag. We allow any non-tag,
  // non-"(" filler in that gap so the (i) marker is captured reliably.
  const re =
    /<span class="candidate"><a[^>]*>([^<]+)<\/a>(?:<[^>]+>(?:<[^>]+>)*)*[^<(]*(\(i\))?/g;
  for (const m of cellHtml.matchAll(re)) {
    const name = m[1].trim();
    if (!name) continue;
    out.push({ name, isIncumbent: !!m[2] });
  }
  // Some "Other" cells have free-text candidates like "Eboney Eldridge
  // (Independent) (Write-in)" — extract those too when the span pattern
  // missed them but a candidate link is present.
  if (out.length === 0) {
    const linkMatch = cellHtml.match(/<a[^>]+>([A-Z][A-Za-z'\-.\s]+?)<\/a>/);
    if (linkMatch) {
      out.push({ name: linkMatch[1].replace(/\s+/g, " ").trim(), isIncumbent: false });
    }
  }
  return out;
}

/** Pull the alternate-party annotation from the "Other" cell text. */
function parseOtherAnnotation(cellText: string): string | undefined {
  const m = cellText.match(
    /\((Independent|Libertarian Party|Libertarian|Green Party|Green|Constitution Party|Constitution|Working Class|Natural Law|No Party Affiliation)\)/i
  );
  return m ? m[1] : undefined;
}

/**
 * Parse a Ballotpedia state-chamber election page into normalized rows.
 *
 * Pure — tests exercise the parser against captured HTML without network.
 */
export function parseBallotpediaCandidatePage(
  html: string,
  state: string,
  chamber: "state-senate" | "state-house",
  cycle: number
): ScrapedCandidate[] {
  const root = parse(html);
  const tables = root.querySelectorAll("table.candidateListTablePartisan");
  if (tables.length === 0) return [];

  const electionDate = GENERAL_DATE[cycle];
  const sourceLabel = `${state.toLowerCase()}_ballotpedia`;
  const out: ScrapedCandidate[] = [];

  // Multiple tables can appear on a page (e.g. general + primary). Take the
  // first one with the "general election" header — that's the post-primary
  // qualified-candidate roster.
  for (const table of tables) {
    const caption = table.text.slice(0, 200).toLowerCase();
    if (!caption.includes("general election")) continue;

    const rows = table.querySelectorAll("tr");
    for (const row of rows) {
      const cells = row.querySelectorAll("td");
      if (cells.length < 4) continue;

      // Office cell: "District N "
      const officeText = cells[0].text.trim();
      const districtMatch = officeText.match(/^District\s+(\d+)/i);
      if (!districtMatch) continue;
      const district = districtMatch[1];

      const partyCells: Array<{ partyLabel: string; html: string }> = [
        { partyLabel: "Democratic", html: cells[1].innerHTML },
        { partyLabel: "Republican", html: cells[2].innerHTML },
        { partyLabel: "Other", html: cells[3].innerHTML },
      ];

      for (const pc of partyCells) {
        const cands = parsePartyCell(pc.html);
        const altParty =
          pc.partyLabel === "Other" ? parseOtherAnnotation(cells[3].text) : undefined;
        const otherIsWriteIn =
          pc.partyLabel === "Other" && /\(Write-in\)/i.test(cells[3].text);

        for (const c of cands) {
          const party =
            pc.partyLabel === "Other" ? altParty ?? "Independent" : pc.partyLabel;

          out.push({
            source: sourceLabel,
            state: state.toUpperCase(),
            officeSlug: chamber,
            district,
            name: c.name,
            party,
            // is_incumbent is captured but stored via the orchestrator's
            // matcher against current officeholders — we still pass the
            // Ballotpedia (i) hint via status when present.
            status: otherIsWriteIn ? "Write-in" : "Filed",
            cycle,
            electionDate,
            externalId: `${chamber}-${district}-${party
              .toLowerCase()
              .replace(/[^a-z]+/g, "")}-${c.name.toLowerCase().replace(/[^a-z]+/g, "-")}`,
            extraRefs: c.isIncumbent ? { bp_incumbent: "true" } : undefined,
          });
        }
      }
    }
    // Only the first matching "general election" table — don't re-process.
    break;
  }
  return out;
}

/**
 * Fetch + parse a state's chamber page from Ballotpedia.
 */
export async function fetchBallotpediaChamber(
  state: string,
  chamber: "state-senate" | "state-house",
  cycle: number
): Promise<ScrapedCandidate[]> {
  const url = ballotpediaUrl(state, chamber, cycle);
  const res = await fetch(url, {
    headers: BROWSER_HEADERS,
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Ballotpedia ${state} ${chamber}: HTTP ${res.status}`);
  const html = await res.text();
  return parseBallotpediaCandidatePage(html, state, chamber, cycle);
}

/**
 * Convenience: fetch both chambers for a state and concatenate.
 */
export async function fetchBallotpediaState(
  state: string,
  cycle: number
): Promise<ScrapedCandidate[]> {
  const [senate, house] = await Promise.all([
    fetchBallotpediaChamber(state, "state-senate", cycle).catch((e) => {
      console.error(`  Ballotpedia ${state} senate: ${(e as Error).message}`);
      return [];
    }),
    fetchBallotpediaChamber(state, "state-house", cycle).catch((e) => {
      console.error(`  Ballotpedia ${state} house: ${(e as Error).message}`);
      return [];
    }),
  ]);
  return [...senate, ...house];
}
