import { describe, it, expect } from "vitest";
import {
  partyMeta,
  fmtMoney,
  electionLabel,
} from "@/components/card/ballot-row-helpers";

describe("partyMeta", () => {
  it("returns null when party is missing", () => {
    expect(partyMeta(undefined)).toBeNull();
    expect(partyMeta("")).toBeNull();
  });

  it("recognizes the canonical major parties", () => {
    expect(partyMeta("Republican")).toEqual({ abbr: "R", cls: "party-r" });
    expect(partyMeta("Democratic")).toEqual({ abbr: "D", cls: "party-d" });
  });

  it("matches FEC's verbose party names (REPUBLICAN PARTY / DEMOCRATIC PARTY)", () => {
    expect(partyMeta("REPUBLICAN PARTY")?.abbr).toBe("R");
    expect(partyMeta("DEMOCRATIC PARTY")?.abbr).toBe("D");
  });

  it("disambiguates DFL (Minnesota) from generic Democratic", () => {
    // DFL string contains "democrat" — order matters in the implementation.
    expect(partyMeta("Democratic-Farmer-Labor")).toEqual({
      abbr: "DFL",
      cls: "party-d",
    });
  });

  it("handles independent/libertarian/green as the indie color", () => {
    expect(partyMeta("Independent")).toEqual({ abbr: "I", cls: "party-i" });
    expect(partyMeta("Libertarian")).toEqual({ abbr: "L", cls: "party-i" });
    expect(partyMeta("Green Party")).toEqual({ abbr: "G", cls: "party-i" });
  });

  it("handles Nebraska's nonpartisan unicameral", () => {
    expect(partyMeta("Nonpartisan")).toEqual({ abbr: "NP", cls: "" });
  });

  it("falls back to the raw label for unknown parties", () => {
    expect(partyMeta("Working Families")).toEqual({
      abbr: "Working Families",
      cls: "",
    });
  });
});

describe("fmtMoney", () => {
  it("formats millions with one decimal", () => {
    expect(fmtMoney(1_500_000)).toBe("$1.5M");
    expect(fmtMoney(4_068_879)).toBe("$4.1M");
  });

  it("drops the decimal once past $10M", () => {
    expect(fmtMoney(12_643_779)).toBe("$13M");
    expect(fmtMoney(31_095_334)).toBe("$31M");
  });

  it("formats thousands rounded", () => {
    expect(fmtMoney(205_000)).toBe("$205k");
    expect(fmtMoney(7_290)).toBe("$7k");
    expect(fmtMoney(1_000)).toBe("$1k");
  });

  it("keeps small numbers as raw dollars", () => {
    expect(fmtMoney(500)).toBe("$500");
    expect(fmtMoney(0)).toBe("$0");
  });
});

describe("electionLabel", () => {
  it("returns an em-dash when there's no date", () => {
    expect(electionLabel(undefined)).toBe("—");
    expect(electionLabel("")).toBe("—");
  });

  it("formats exact dates as Mon YYYY", () => {
    expect(electionLabel("2026-11-03", false)).toBe("Nov 2026");
    expect(electionLabel("2028-11-07", false)).toBe("Nov 2028");
  });

  it("formats staggered chambers as a year range (current cycle or next)", () => {
    // PA State Senate D1 — staggered, source can't tell which year per seat.
    expect(electionLabel("2026-11-03", true)).toBe("2026 or 2028");
    expect(electionLabel("2028-11-07", true)).toBe("2028 or 2030");
  });

  it("treats undefined estimated as exact (default)", () => {
    expect(electionLabel("2026-11-03")).toBe("Nov 2026");
  });
});
