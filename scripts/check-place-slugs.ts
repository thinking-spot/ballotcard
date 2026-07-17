// Ad-hoc check: every seed-data/mayors.json geoSlug must be reachable from
// its city's Census "Incorporated Places" NAME via placeSlugFromName().
// Run: npx tsx scripts/check-place-slugs.ts   (no env needed — pure)
import { placeSlugFromName } from "../src/lib/ballot-card";
import mayors from "../seed-data/mayors.json";

// Census NAMEs that aren't just "{cityName} city".
const CENSUS_NAME_OVERRIDES: Record<string, string | null> = {
  "ny/new-york-city": "New York city",
  "tn/nashville": "Nashville-Davidson metropolitan government (balance)",
  "ky/louisville": "Louisville/Jefferson County metro government (balance)",
  "ky/lexington": "Lexington-Fayette urban county",
  "in/indianapolis": "Indianapolis city (balance)",
  "id/boise": "Boise City city",
  "ak/anchorage": "Anchorage municipality",
  "az/gilbert": "Gilbert town",
  // Hawaii has no incorporated places — the geocoder never returns a place
  // layer for Honolulu addresses; the mayor page is reachable by URL only.
  "hi/honolulu": null,
};

let bad = 0;
for (const m of mayors as Array<{ geoSlug: string; cityName: string; state: string }>) {
  const censusName = CENSUS_NAME_OVERRIDES[m.geoSlug] ?? `${m.cityName} city`;
  if (censusName === null) continue;
  const derived = placeSlugFromName(m.state, censusName);
  if (derived !== m.geoSlug) {
    console.log(`MISMATCH ${m.cityName}, ${m.state}: census "${censusName}" → ${derived} ≠ seed ${m.geoSlug}`);
    bad++;
  }
}
console.log(bad === 0 ? `OK — all ${(mayors as unknown[]).length} seed slugs derivable` : `${bad} mismatches`);
process.exit(bad === 0 ? 0 : 1);
