import { describe, it, expect } from "vitest";
import { normalizeName } from "../fec";

describe("normalizeName (FEC LAST, FIRST → First Last)", () => {
  it("flips the canonical FEC shape", () => {
    expect(normalizeName("ROUZER, DAVID")).toBe("David Rouzer");
  });

  it("preserves hyphenated surnames", () => {
    expect(normalizeName("ABU-GHAZALAH, MAAD")).toBe("Maad Abu-Ghazalah");
  });

  it("handles middle names and initials", () => {
    expect(normalizeName("JACKSON, JEFFREY R")).toBe("Jeffrey R Jackson");
  });

  it("re-capitalizes McNames after the Mc prefix", () => {
    expect(normalizeName("MCCONNELL, ADDISON")).toBe("Addison McConnell");
    expect(normalizeName("MCCAIN, JOHN S")).toBe("John S McCain");
  });

  it("strips common honorifics from the first-name slot", () => {
    expect(normalizeName("SMITH, DR. JANE")).toBe("Jane Smith");
    expect(normalizeName("WILSON, MR JOHN")).toBe("John Wilson");
    expect(normalizeName("PEREZ, MS. MARIA")).toBe("Maria Perez");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeName("  RIGGS, ALLISON  ")).toBe("Allison Riggs");
  });

  it("title-cases a single token (no comma)", () => {
    expect(normalizeName("MADONNA")).toBe("Madonna");
  });
});
