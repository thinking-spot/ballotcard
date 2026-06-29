// Derive canonical OCD-IDs (Open Civic Data Division Identifiers) from our
// District rows. OCD-IDs are the standard cross-tool identifier for U.S.
// political/administrative divisions — Open States v3, Wikipedia infoboxes,
// Wikidata, Ballotpedia all key on them.
//
// Spec: https://github.com/opencivicdata/ocd-division-ids
//
// Form: ocd-division/country:us/state:nc/sldl:18
//
// This function is pure (no I/O). The ingestion phase calls it for every
// District row and merges the result into external_refs.ocd_id.

export type DistrictForOcd = {
  kind: string;
  state: string | null;
  name: string;
  geo_slug: string;
};

// Some U.S. jurisdictions use non-"state" OCD scopes:
// - DC is district:dc
// - Territories (PR, GU, VI, AS, MP) are territory:xx
// We map by the lowercase abbr.
function statePathFor(abbr: string): string {
  const s = abbr.toLowerCase();
  if (s === "dc") return `district:${s}`;
  if (["pr", "gu", "vi", "as", "mp"].includes(s)) return `territory:${s}`;
  return `state:${s}`;
}

// VA, MD's Baltimore, MO's St. Louis are "independent cities" that Census
// catalogs as counties but OCD identifies as `place:` (not `county:`).
// We detect VA by state-code and the rest by name match.
function isIndependentCity(state: string, name: string): boolean {
  if (state === "va" && / city$/.test(name)) return true;
  if (state === "md" && name === "Baltimore city") return true;
  if (state === "mo" && /^St\.? Louis city$/i.test(name)) return true;
  return false;
}

/**
 * Normalize a county/place name to OCD-ID slug form:
 *   "New Hanover County"          → "new_hanover"
 *   "Aleutians East Borough"      → "aleutians_east"
 *   "Juneau City and Borough"     → "juneau"
 *   "Orleans Parish"              → "orleans"
 *   "St. Louis County"            → "st_louis"
 *   "O'Brien County"              → "obrien"
 *   "Charles City County"         → "charles_city" (preserved — actual name)
 *
 * The trailing-suffix list is ordered longest-first so "City and Borough"
 * matches before "Borough" alone.
 */
function normalizeCountyOrPlace(name: string): string {
  return name
    .toLowerCase()
    .replace(
      /\s+(city and borough|census area|municipality|borough|county|parish|city)$/i,
      ""
    )
    .replace(/[.'’]/g, "") // strip apostrophes + periods
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");
}

/**
 * Compute the OCD-ID for a District row, or null if the kind isn't covered.
 */
export function deriveOcdId(d: DistrictForOcd): string | null {
  switch (d.kind) {
    case "country":
      return "ocd-division/country:us";

    case "state": {
      const abbr = (d.state || d.geo_slug).toLowerCase();
      return `ocd-division/country:us/${statePathFor(abbr)}`;
    }

    case "territory": {
      // Our schema also stores DC as `kind=territory` — handled by statePathFor.
      const abbr = (d.state || d.geo_slug).toLowerCase();
      return `ocd-division/country:us/${statePathFor(abbr)}`;
    }

    case "state_senate": {
      // Most state Senates use numeric IDs ("nc/sldu-8"), but a few states
      // (MA, NH, VT, ME) use compound names ("ma/sldu-norfolk-bristol") or
      // tribal-seat slugs ("me/sldu-passamaquoddy-tribe"). Snake-case the tail.
      const m = d.geo_slug.match(/^([a-z]{2})\/sldu-(.+)$/);
      if (!m) return null;
      const id = m[2].replace(/-/g, "_");
      return `ocd-division/country:us/${statePathFor(m[1])}/sldu:${id}`;
    }

    case "state_house": {
      const m = d.geo_slug.match(/^([a-z]{2})\/sldl-(.+)$/);
      if (!m) return null;
      const id = m[2].replace(/-/g, "_");
      return `ocd-division/country:us/${statePathFor(m[1])}/sldl:${id}`;
    }

    case "us_house": {
      // slug: "nc/07", "wy/al", "ak/al" — at-large stays "at-large" per
      // Google Civic's convention (verified against divisionsByAddress live).
      const m = d.geo_slug.match(/^([a-z]{2})\/(\w+)$/);
      if (!m) return null;
      const tail = m[2];
      const cd = tail === "al" ? "at-large" : String(parseInt(tail, 10));
      return `ocd-division/country:us/${statePathFor(m[1])}/cd:${cd}`;
    }

    case "county": {
      const abbr = (d.state || "").toLowerCase();
      if (!abbr || !d.name) return null;
      const scope = isIndependentCity(abbr, d.name) ? "place" : "county";
      const cleaned = normalizeCountyOrPlace(d.name);
      return `ocd-division/country:us/${statePathFor(abbr)}/${scope}:${cleaned}`;
    }

    case "municipality": {
      // slug forms: "nc/wilmington", "nc/new-hanover/wilmington",
      //            "dc/washington", "ny/new-york-city"
      // The OCD scope is always `place:`; the place name is the last segment.
      const parts = d.geo_slug.split("/");
      const abbr = parts[0];
      const placeRaw = parts[parts.length - 1];
      const place = placeRaw.replace(/-/g, "_");
      return `ocd-division/country:us/${statePathFor(abbr)}/place:${place}`;
    }

    default:
      return null;
  }
}
