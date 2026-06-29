import { describe, it, expect } from "vitest";
import { deriveOcdId } from "../ocd-id";

describe("deriveOcdId — basic kinds", () => {
  it("country", () => {
    expect(
      deriveOcdId({ kind: "country", state: null, name: "United States", geo_slug: "us" })
    ).toBe("ocd-division/country:us");
  });

  it("state", () => {
    expect(
      deriveOcdId({ kind: "state", state: "NC", name: "North Carolina", geo_slug: "nc" })
    ).toBe("ocd-division/country:us/state:nc");
  });

  it("state senate (sldu)", () => {
    expect(
      deriveOcdId({
        kind: "state_senate",
        state: "NC",
        name: "NC State Senate District 8",
        geo_slug: "nc/sldu-8",
      })
    ).toBe("ocd-division/country:us/state:nc/sldu:8");
  });

  it("state house (sldl)", () => {
    expect(
      deriveOcdId({
        kind: "state_house",
        state: "FL",
        name: "FL State House District 55",
        geo_slug: "fl/sldl-55",
      })
    ).toBe("ocd-division/country:us/state:fl/sldl:55");
  });

  it("MA/NH/VT compound state-leg districts (e.g. 7th Hampden) get snake_case OCD-IDs", () => {
    expect(
      deriveOcdId({
        kind: "state_house",
        state: "MA",
        name: "MA State House District 7th-hampden",
        geo_slug: "ma/sldl-7th-hampden",
      })
    ).toBe("ocd-division/country:us/state:ma/sldl:7th_hampden");

    expect(
      deriveOcdId({
        kind: "state_senate",
        state: "NH",
        name: "NH State Senate District norfolk-and-plymouth",
        geo_slug: "nh/sldu-norfolk-and-plymouth",
      })
    ).toBe("ocd-division/country:us/state:nh/sldu:norfolk_and_plymouth");
  });

  it("ME tribal-seat slugs (Passamaquoddy Tribe etc.) map cleanly", () => {
    expect(
      deriveOcdId({
        kind: "state_house",
        state: "ME",
        name: "ME State House District passamaquoddy-tribe",
        geo_slug: "me/sldl-passamaquoddy-tribe",
      })
    ).toBe("ocd-division/country:us/state:me/sldl:passamaquoddy_tribe");
  });
});

describe("deriveOcdId — US House numbering", () => {
  it("strips leading zeros from numeric CDs", () => {
    expect(
      deriveOcdId({ kind: "us_house", state: "NC", name: "NC-07 (US House)", geo_slug: "nc/07" })
    ).toBe("ocd-division/country:us/state:nc/cd:7");
  });

  it("renders state at-large districts as cd:at-large (verified live)", () => {
    expect(
      deriveOcdId({ kind: "us_house", state: "WY", name: "WY-AL (US House)", geo_slug: "wy/al" })
    ).toBe("ocd-division/country:us/state:wy/cd:at-large");

    expect(
      deriveOcdId({ kind: "us_house", state: "AK", name: "AK-AL (US House)", geo_slug: "ak/al" })
    ).toBe("ocd-division/country:us/state:ak/cd:at-large");
  });
});

describe("deriveOcdId — territory + DC special cases", () => {
  it("DC uses district:dc, not state:dc", () => {
    // We store DC as kind=territory in the DB; the OCD scope is `district`.
    expect(
      deriveOcdId({ kind: "territory", state: "DC", name: "District of Columbia", geo_slug: "dc" })
    ).toBe("ocd-division/country:us/district:dc");
  });

  it("PR/GU/VI/AS/MP use territory:xx", () => {
    expect(
      deriveOcdId({ kind: "territory", state: "PR", name: "Puerto Rico", geo_slug: "pr" })
    ).toBe("ocd-division/country:us/territory:pr");
    expect(
      deriveOcdId({ kind: "territory", state: "GU", name: "Guam", geo_slug: "gu" })
    ).toBe("ocd-division/country:us/territory:gu");
  });
});

describe("deriveOcdId — counties / parishes / boroughs", () => {
  it("strips trailing 'County' suffix and snake-cases the name", () => {
    expect(
      deriveOcdId({
        kind: "county",
        state: "NC",
        name: "New Hanover County",
        geo_slug: "nc/new-hanover-county",
      })
    ).toBe("ocd-division/country:us/state:nc/county:new_hanover");
  });

  it("strips 'Parish' (Louisiana)", () => {
    expect(
      deriveOcdId({
        kind: "county",
        state: "LA",
        name: "Orleans Parish",
        geo_slug: "la/orleans-parish",
      })
    ).toBe("ocd-division/country:us/state:la/county:orleans");
  });

  it("strips 'Borough' and 'City and Borough' (Alaska)", () => {
    expect(
      deriveOcdId({
        kind: "county",
        state: "AK",
        name: "Aleutians East Borough",
        geo_slug: "ak/aleutians-east-borough",
      })
    ).toBe("ocd-division/country:us/state:ak/county:aleutians_east");

    // "Juneau City and Borough" must NOT be trimmed to "juneau city" by the
    // shorter "borough" alternative — order in the regex matters.
    expect(
      deriveOcdId({
        kind: "county",
        state: "AK",
        name: "Juneau City and Borough",
        geo_slug: "ak/juneau-city-and-borough",
      })
    ).toBe("ocd-division/country:us/state:ak/county:juneau");
  });

  it("strips 'Municipality' and 'Census Area' (Alaska)", () => {
    expect(
      deriveOcdId({
        kind: "county",
        state: "AK",
        name: "Anchorage Municipality",
        geo_slug: "ak/anchorage-municipality",
      })
    ).toBe("ocd-division/country:us/state:ak/county:anchorage");

    expect(
      deriveOcdId({
        kind: "county",
        state: "AK",
        name: "Yukon-Koyukuk Census Area",
        geo_slug: "ak/yukon-koyukuk-census-area",
      })
    ).toBe("ocd-division/country:us/state:ak/county:yukon_koyukuk");
  });

  it("collapses apostrophes and periods", () => {
    expect(
      deriveOcdId({
        kind: "county",
        state: "MO",
        name: "St. Louis County",
        geo_slug: "mo/st-louis-county",
      })
    ).toBe("ocd-division/country:us/state:mo/county:st_louis");

    expect(
      deriveOcdId({
        kind: "county",
        state: "IA",
        name: "O'Brien County",
        geo_slug: "ia/obrien-county",
      })
    ).toBe("ocd-division/country:us/state:ia/county:obrien");
  });

  it("VA independent cities use place: (not county:) — they're county-equivalent but OCD treats them as places", () => {
    expect(
      deriveOcdId({
        kind: "county",
        state: "VA",
        name: "Alexandria city",
        geo_slug: "va/alexandria-city",
      })
    ).toBe("ocd-division/country:us/state:va/place:alexandria");
  });

  it("preserves 'City' when it's part of the actual county name (Charles City County, VA)", () => {
    expect(
      deriveOcdId({
        kind: "county",
        state: "VA",
        name: "Charles City County",
        geo_slug: "va/charles-city-county",
      })
    ).toBe("ocd-division/country:us/state:va/county:charles_city");
  });

  it("Baltimore city (MD) and St. Louis city (MO) are independent cities → place:", () => {
    expect(
      deriveOcdId({
        kind: "county",
        state: "MD",
        name: "Baltimore city",
        geo_slug: "md/baltimore-city",
      })
    ).toBe("ocd-division/country:us/state:md/place:baltimore");
  });
});

describe("deriveOcdId — municipalities", () => {
  it("renders top-level place from a state-rooted slug", () => {
    expect(
      deriveOcdId({
        kind: "municipality",
        state: "NY",
        name: "New York City",
        geo_slug: "ny/new-york-city",
      })
    ).toBe("ocd-division/country:us/state:ny/place:new_york_city");
  });

  it("uses the last segment of a nested slug (county/place form)", () => {
    expect(
      deriveOcdId({
        kind: "municipality",
        state: "NC",
        name: "Wilmington",
        geo_slug: "nc/new-hanover/wilmington",
      })
    ).toBe("ocd-division/country:us/state:nc/place:wilmington");
  });

  it("DC municipality lives under district:dc, not state:dc", () => {
    expect(
      deriveOcdId({
        kind: "municipality",
        state: "DC",
        name: "Washington",
        geo_slug: "dc/washington",
      })
    ).toBe("ocd-division/country:us/district:dc/place:washington");
  });
});

describe("deriveOcdId — unknown kinds", () => {
  it("returns null for unmapped kinds", () => {
    expect(
      deriveOcdId({ kind: "school_board", state: "NC", name: "anything", geo_slug: "nc/foo" })
    ).toBeNull();
  });
});
