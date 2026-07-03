import { describe, it, expect } from "vitest";
import { normalizeName, isCandidateActiveForCycle } from "../fec";

describe("normalizeName (FEC LAST, FIRST → First Last)", () => {
  it("flips the canonical FEC shape", () => {
    expect(normalizeName("ROUZER, DAVID")).toBe("David Rouzer");
  });

  it("preserves hyphenated surnames", () => {
    expect(normalizeName("ABU-GHAZALAH, MAAD")).toBe("Maad Abu-Ghazalah");
  });

  it("punctuates single-letter middle initials", () => {
    expect(normalizeName("JACKSON, JEFFREY R")).toBe("Jeffrey R. Jackson");
  });

  it("re-capitalizes McNames after the Mc prefix", () => {
    expect(normalizeName("MCCONNELL, ADDISON")).toBe("Addison McConnell");
    expect(normalizeName("MCCAIN, JOHN S")).toBe("John S. McCain");
  });

  it("strips common honorifics from the first-name slot", () => {
    expect(normalizeName("SMITH, DR. JANE")).toBe("Jane Smith");
    expect(normalizeName("WILSON, MR JOHN")).toBe("John Wilson");
    expect(normalizeName("PEREZ, MS. MARIA")).toBe("Maria Perez");
  });

  it("strips legislative honorifics (Rep./Sen.)", () => {
    expect(normalizeName("CARTER, JOHN R REP.")).toBe("John R. Carter");
    expect(normalizeName("SCHUMER, CHARLES SEN")).toBe("Charles Schumer");
  });

  it("relocates generational suffixes to the end with canonical casing", () => {
    expect(normalizeName("DOWELL, STEVEN CLAY JR")).toBe("Steven Clay Dowell Jr.");
    expect(normalizeName("KING, MARTIN L SR")).toBe("Martin L. King Sr.");
  });

  it("keeps Roman-numeral suffixes upper-case at the end", () => {
    expect(normalizeName("HAMDEN, RAYMOND H II")).toBe("Raymond H. Hamden II");
    expect(normalizeName("GORE, ALBERT III")).toBe("Albert Gore III");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeName("  RIGGS, ALLISON  ")).toBe("Allison Riggs");
  });

  it("title-cases a single token (no comma)", () => {
    expect(normalizeName("MADONNA")).toBe("Madonna");
  });
});

describe("isCandidateActiveForCycle", () => {
  it("excludes a senator whose seat isn't up this cycle (Murkowski, AK Class III, 2026 query)", () => {
    expect(isCandidateActiveForCycle([2004, 2010, 2016, 2022, 2028], null, 2026)).toBe(false);
  });

  it("includes a senator whose seat is up this cycle (Sullivan, AK Class II)", () => {
    expect(isCandidateActiveForCycle([2014, 2020, 2026], null, 2026)).toBe(true);
  });

  it("excludes a candidate who filed for a different race this cycle (Tuberville running for AL governor, not re-election)", () => {
    expect(isCandidateActiveForCycle([2020, 2026], [2026], 2026)).toBe(false);
  });

  it("excludes a candidate who resigned mid-cycle (Greene, GA-14, resigned before the 2026 general)", () => {
    expect(isCandidateActiveForCycle([2020, 2022, 2024, 2026], [2026], 2026)).toBe(false);
  });

  it("includes a candidate with no inactive years recorded", () => {
    expect(isCandidateActiveForCycle([2026], undefined, 2026)).toBe(true);
  });

  it("excludes a candidate with no election_years at all", () => {
    expect(isCandidateActiveForCycle(undefined, null, 2026)).toBe(false);
  });

  it("allows two legitimate incumbents in the same race after redistricting (Kim + Calvert, CA-40)", () => {
    expect(isCandidateActiveForCycle([2018, 2020, 2022, 2024, 2026], null, 2026)).toBe(true);
    expect(
      isCandidateActiveForCycle(
        [1982, 1992, 1994, 1996, 1998, 2000, 2002, 2004, 2006, 2008, 2010, 2012, 2014, 2016, 2018, 2020, 2022, 2024, 2026],
        null,
        2026
      )
    ).toBe(true);
  });
});
