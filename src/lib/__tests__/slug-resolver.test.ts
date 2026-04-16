import { describe, it, expect } from "vitest";
import { q } from "@/test-utils/helpers";
import { resolveSlug } from "@/lib/slug-resolver";

describe("resolveSlug", () => {
  it("resolves a state-level district", async () => {
    q({ id: "d-nc", geo_slug: "nc" });

    const result = await resolveSlug("nc", []);
    expect(result).toEqual({ kind: "district", geoSlug: "nc" });
  });

  it("resolves a nested district", async () => {
    q({ id: "d-nc-07", geo_slug: "nc/07" });

    const result = await resolveSlug("nc", ["07"]);
    expect(result).toEqual({ kind: "district", geoSlug: "nc/07" });
  });

  it("resolves a deep district path", async () => {
    q({ id: "d-wilm", geo_slug: "nc/new-hanover/wilmington" });

    const result = await resolveSlug("nc", ["new-hanover", "wilmington"]);
    expect(result).toEqual({
      kind: "district",
      geoSlug: "nc/new-hanover/wilmington",
    });
  });

  it("resolves an office from district + office slug", async () => {
    q(null); // exact district match for "nc/07/us-house" fails
    q({ id: "d-nc-07" }); // district lookup for "nc/07" succeeds
    q({ id: "o-house", slug: "us-house" }); // office lookup succeeds

    const result = await resolveSlug("nc", ["07", "us-house"]);
    expect(result).toEqual({
      kind: "office",
      districtGeoSlug: "nc/07",
      officeSlug: "us-house",
    });
  });

  it("returns null for a nonexistent state slug", async () => {
    q(null); // no district match

    const result = await resolveSlug("xx", []);
    expect(result).toBeNull();
  });

  it("returns null when district exists but office does not", async () => {
    q(null); // exact match for "nc/07/fake-office" fails
    q({ id: "d-nc-07" }); // district "nc/07" found
    q(null); // office "fake-office" not found

    const result = await resolveSlug("nc", ["07", "fake-office"]);
    expect(result).toBeNull();
  });

  it.each([
    "post",
    "election",
    "moderate",
    "candidacy",
    "vote",
    "new",
    "edit",
    "reply",
  ])("skips reserved segment '%s'", async (reserved) => {
    q(null); // exact district match fails

    const result = await resolveSlug("nc", ["07", reserved]);
    expect(result).toBeNull();
  });
});
