import { describe, it, expect } from "vitest";
import { mergeOfficialRefs } from "../merge-official-refs";

describe("mergeOfficialRefs", () => {
  it("carries forward existing refs when the same person is re-ingested", () => {
    expect(
      mergeOfficialRefs(
        "David Rouzer",
        "David Rouzer",
        { openstates: "abc123" },
        { bioguide: "R000603" }
      )
    ).toEqual({ openstates: "abc123", bioguide: "R000603" });
  });

  it("does not carry a predecessor's refs onto a new occupant of the seat", () => {
    // Regression: NC-07's US House seat once held a stale
    // ballotpedia ref that pointed at a different person entirely. A new
    // source row (Congress YAML) for the new occupant must not inherit it.
    expect(
      mergeOfficialRefs(
        "Pat Vance",
        "David Rouzer",
        { ballotpedia: "Pat_Vance_(North_Carolina)" },
        { bioguide: "R000603" }
      )
    ).toEqual({ bioguide: "R000603" });
  });

  it("still applies the new source's own refs when the person changes", () => {
    expect(
      mergeOfficialRefs("Jane Old", "Jane New", { wikipedia: "Jane_Old" }, {})
    ).toEqual({});
  });
});
