import { describe, it, expect } from "vitest";
import { parseGeographies } from "@/lib/geocoder";

// A trimmed real response for 301 N 3rd St, Wilmington, NC 28401.
const WILMINGTON = {
  States: [{ STATE: "37", GEOID: "37", NAME: "North Carolina" }],
  Counties: [{ GEOID: "37129", NAME: "New Hanover County" }],
  "Incorporated Places": [{ GEOID: "3774440", NAME: "Wilmington city" }],
  "119th Congressional Districts": [{ GEOID: "3707", NAME: "Congressional District 7" }],
  "2024 State Legislative Districts - Upper": [
    { GEOID: "37008", NAME: "State Senate District 8" },
  ],
  "2024 State Legislative Districts - Lower": [
    { GEOID: "37018", NAME: "State House District 18" },
  ],
};

describe("parseGeographies", () => {
  it("maps state, county, place, CD, and both legislative chambers", () => {
    const r = parseGeographies(WILMINGTON)!;
    expect(r.state).toEqual({ code: "NC", name: "North Carolina", fips: "37" });
    expect(r.county?.name).toBe("New Hanover County");
    expect(r.place?.name).toBe("Wilmington city");
    expect(r.congressionalDistrict?.number).toBe("07");
    expect(r.stateLegislativeUpper?.number).toBe("8"); // leading zeros stripped
    expect(r.stateLegislativeLower?.number).toBe("18");
  });

  it("matches layers by vintage-prefixed key (survives re-vintaging)", () => {
    const reVintaged = {
      States: [{ STATE: "06", GEOID: "06", NAME: "California" }],
      "120th Congressional Districts": [{ GEOID: "0612", NAME: "CD 12" }],
    };
    const r = parseGeographies(reVintaged)!;
    expect(r.state?.code).toBe("CA");
    expect(r.congressionalDistrict?.number).toBe("12");
  });

  it("renders an at-large congressional district as 'al'", () => {
    const atLarge = {
      States: [{ STATE: "56", GEOID: "56", NAME: "Wyoming" }],
      "119th Congressional Districts": [{ GEOID: "5600", NAME: "CD (at large)" }],
    };
    const r = parseGeographies(atLarge)!;
    expect(r.congressionalDistrict?.number).toBe("al");
  });

  it("returns null state for an unmatched response", () => {
    const r = parseGeographies({});
    expect(r?.state).toBeUndefined();
  });
});
