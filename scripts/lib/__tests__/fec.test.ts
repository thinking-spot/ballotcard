import { describe, it, expect } from "vitest";
import { normalizeName } from "../fec";

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
