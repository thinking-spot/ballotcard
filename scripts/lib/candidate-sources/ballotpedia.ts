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

// Per-state Ballotpedia config. Override `houseFragment` for non-default
// lower-chamber names (Assembly, House of Delegates). Set `senateOnly: true`
// for Nebraska (unicameral; the upper-chamber URL is the only one available).
//
// See docs/ballotpedia-pipeline.md for the full URL pattern and the list of
// states with no 2026 state-leg elections (LA, MS, NJ, VA — skip these).
export type BallotpediaStateConfig = {
  displayName: string;
  /** Lower-chamber URL fragment. Defaults to "House_of_Representatives". */
  houseFragment?: string;
  /** Nebraska only — unicameral, no lower chamber. */
  senateOnly?: boolean;
};

const STATE_NAMES: Record<string, BallotpediaStateConfig> = {
  // Default lower-chamber name ("House of Representatives")
  AL: { displayName: "Alabama" },
  AK: { displayName: "Alaska" },
  AZ: { displayName: "Arizona" },
  AR: { displayName: "Arkansas" },
  CO: { displayName: "Colorado" },
  CT: { displayName: "Connecticut" },
  DE: { displayName: "Delaware" },
  GA: { displayName: "Georgia" },
  HI: { displayName: "Hawaii" },
  ID: { displayName: "Idaho" },
  IL: { displayName: "Illinois" },
  IN: { displayName: "Indiana" },
  IA: { displayName: "Iowa" },
  KS: { displayName: "Kansas" },
  KY: { displayName: "Kentucky" },
  ME: { displayName: "Maine" },
  MA: { displayName: "Massachusetts" },
  MN: { displayName: "Minnesota" },
  MT: { displayName: "Montana" },
  NH: { displayName: "New Hampshire" },
  NM: { displayName: "New Mexico" },
  ND: { displayName: "North Dakota" },
  OH: { displayName: "Ohio" },
  OK: { displayName: "Oklahoma" },
  OR: { displayName: "Oregon" },
  RI: { displayName: "Rhode Island" },
  SC: { displayName: "South Carolina" },
  SD: { displayName: "South Dakota" },
  TN: { displayName: "Tennessee" },
  TX: { displayName: "Texas" },
  UT: { displayName: "Utah" },
  VT: { displayName: "Vermont" },
  WA: { displayName: "Washington" },
  WY: { displayName: "Wyoming" },

  // "State Assembly" lower chamber
  CA: { displayName: "California", houseFragment: "State_Assembly" },
  NV: { displayName: "Nevada", houseFragment: "State_Assembly" },
  NY: { displayName: "New York", houseFragment: "State_Assembly" },
  WI: { displayName: "Wisconsin", houseFragment: "State_Assembly" },

  // "House of Delegates" lower chamber
  MD: { displayName: "Maryland", houseFragment: "House_of_Delegates" },
  WV: { displayName: "West Virginia", houseFragment: "House_of_Delegates" },

  // Unicameral — only state-senate URL is published
  NE: { displayName: "Nebraska", senateOnly: true },

  // Intentionally absent: FL/MO/NC/PA/MI (have primary SoS scrapers);
  // LA/MS/NJ/VA (no 2026 state-leg elections); MI/VA/etc see docs.
};

/** Build the canonical Ballotpedia URL for a state's chamber elections. */
export function ballotpediaUrl(
  state: string,
  chamber: "state-senate" | "state-house",
  cycle: number
): string {
  const cfg = STATE_NAMES[state.toUpperCase()];
  if (!cfg) {
    throw new Error(`Ballotpedia: no state-name mapping for ${state}`);
  }
  const slug = cfg.displayName.replace(/\s+/g, "_");
  const chamberPath =
    chamber === "state-senate"
      ? "State_Senate"
      : cfg.houseFragment ?? "House_of_Representatives";
  return `https://ballotpedia.org/${slug}_${chamberPath}_elections,_${cycle}`;
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

  // Multiple tables can appear on a page (e.g. general + primary). Prefer
  // the general-election table, but fall back to the primary table when
  // general is unpopulated. States with late primaries (NH Sep 8, MA Sep 1,
  // AK Aug 18, etc.) show "Primary results pending" placeholders in their
  // general-election table until the primary runs. The primary table has
  // the full filer list — using it as a fallback gives us the ~complete
  // pre-primary candidate pool.
  const generalTables: typeof tables = [];
  const primaryTables: typeof tables = [];
  for (const table of tables) {
    const caption = table.text.slice(0, 200).toLowerCase();
    if (caption.includes("general election")) generalTables.push(table);
    else if (caption.includes("primary")) primaryTables.push(table);
  }
  // Try general first. If it has zero parsed rows, retry with primary.
  let chosen: typeof tables = generalTables;
  let chosenLabel: "general" | "primary" = "general";
  let parsedAny = false;
  for (const table of chosen) {
    const placeholder = /primary results pending/i.test(table.text);
    if (placeholder) continue;
    parsedAny = true;
    break;
  }
  if (!parsedAny && primaryTables.length > 0) {
    chosen = primaryTables;
    chosenLabel = "primary";
  }

  for (const table of chosen) {
    if (chosenLabel === "general" && /primary results pending/i.test(table.text)) {
      continue;
    }

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

          const extraRefs: Record<string, string> = {};
          if (c.isIncumbent) extraRefs.bp_incumbent = "true";
          if (chosenLabel === "primary") extraRefs.bp_table = "primary";

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
            status: otherIsWriteIn
              ? "Write-in"
              : chosenLabel === "primary"
              ? "Primary filed"
              : "Filed",
            cycle,
            electionDate,
            externalId: `${chamber}-${district}-${party
              .toLowerCase()
              .replace(/[^a-z]+/g, "")}-${c.name.toLowerCase().replace(/[^a-z]+/g, "-")}`,
            extraRefs: Object.keys(extraRefs).length > 0 ? extraRefs : undefined,
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
 * Fetch + parse a state's chamber page from Ballotpedia. Retries with
 * backoff on rate-limit signals (HTTP 202 with empty body, HTTP 429) —
 * Ballotpedia returns 202+empty when their Cloudflare layer wants to
 * throw a JS challenge that plain fetch can't satisfy. A short wait
 * usually clears it.
 */
export async function fetchBallotpediaChamber(
  state: string,
  chamber: "state-senate" | "state-house",
  cycle: number
): Promise<ScrapedCandidate[]> {
  const url = ballotpediaUrl(state, chamber, cycle);
  const MAX_ATTEMPTS = 4;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const res = await fetch(url, {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(30_000),
    });
    // 404 is terminal — page doesn't exist for this cycle/state.
    if (res.status === 404) {
      throw new Error(`Ballotpedia ${state} ${chamber}: HTTP 404`);
    }
    const html = await res.text();
    const rateLimited =
      res.status === 429 || (res.status === 202 && html.length < 100);
    if (res.ok && !rateLimited && html.length > 1000) {
      return parseBallotpediaCandidatePage(html, state, chamber, cycle);
    }
    if (attempt < MAX_ATTEMPTS) {
      // Exponential backoff with jitter: 500ms, 1500ms, 3500ms.
      const wait = 500 * Math.pow(2, attempt - 1) + Math.floor(attempt * 100);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    throw new Error(
      `Ballotpedia ${state} ${chamber}: rate-limited after ${MAX_ATTEMPTS} attempts (status ${res.status}, ${html.length} bytes)`
    );
  }
  return [];
}

/**
 * Convenience: fetch both chambers for a state and concatenate. Honors
 * senateOnly (Nebraska's unicameral) by skipping the house fetch.
 *
 * Per-chamber failures (404 / parse error) are logged and treated as zero
 * rows so one chamber being absent doesn't kill the other.
 */
export async function fetchBallotpediaState(
  state: string,
  cycle: number
): Promise<ScrapedCandidate[]> {
  const cfg = STATE_NAMES[state.toUpperCase()];
  if (!cfg) throw new Error(`Ballotpedia: no state-name mapping for ${state}`);

  const senate = await fetchBallotpediaChamber(state, "state-senate", cycle).catch(
    (e) => {
      console.error(`  Ballotpedia ${state} senate: ${(e as Error).message}`);
      return [] as ScrapedCandidate[];
    }
  );
  const house = cfg.senateOnly
    ? ([] as ScrapedCandidate[])
    : await fetchBallotpediaChamber(state, "state-house", cycle).catch((e) => {
        console.error(`  Ballotpedia ${state} house: ${(e as Error).message}`);
        return [] as ScrapedCandidate[];
      });
  return [...senate, ...house];
}

/** Expose the registry so the orchestrator/index can iterate eligible states. */
export const BALLOTPEDIA_STATES = STATE_NAMES;
