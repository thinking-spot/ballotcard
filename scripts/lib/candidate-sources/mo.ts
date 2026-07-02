// Missouri — Secretary of State candidate filing system.
//
// Source: https://s1.sos.mo.gov/CandidatesOnWeb/
//   No CSV / bulk download / API. Each office gets its own HTML page at
//   DisplayCandidatesPlacement.aspx?OfficeCode=...&ElectionCode=...
//
// Office code format (URL-encoded space = +):
//   "20 SE NN"   State Senate district NN (even NNs in 2026 — staggered)
//   "20 LE NNN"  State Representative district NNN (1..163)
//   "25 CN N"    US House district N
//
// HTML shape per office page:
//   <h3>State Senator - District 8</h3>
//   <table><caption>Republican</caption>
//     <tr><th>Name</th><th>Mailing Address</th><th>Random Number</th><th>Date Filed</th></tr>
//     <tr><td class="NameCol">Jon Patterson</td><td class="AddressCol">...</td><td>195</td><td>2/24/2026</td></tr>
//     ...
//   </table>
//   <table><caption>Democratic</caption>...</table>
//
// One <table> per party. The "Random Number" is MO's ballot-order randomizer
// (each filer draws a number that decides placement on the primary ballot) —
// useful and worth preserving in extraRefs.

import { parse } from "node-html-parser";
import type { ScrapedCandidate } from "./types";

const BASE = "https://s1.sos.mo.gov/CandidatesOnWeb";

// Cycle → ElectionCode for the MO primary that decides the November ballot.
// MO publishes a fresh ElectionCode per cycle; the 2026 primary (Aug 4) is
// 750006905. Keep a small explicit map rather than reverse-engineering — the
// codes don't follow a predictable pattern.
const ELECTION_CODE: Record<number, string> = {
  2026: "750006905",
};

const PRIMARY_DATE: Record<number, string> = {
  2026: "2026-08-04",
};

// election_date carries the November general like every other source (see the
// ScrapedCandidate contract in types.ts); the August primary that this filing
// list feeds is provenance, preserved in extraRefs.primary_date.
const GENERAL_DATE: Record<number, string> = {
  2026: "2026-11-03",
};

// Map MO's chamber prefix → BallotCard office slug.
type MoChamber = { prefix: "SE" | "LE" | "CN"; officeSlug: ScrapedCandidate["officeSlug"] };
const CHAMBERS: MoChamber[] = [
  { prefix: "SE", officeSlug: "state-senate" },
  { prefix: "LE", officeSlug: "state-house" },
  { prefix: "CN", officeSlug: "us-house" },
];

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
};

// Pacing: MO's site is small and tolerant of light scraping, but stay polite.
const CONCURRENCY = 4;
const PER_REQUEST_TIMEOUT_MS = 15_000;

async function fetchOffice(officeCode: string, electionCode: string): Promise<string> {
  // OfficeCode contains spaces; encode for the URL but keep the canonical
  // "20 SE 08" representation for logs and external IDs.
  const url = `${BASE}/DisplayCandidatesPlacement.aspx?OfficeCode=${encodeURIComponent(
    officeCode
  )}&ElectionCode=${electionCode}`;
  const res = await fetch(url, {
    headers: BROWSER_HEADERS,
    signal: AbortSignal.timeout(PER_REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`MO ${officeCode}: HTTP ${res.status}`);
  return res.text();
}

/**
 * Enumerate the office codes for a chamber on a given cycle by scraping the
 * master "List of Offices" page. Cheaper and more truthful than hardcoding
 * district counts — captures off-cycle Senate seats, deleted districts, etc.
 */
async function listOfficeCodes(
  chamber: MoChamber,
  electionCode: string
): Promise<string[]> {
  const url = `${BASE}/default.aspx?ElectionCode=${electionCode}`;
  const res = await fetch(url, {
    headers: BROWSER_HEADERS,
    signal: AbortSignal.timeout(PER_REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`MO office list: HTTP ${res.status}`);
  const html = await res.text();
  // Match "20%20SE%2008" / "20%20LE%20001" / "25%20CN%201" in the listing
  // page's hrefs, then decode back to "20 SE 08".
  const pattern = new RegExp(
    `OfficeCode=([0-9]{2})%20${chamber.prefix}%20([0-9]+)`,
    "g"
  );
  const found = new Set<string>();
  for (const m of html.matchAll(pattern)) {
    found.add(`${m[1]} ${chamber.prefix} ${m[2]}`);
  }
  return [...found].sort();
}

/**
 * Parse a single MO office page into normalized candidate rows. Pure so
 * tests can exercise the HTML shape without hitting the network.
 */
export function parseMoOfficePage(
  html: string,
  officeCode: string,
  officeSlug: ScrapedCandidate["officeSlug"],
  cycle: number
): ScrapedCandidate[] {
  // District number is the trailing token: "20 SE 08" → "08", "25 CN 7" → "7".
  const districtRaw = officeCode.split(/\s+/).pop() ?? "";
  const district = String(parseInt(districtRaw, 10));
  if (!district || district === "NaN") return [];

  // For US House, MO formats district as a single digit; that lines up with
  // BallotCard's CD slug for multi-district states. (MO has 8 CDs, all numeric.)
  // For state-leg, MO pads to 3 digits ("001"); our convention strips to "1".

  const root = parse(html);
  const out: ScrapedCandidate[] = [];

  const tables = root.querySelectorAll("table");
  for (const table of tables) {
    const caption = table.querySelector("caption")?.text?.trim();
    if (!caption) continue; // skip nav / unrelated tables

    // Each candidate row has class="NameCol" on the name td — easy filter.
    const rows = table.querySelectorAll("tr");
    for (const row of rows) {
      const nameCell = row.querySelector("td.NameCol");
      if (!nameCell) continue;
      const name = nameCell.text.trim();
      if (!name) continue;

      const cells = row.querySelectorAll("td");
      // Layout: [NameCol, AddressCol, RandomNumber, DateFiled]
      const addressCell = cells[1];
      const random = cells[2]?.text?.trim();
      const dateFiled = cells[3]?.text?.trim();

      const city = addressCell
        ? addressCell.text
            .replace(/\s+/g, " ")
            .trim()
            .split(/\s+/)
            .slice(-3, -2) // crude "city" guess (last city-state-zip chunk)
            .join(" ")
        : undefined;

      const extraRefs: Record<string, string> = {};
      if (random) extraRefs.mo_random_number = random;
      if (dateFiled) extraRefs.filed_at = dateFiled;
      if (city) extraRefs.city = city;
      if (PRIMARY_DATE[cycle]) extraRefs.primary_date = PRIMARY_DATE[cycle];

      // MO doesn't ship a stable per-candidate ID. Synthesize: officeCode +
      // party + name is unique within an election (no two filers in the same
      // race share a name + party).
      const externalId = [
        officeCode.replace(/\s+/g, "-"),
        caption.toLowerCase().replace(/[^a-z]+/g, ""),
        name.toLowerCase().replace(/[^a-z]+/g, "-"),
      ].join("::");

      out.push({
        source: "mo_sos",
        state: "MO",
        officeSlug,
        district,
        name,
        party: caption,
        status: "Filed", // MO only shows certified filers on this view
        cycle,
        electionDate: GENERAL_DATE[cycle],
        externalId,
        extraRefs: Object.keys(extraRefs).length > 0 ? extraRefs : undefined,
      });
    }
  }
  return out;
}

// Tiny semaphore for polite concurrency over the per-office fetches.
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let i = 0;
  async function worker() {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      results[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/**
 * Fetch all MO state-Senate + state-House + US-House candidates for one
 * cycle. The office codes are enumerated from the SoS listing page, so
 * off-cycle Senate seats simply don't appear.
 */
export async function fetchMissouriCandidates(
  cycle: number,
  chamberPrefixes: Array<"SE" | "LE" | "CN"> = ["SE", "LE", "CN"]
): Promise<ScrapedCandidate[]> {
  const electionCode = ELECTION_CODE[cycle];
  if (!electionCode) throw new Error(`MO: no ElectionCode for cycle ${cycle}`);

  const chambers = CHAMBERS.filter((c) => chamberPrefixes.includes(c.prefix));
  const all: ScrapedCandidate[] = [];

  for (const chamber of chambers) {
    const codes = await listOfficeCodes(chamber, electionCode);
    const pages = await mapLimit(codes, CONCURRENCY, async (code) => {
      const html = await fetchOffice(code, electionCode);
      return parseMoOfficePage(html, code, chamber.officeSlug, cycle);
    });
    for (const list of pages) all.push(...list);
  }
  return all;
}
