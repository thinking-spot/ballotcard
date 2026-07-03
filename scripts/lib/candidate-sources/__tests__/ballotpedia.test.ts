import { describe, it, expect } from "vitest";
import {
  parseBallotpediaCandidatePage,
  parseNonpartisanCandidatePage,
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

// ─── Certified-candidate checkmark icon (Maryland-style multi-member) ───────
// Ballotpedia prefixes some candidates with a green-checkmark <img> INSIDE
// the <span class="candidate">, before the <a> — most visible on multi-
// member districts (Maryland's 3-delegate House districts) where several
// incumbents in one cell each carry the badge. A regex expecting <a> to be
// the immediate child of the span silently drops every badged candidate.

const MD_HOUSE_MULTIMEMBER_HTML = `
<html><body>
<table class="wikitable sortable collapsible candidateListTablePartisan">
<tbody>
<tr><td colspan="4"><h4>Maryland House of Delegates general election 2026</h4></td></tr>
<tr><td>Office</td><td>Democratic</td><td>Republican</td><td>Other</td></tr>
<tr>
<td><a href="https://ballotpedia.org/Maryland_House_of_Delegates_District_18">District 18 </a>&#160;(3 seats)</td>
<td>
  <p>
    <span class="candidate"><img alt="check" src="/check.png" /><a href="/Aaron_Kaufman">Aaron Kaufman</a>&#160;(i)<br /></span>
    <span class="candidate"><img alt="check" src="/check.png" /><a href="/Emily_Shetty">Emily Shetty</a>&#160;(i)<br /></span>
    <span class="candidate"><img alt="check" src="/check.png" /><a href="/Jared_Solomon">Jared Solomon</a>&#160;(i)<br /></span>
    <span class="candidate"><a href="/Kate_Stein">Kate Stein</a>&#160;<a href="/Kate_Stein#Campaign_themes"><img alt="cc" src="/x.png" /></a><br /></span>
  </p>
</td>
<td></td>
<td></td>
</tr>
</tbody></table>
</body></html>
`;

describe("Certified-candidate checkmark icon (Maryland multi-member districts)", () => {
  it("extracts every candidate even when a status icon precedes the anchor", () => {
    const out = parseBallotpediaCandidatePage(
      MD_HOUSE_MULTIMEMBER_HTML,
      "MD",
      "state-house",
      2026
    );
    expect(out.map((c) => c.name).sort()).toEqual([
      "Aaron Kaufman",
      "Emily Shetty",
      "Jared Solomon",
      "Kate Stein",
    ]);
  });

  it("still flags the badged candidates as incumbents", () => {
    const out = parseBallotpediaCandidatePage(
      MD_HOUSE_MULTIMEMBER_HTML,
      "MD",
      "state-house",
      2026
    );
    expect(out.find((c) => c.name === "Aaron Kaufman")?.extraRefs?.bp_incumbent).toBe(
      "true"
    );
    expect(out.find((c) => c.name === "Emily Shetty")?.extraRefs?.bp_incumbent).toBe(
      "true"
    );
    expect(out.find((c) => c.name === "Jared Solomon")?.extraRefs?.bp_incumbent).toBe(
      "true"
    );
    expect(out.find((c) => c.name === "Kate Stein")?.extraRefs?.bp_incumbent).toBeUndefined();
  });
});

// ─── Compound district names (MA / VT / NH) ─────────────────────────────────
// These states use named districts ("1st Plymouth", "Addison", "Belknap 1")
// rather than pure numeric IDs. The parser derives the district key from
// the office-cell anchor URL, kebab-casing the chamber-suffix tail.

const MA_SENATE_HTML = `
<html><body>
<table class="wikitable sortable collapsible candidateListTablePartisan">
<tbody>
<tr><td colspan="4"><h4>Massachusetts State Senate general election 2026</h4></td></tr>
<tr><td>Office</td><td>Democratic</td><td>Republican</td><td>Other</td></tr>
<tr>
<td><a href="https://ballotpedia.org/Massachusetts_State_Senate_2nd_Essex_and_Middlesex_District">2nd Essex and Middlesex District </a></td>
<td><p><span class="candidate"><a href="/Some_Dem">Some Dem</a> (i)</span></p></td>
<td><p><span class="candidate"><a href="/Some_Rep">Some Rep</a></span></p></td>
<td></td>
</tr>
</tbody></table>
</body></html>
`;

const VT_SENATE_HTML = `
<html><body>
<table class="wikitable sortable collapsible candidateListTablePartisan">
<tbody>
<tr><td colspan="4"><h4>Vermont State Senate general election 2026</h4></td></tr>
<tr><td>Office</td><td>Democratic</td><td>Republican</td><td>Other</td></tr>
<tr>
<td><a href="https://ballotpedia.org/Vermont_State_Senate_Chittenden_North_District">Chittenden North District </a></td>
<td><p><span class="candidate"><a href="/Tanya">Tanya Vyhovsky</a> (i)</span></p></td>
<td></td>
<td></td>
</tr>
</tbody></table>
</body></html>
`;

const NH_HOUSE_HTML = `
<html><body>
<table class="wikitable sortable collapsible candidateListTablePartisan">
<tbody>
<tr><td colspan="4"><h4>New Hampshire House of Representatives primary 2026</h4></td></tr>
<tr><td>Office</td><td>Democratic</td><td>Republican</td><td>Other</td></tr>
<tr>
<td><a href="https://ballotpedia.org/New_Hampshire_House_of_Representatives_District_Belknap_1">District Belknap 1 </a></td>
<td><p><span class="candidate"><a href="/Foo">Foo Bar</a></span></p></td>
<td></td>
<td></td>
</tr>
</tbody></table>
</body></html>
`;

describe("Compound district names (MA / VT / NH)", () => {
  it("MA Senate: BP '2nd Essex and Middlesex' → 'second-essex-and-middlesex' (matches our OpenStates slug)", () => {
    const out = parseBallotpediaCandidatePage(MA_SENATE_HTML, "MA", "state-senate", 2026);
    expect(out).toHaveLength(2);
    expect(out[0].district).toBe("second-essex-and-middlesex");
    expect(out[1].district).toBe("second-essex-and-middlesex");
  });

  it("VT Senate: 'Chittenden North District' URL → 'chittenden-north'", () => {
    const out = parseBallotpediaCandidatePage(VT_SENATE_HTML, "VT", "state-senate", 2026);
    expect(out).toHaveLength(1);
    expect(out[0].district).toBe("chittenden-north");
  });

  it("NH House: 'District Belknap 1' URL → 'belknap-1' (leading District_ stripped)", () => {
    const out = parseBallotpediaCandidatePage(NH_HOUSE_HTML, "NH", "state-house", 2026);
    expect(out).toHaveLength(1);
    expect(out[0].district).toBe("belknap-1");
  });

  it("falls back to text 'District N' when no anchor on the office cell", () => {
    const html = `
<table class="wikitable sortable collapsible candidateListTablePartisan"><tbody>
<tr><td colspan="4"><h4>Some State general election 2026</h4></td></tr>
<tr><td>Office</td><td>Democratic</td><td>Republican</td><td>Other</td></tr>
<tr>
<td>District 5</td>
<td><span class="candidate"><a href="/x">X Y</a></span></td>
<td></td>
<td></td>
</tr>
</tbody></table>`;
    const out = parseBallotpediaCandidatePage(html, "OH", "state-senate", 2026);
    expect(out[0]?.district).toBe("5");
  });
});

// ─── Nebraska nonpartisan (Office | Candidates two-column table) ────────────

const NE_HTML = `
<html><body>
<table class="wikitable sortable collapsible jquery-tablesorter">
<tbody>
<tr><td colspan="2"><h4>Nebraska State Senate general election 2026</h4></td></tr>
<tr><td colspan="2"><ul><li>Incumbents are marked with an (i) after their name.</li></ul></td></tr>
<tr><td>Office</td><td>Candidates</td></tr>
<tr>
<td>District 4</td>
<td><a href="/R._Brad_von_Gillern">R. Brad von Gillern</a>&#160;(i)<br /><a href="/Cindy_Maxwell-Ostdiek">Cindy Maxwell-Ostdiek</a>&#160;<br /></td>
</tr>
<tr>
<td>District 12</td>
<td><a href="/Merv_Riepe">Merv Riepe</a>&#160;(i)<br /><a href="/Christy_Knorr">Christy Knorr</a>&#160;<br /></td>
</tr>
</tbody></table>
</body></html>
`;

describe("parseNonpartisanCandidatePage — Nebraska", () => {
  it("extracts candidates from Office|Candidates two-column table", () => {
    const out = parseNonpartisanCandidatePage(NE_HTML, "NE", 2026);
    expect(out).toHaveLength(4);
  });

  it("tags all candidates with party='Nonpartisan' (NE unicameral)", () => {
    const out = parseNonpartisanCandidatePage(NE_HTML, "NE", 2026);
    expect(out.every((c) => c.party === "Nonpartisan")).toBe(true);
  });

  it("flags (i) incumbents via bp_incumbent", () => {
    const out = parseNonpartisanCandidatePage(NE_HTML, "NE", 2026);
    const gillern = out.find((c) => c.name === "R. Brad von Gillern")!;
    expect(gillern.extraRefs?.bp_incumbent).toBe("true");
    const riepe = out.find((c) => c.name === "Merv Riepe")!;
    expect(riepe.extraRefs?.bp_incumbent).toBe("true");
  });

  it("maps to state-senate (NE has no state-house)", () => {
    const out = parseNonpartisanCandidatePage(NE_HTML, "NE", 2026);
    expect(out.every((c) => c.officeSlug === "state-senate")).toBe(true);
  });

  it("returns empty array when no Office|Candidates table is present", () => {
    expect(parseNonpartisanCandidatePage("<html></html>", "NE", 2026)).toEqual([]);
  });
});
