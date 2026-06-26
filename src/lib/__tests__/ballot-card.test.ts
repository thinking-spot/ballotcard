import { describe, it, expect, beforeEach } from "vitest";
import { q } from "@/test-utils/helpers";
import {
  sldUpperSlug,
  sldLowerSlug,
  countySlugFromName,
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
