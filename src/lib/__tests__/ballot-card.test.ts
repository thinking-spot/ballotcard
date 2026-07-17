import { describe, it, expect, beforeEach } from "vitest";
import { q } from "@/test-utils/helpers";
import {
  sldUpperSlug,
  sldLowerSlug,
  countySlugFromName,
  placeSlugFromName,
  getBallotCard,
} from "@/lib/ballot-card";

describe("state-legislative slug helpers", () => {
  it("builds upper/lower slugs matching the ingestion convention", () => {
    expect(sldUpperSlug("nc", "8")).toBe("nc/sldu-8");
    expect(sldLowerSlug("nc", "18")).toBe("nc/sldl-18");
  });

  it("normalizes case", () => {
    expect(sldUpperSlug("NC", "8")).toBe("nc/sldu-8");
  });
});

describe("countySlugFromName", () => {
  it("matches the seed-data kebab convention for typical counties", () => {
    expect(countySlugFromName("nc", "New Hanover County")).toBe("nc/new-hanover-county");
    expect(countySlugFromName("VA", "Fairfax County")).toBe("va/fairfax-county");
  });

  it("handles parishes (LA) and boroughs (AK)", () => {
    expect(countySlugFromName("la", "Orleans Parish")).toBe("la/orleans-parish");
    expect(countySlugFromName("ak", "Aleutians East Borough")).toBe("ak/aleutians-east-borough");
  });

  it("strips apostrophes and periods so St. and O'Brien collapse cleanly", () => {
    expect(countySlugFromName("mo", "St. Louis County")).toBe("mo/st-louis-county");
    expect(countySlugFromName("ia", "O'Brien County")).toBe("ia/obrien-county");
  });
});

describe("placeSlugFromName", () => {
  it("strips the Census legal-type suffix and kebabs like the county rule", () => {
    expect(placeSlugFromName("nc", "Wilmington city")).toBe("nc/wilmington");
    expect(placeSlugFromName("ca", "Los Angeles city")).toBe("ca/los-angeles");
    expect(placeSlugFromName("az", "Gilbert town")).toBe("az/gilbert");
    expect(placeSlugFromName("ak", "Anchorage municipality")).toBe("ak/anchorage");
    expect(placeSlugFromName("DC", "Washington city")).toBe("dc/washington");
  });

  it("only strips the suffix — legal words inside the name survive", () => {
    expect(placeSlugFromName("ok", "Oklahoma City city")).toBe("ok/oklahoma-city");
    expect(placeSlugFromName("mo", "St. Louis city")).toBe("mo/st-louis");
    expect(placeSlugFromName("mn", "St. Paul city")).toBe("mn/st-paul");
  });

  it("handles consolidated city-county government names", () => {
    expect(
      placeSlugFromName("tn", "Nashville-Davidson metropolitan government (balance)")
    ).toBe("tn/nashville");
    expect(
      placeSlugFromName("ky", "Louisville/Jefferson County metro government (balance)")
    ).toBe("ky/louisville");
    expect(placeSlugFromName("ky", "Lexington-Fayette urban county")).toBe("ky/lexington");
    expect(placeSlugFromName("in", "Indianapolis city (balance)")).toBe("in/indianapolis");
  });

  it("maps the alias cases onto their seed geoSlugs", () => {
    expect(placeSlugFromName("ny", "New York city")).toBe("ny/new-york-city");
    expect(placeSlugFromName("id", "Boise City city")).toBe("id/boise");
  });
});

describe("getBallotCard placeName join", () => {
  beforeEach(() => {
    // 1. districts lookup — the municipality row is found because the derived
    //    place slug (nc/wilmington) is part of the geo_slug lookup.
    q([
      { id: "d-us", name: "United States", geo_slug: "us", kind: "country", state: null },
      { id: "d-nc", name: "North Carolina", geo_slug: "nc", kind: "state", state: "NC" },
      { id: "d-wilm", name: "Wilmington", geo_slug: "nc/wilmington", kind: "municipality", state: "NC" },
    ]);
    // 2. offices lookup
    q([
      {
        id: "o-mayor",
        title: "Mayor of Wilmington",
        slug: "mayor",
        branch: "executive",
        level: "municipal",
        selection_method: "elected_nonpartisan",
        next_election_at: "2027-11-02",
        district_id: "d-wilm",
      },
    ]);
    // 3. ingestion stamp (maybeSingle) then officials — see note above.
    q({ finished_at: "2026-06-22T00:00:00Z" });
    q([
      { office_id: "o-mayor", name: "Bill Saffo", party: "Democratic", photo_url: null },
    ]);
  });

  it("renders the seeded mayor, not a placeholder, from placeName alone", async () => {
    const card = await getBallotCard({ state: "nc", placeName: "Wilmington city" });
    expect(card).not.toBeNull();
    const municipal = card!.sections.find((s) => s.level === "municipal")!;
    const mayor = municipal.offices.find((o) => o.slug === "mayor")!;
    expect(mayor.placeholder).toBeFalsy();
    expect(mayor.officialName).toBe("Bill Saffo");
    // other municipal template rows still render as honest placeholders
    const others = municipal.offices.filter((o) => o.slug !== "mayor");
    for (const o of others) expect(o.placeholder).toBe(true);
  });
});

describe("getBallotCard", () => {
  beforeEach(() => {
    // 1. districts lookup
    q([
      { id: "d-us", name: "United States", geo_slug: "us", kind: "country", state: null },
      { id: "d-nc", name: "North Carolina", geo_slug: "nc", kind: "state", state: "NC" },
      { id: "d-cd7", name: "NC-07", geo_slug: "nc/07", kind: "us_house", state: "NC" },
    ]);
    // 2. offices lookup
    q([
      {
        id: "o-gov",
        title: "Governor of North Carolina",
        slug: "governor",
        branch: "executive",
        level: "state",
        selection_method: "elected_partisan",
        next_election_at: "2028-11-07",
        district_id: "d-nc",
      },
      {
        id: "o-house",
        title: "US House, NC-07",
        slug: "us-house",
        branch: "legislative",
        level: "federal",
        selection_method: "elected_partisan",
        next_election_at: "2026-11-03",
        district_id: "d-cd7",
      },
    ]);
    // 3. officials + ingestion stamp run in a Promise.all; the single-row
    // .maybeSingle() (ingestion) consumes its mock response before the
    // awaited officials query, so queue the ingestion stamp first.
    q({ finished_at: "2026-06-22T00:00:00Z" });
    q([
      { office_id: "o-gov", name: "Josh Stein", party: "Democratic", photo_url: null },
    ]);
  });

  it("groups offices into ballot-order sections with officeholders", async () => {
    const card = await getBallotCard({ state: "nc", cd: "07" });
    expect(card).not.toBeNull();
    expect(card!.stateName).toBe("North Carolina");
    // federal section precedes state section
    expect(card!.sections.map((s) => s.level)).toEqual(["federal", "state"]);
    const gov = card!.sections
      .find((s) => s.level === "state")!
      .offices.find((o) => o.slug === "governor")!;
    expect(gov.officialName).toBe("Josh Stein");
    expect(gov.href).toBe("/nc/governor");
    expect(card!.dataAsOf).toBe("2026-06-22T00:00:00Z");
  });
});
