// Server-side proxy to the US Census Geocoder.
// Privacy: the address is sent to the .gov geocoder and the response is reduced
// to district identifiers. The address itself is NEVER stored or logged.
// The geocoder has no CORS, which conveniently forces this server-side shape.

const GEOCODER_BASE = "https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress";
const BENCHMARK = "Public_AR_Current";
const VINTAGE = "Current_Current";

// Two-letter state code by FIPS, for building geo_slugs from GEOIDs.
const STATE_FIPS_TO_CODE: Record<string, string> = {
  "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO",
  "09": "CT", "10": "DE", "11": "DC", "12": "FL", "13": "GA", "15": "HI",
  "16": "ID", "17": "IL", "18": "IN", "19": "IA", "20": "KS", "21": "KY",
  "22": "LA", "23": "ME", "24": "MD", "25": "MA", "26": "MI", "27": "MN",
  "28": "MS", "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH",
  "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND", "39": "OH",
  "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD",
  "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA",
  "54": "WV", "55": "WI", "56": "WY",
};

export type ResolvedGeographies = {
  state?: { code: string; name: string; fips: string };
  county?: { name: string; geoid: string };
  place?: { name: string; geoid: string };
  congressionalDistrict?: { number: string; geoid: string };
  stateLegislativeUpper?: { number: string; geoid: string };
  stateLegislativeLower?: { number: string; geoid: string };
};

type GeographyEntry = Record<string, unknown>;

/**
 * The geocoder returns layer keys that are vintage-prefixed and change over
 * time (e.g. "119th Congressional Districts", "2024 State Legislative Districts
 * - Upper"). Match by substring rather than exact key so we survive re-vintaging.
 */
function findLayer(
  geographies: Record<string, GeographyEntry[]>,
  ...needles: string[]
): GeographyEntry | undefined {
  for (const [key, entries] of Object.entries(geographies)) {
    const lower = key.toLowerCase();
    if (needles.every((n) => lower.includes(n.toLowerCase())) && entries?.length) {
      return entries[0];
    }
  }
  return undefined;
}

function str(entry: GeographyEntry | undefined, field: string): string | undefined {
  const v = entry?.[field];
  return typeof v === "string" ? v : undefined;
}

/**
 * Resolve a free-text US address to its district geographies.
 * Returns null when the geocoder finds no match. NEVER logs the address.
 */
export async function resolveAddress(
  address: string
): Promise<ResolvedGeographies | null> {
  const url = new URL(GEOCODER_BASE);
  url.searchParams.set("address", address);
  url.searchParams.set("benchmark", BENCHMARK);
  url.searchParams.set("vintage", VINTAGE);
  url.searchParams.set("format", "json");

  const res = await fetch(url, {
    // Census data is stable; cache the geocoder response edge-side by URL.
    // (The URL contains the address, but it never reaches our logs or storage.)
    next: { revalidate: 60 * 60 * 24 },
  });

  if (!res.ok) {
    throw new Error(`Geocoder returned ${res.status}`);
  }

  const data = (await res.json()) as {
    result?: { addressMatches?: Array<{ geographies?: Record<string, GeographyEntry[]> }> };
  };

  const match = data.result?.addressMatches?.[0];
  if (!match?.geographies) return null;

  return parseGeographies(match.geographies);
}

/**
 * Reduce a Census geocoder `geographies` object to our district identifiers.
 * Pure (no network) so it can be unit-tested against captured fixtures.
 */
export function parseGeographies(
  g: Record<string, GeographyEntry[]>
): ResolvedGeographies | null {
  const stateEntry = findLayer(g, "states");
  const countyEntry = findLayer(g, "counties");
  const placeEntry = findLayer(g, "incorporated places");
  const cdEntry = findLayer(g, "congressional districts");
  const sluEntry = findLayer(g, "state legislative districts", "upper");
  const sldEntry = findLayer(g, "state legislative districts", "lower");

  const stateFips = str(stateEntry, "STATE") ?? str(stateEntry, "GEOID");
  const stateCode = stateFips ? STATE_FIPS_TO_CODE[stateFips] : undefined;

  const result: ResolvedGeographies = {};

  if (stateCode && stateFips) {
    result.state = {
      code: stateCode,
      name: str(stateEntry, "NAME") ?? stateCode,
      fips: stateFips,
    };
  }

  if (countyEntry) {
    result.county = {
      name: str(countyEntry, "NAME") ?? "",
      geoid: str(countyEntry, "GEOID") ?? "",
    };
  }

  if (placeEntry) {
    result.place = {
      name: str(placeEntry, "NAME") ?? "",
      geoid: str(placeEntry, "GEOID") ?? "",
    };
  }

  if (cdEntry) {
    // CD GEOID is state FIPS (2) + district (2), e.g. 3707 → NC-07.
    // "00" denotes an at-large seat, which our slugs render as "al".
    const geoid = str(cdEntry, "GEOID") ?? "";
    const tail = geoid.slice(2);
    result.congressionalDistrict = {
      number: tail === "00" ? "al" : tail,
      geoid,
    };
  }

  // State-leg GEOIDs are zero-padded (e.g. 37008). Strip leading zeros so the
  // value matches Open States district labels and our slug convention.
  const sldNumber = (geoid: string) => String(parseInt(geoid.slice(2), 10) || geoid.slice(2));

  if (sluEntry) {
    const geoid = str(sluEntry, "GEOID") ?? "";
    result.stateLegislativeUpper = { number: sldNumber(geoid), geoid };
  }

  if (sldEntry) {
    const geoid = str(sldEntry, "GEOID") ?? "";
    result.stateLegislativeLower = { number: sldNumber(geoid), geoid };
  }

  return result;
}
