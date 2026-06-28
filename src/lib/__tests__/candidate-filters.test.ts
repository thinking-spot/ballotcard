import { describe, it, expect } from "vitest";
import { isOnUpcomingBallot } from "@/lib/candidate-filters";

describe("isOnUpcomingBallot", () => {
  it("keeps candidates with no status (FEC + curated seeds)", () => {
    expect(isOnUpcomingBallot({})).toBe(true);
    expect(isOnUpcomingBallot({ status: null })).toBe(true);
    expect(isOnUpcomingBallot({ status: "" })).toBe(true);
  });

  it("keeps active filings — Qualified, Active, Unopposed, Elected", () => {
    for (const s of ["Qualified", "Active", "Unopposed", "Elected"]) {
      expect(isOnUpcomingBallot({ status: s })).toBe(true);
    }
  });

  it("drops dropouts and unqualified filers", () => {
    for (const s of [
      "Withdrew",
      "Withdrawn",
      "Did Not Qualify",
      "Disqualified",
      "Defeated",
      "Transferred to Local",
    ]) {
      expect(isOnUpcomingBallot({ status: s })).toBe(false);
    }
  });

  it("is case-insensitive and trims whitespace", () => {
    expect(isOnUpcomingBallot({ status: "  withdrew  " })).toBe(false);
    expect(isOnUpcomingBallot({ status: "DID NOT QUALIFY" })).toBe(false);
    expect(isOnUpcomingBallot({ status: "Qualified" })).toBe(true);
  });
});
