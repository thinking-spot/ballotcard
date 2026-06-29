import { describe, it, expect } from "vitest";
import {
  parseBallotpediaCandidatePage,
  ballotpediaUrl,
} from "../ballotpedia";

// Real-shape fixture from the OH State Senate 2026 page. Preserves the
// exact markup we depend on: candidateListTablePartisan class, party
// columns in Democratic/Republican/Other order, (i) for incumbents,
// Independent annotation in the Other column.
const OH_SEN_HTML = `
<html><body>
  <table class="wikitable sortable collapsible candidateListTablePartisan">
    <tbody>
      <tr><td colspan="4"><h4>Ohio State Senate general election 2026</h4></td></tr>
      <tr><td colspan="4"><ul><li>Incumbents are marked with an (i) after their name.</li></ul></td></tr>
      <tr>
        <td style="font-weight: bold; width: 25%;">Office</td>
        <td style="font-weight: bold">Democratic</td>
        <td style="font-weight: bold; width: 25%;">Republican</td>
        <td style="font-weight: bold; width: 25%;">Other</td>
      </tr>
      <tr>
        <td><a href="/Ohio_State_Senate_District_1">District 1 </a></td>
        <td></td>
        <td>
          <p><span class="candidate"><a href="/Craig_Riedel">Craig Riedel</a> <br /></span></p>
        </td>
        <td></td>
      </tr>
      <tr>
        <td><a href="/Ohio_State_Senate_District_3">District 3 </a></td>
        <td>
          <p><span class="candidate"><a href="/Stacie_Baker">Stacie Baker</a> &#160;<a href="/Stacie_Baker#Campaign_themes"><img alt="cc" src="/x.png" /></a> <br /></span></p>
        </td>
        <td>
          <p><span class="candidate"><a href="/Michele_Reynolds">Michele Reynolds</a>&#160;(i) <br /></span></p>
        </td>
        <td></td>
      </tr>
      <tr>
        <td><a href="/Ohio_State_Senate_District_11">District 11 </a></td>
        <td>
          <p><span class="candidate"><a href="/Paula_Hicks-Hudson">Paula Hicks-Hudson</a> (i) <br /></span></p>
        </td>
        <td>
          <p><span class="candidate"><a href="/James_Nowak">James Nowak</a> <br /></span></p>
        </td>
        <td>
          <p><a href="/Kenneth_Sharp">Kenneth Sharp</a> (Libertarian Party)</p>
        </td>
      </tr>
    </tbody>
  </table>
</body></html>
`;

describe("ballotpediaUrl", () => {
  it("builds the canonical state-house URL for OH", () => {
    expect(ballotpediaUrl("OH", "state-house", 2026)).toBe(
      "https://ballotpedia.org/Ohio_House_of_Representatives_elections,_2026"
    );
  });

  it("builds the canonical state-senate URL for GA", () => {
    expect(ballotpediaUrl("GA", "state-senate", 2026)).toBe(
      "https://ballotpedia.org/Georgia_State_Senate_elections,_2026"
    );
  });

  it("throws for an unmapped state", () => {
    expect(() => ballotpediaUrl("XX", "state-house", 2026)).toThrow(/no state-name/);
  });
});

describe("parseBallotpediaCandidatePage — OH Senate 2026", () => {
  it("extracts every candidate row with the correct office, district, party", () => {
    const out = parseBallotpediaCandidatePage(OH_SEN_HTML, "OH", "state-senate", 2026);
    // D1: Riedel R (1). D3: Baker D + Reynolds R (2). D11: Hicks-Hudson D +
    // Nowak R + Sharp (Lib) (3). Total: 6.
    expect(out).toHaveLength(6);
  });

  it("maps source to {state}_ballotpedia (not {state}_sos)", () => {
    const out = parseBallotpediaCandidatePage(OH_SEN_HTML, "OH", "state-senate", 2026);
    expect(out.every((c) => c.source === "oh_ballotpedia")).toBe(true);
  });

  it("uses 'Democratic' / 'Republican' party labels from column headers", () => {
    const out = parseBallotpediaCandidatePage(OH_SEN_HTML, "OH", "state-senate", 2026);
    const d3 = out.filter((c) => c.district === "3");
    expect(d3.find((c) => c.name === "Stacie Baker")?.party).toBe("Democratic");
    expect(d3.find((c) => c.name === "Michele Reynolds")?.party).toBe("Republican");
  });

  it("flags (i) incumbents via extraRefs.bp_incumbent", () => {
    const out = parseBallotpediaCandidatePage(OH_SEN_HTML, "OH", "state-senate", 2026);
    const reynolds = out.find((c) => c.name === "Michele Reynolds")!;
    expect(reynolds.extraRefs?.bp_incumbent).toBe("true");
    const hh = out.find((c) => c.name === "Paula Hicks-Hudson")!;
    expect(hh.extraRefs?.bp_incumbent).toBe("true");
  });

  it("parses the 'Other' column with party annotation (Libertarian Party)", () => {
    const out = parseBallotpediaCandidatePage(OH_SEN_HTML, "OH", "state-senate", 2026);
    const sharp = out.find((c) => c.name === "Kenneth Sharp");
    expect(sharp?.party).toBe("Libertarian Party");
    expect(sharp?.district).toBe("11");
  });

  it("synthesizes a stable externalId per (office, district, party, name)", () => {
    const out = parseBallotpediaCandidatePage(OH_SEN_HTML, "OH", "state-senate", 2026);
    const reynolds = out.find((c) => c.name === "Michele Reynolds")!;
    expect(reynolds.externalId).toBe("state-senate-3-republican-michele-reynolds");
  });

  it("uses 2026 general election date for cycle 2026", () => {
    const out = parseBallotpediaCandidatePage(OH_SEN_HTML, "OH", "state-senate", 2026);
    expect(out[0].electionDate).toBe("2026-11-03");
  });

  it("returns empty array when no candidateListTablePartisan present", () => {
    expect(
      parseBallotpediaCandidatePage("<html><body></body></html>", "OH", "state-senate", 2026)
    ).toEqual([]);
  });
});
