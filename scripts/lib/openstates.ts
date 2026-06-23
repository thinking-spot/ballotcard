// Open States bulk people CSV fetcher + parser.
// Source: https://data.openstates.org/people/current/{state}.csv (free, public domain).

import type { OpenStatesPerson } from "./types";

const BASE = "https://data.openstates.org/people/current";

/** Minimal RFC-4180-ish CSV parser: handles quoted fields with commas/newlines. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c === "\r") {
      // ignore
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** Fetch + parse the current legislators for one state. Returns [] on 404. */
export async function fetchOpenStatesPeople(
  stateAbbr: string
): Promise<OpenStatesPerson[]> {
  const url = `${BASE}/${stateAbbr.toLowerCase()}.csv`;
  const res = await fetch(url);
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`OpenStates ${stateAbbr} fetch failed: ${res.status}`);

  const rows = parseCsv(await res.text());
  if (rows.length < 2) return [];

  const header = rows[0];
  const idx = (name: string) => header.indexOf(name);
  const iId = idx("id");
  const iName = idx("name");
  const iParty = idx("current_party");
  const iDistrict = idx("current_district");
  const iChamber = idx("current_chamber");
  const iImage = idx("image");

  const people: OpenStatesPerson[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row[iId]) continue;
    const chamber = row[iChamber];
    if (chamber !== "upper" && chamber !== "lower") continue;
    people.push({
      id: row[iId],
      name: row[iName] ?? "",
      current_party: row[iParty] ?? "",
      current_district: row[iDistrict] ?? "",
      current_chamber: chamber,
      image: row[iImage] ?? "",
    });
  }
  return people;
}
