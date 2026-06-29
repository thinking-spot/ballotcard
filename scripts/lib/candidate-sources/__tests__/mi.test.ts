import { describe, it, expect } from "vitest";
import { parseMiCandidateHtml } from "../mi";

// JasperReports HTML has many empty <td> spacers. The parser uses regex
// with bounded-distance lookahead — these fixtures use the same shape as
// the real MI BOE output (Last, First name format + party + filing date).

function section(opts: {
  anchor: string;
  party: string;
  name: string;
  filedAt: string;
}): string {
  return `
<a id="${opts.anchor}"></a><span>${opts.anchor.replace(/_/g, " ")}</span>
<tr><td><span>&nbsp;</span></td><td></td>
<td><span>${opts.party} </span></td>
<td></td>
<td><span>${opts.name} </span></td>
<td></td>
<td><span>PO Box 1, Detroit, MI 48232</span></td>
<td></td>
<td><span>${opts.filedAt}</span></td>
<td></td>
<td><span>Filing Fee</span></td>
</tr>
`;
}

describe("parseMiCandidateHtml", () => {
  it("parses a State Senator section, flipping Last,First → First Last", () => {
    const html =
      section({
        anchor: "1st_District_State_Senator_4_Year_Term__1__Position_Files_In_WAYNE_County",
        party: "Democratic",
        name: "Aiyash, Abraham",
        filedAt: "04/20/2026",
      });
    const out = parseMiCandidateHtml(html, 2026);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      source: "mi_sos",
      state: "MI",
      officeSlug: "state-senate",
      district: "1",
      name: "Abraham Aiyash",
      party: "Democratic",
      cycle: 2026,
      electionDate: "2026-11-03",
    });
    expect(out[0].extraRefs?.filed_at).toBe("04/20/2026");
    expect(out[0].extraRefs?.primary_date).toBe("2026-08-04");
  });

  it("maps Representative_in_State_Legislature → state-house", () => {
    const html = section({
      anchor: "12th_District_Representative_in_State_Legislature_2_Year_Term__1__Position_Files_In_OAKLAND_County",
      party: "Republican",
      name: "Smith, John",
      filedAt: "04/22/2026",
    });
    expect(parseMiCandidateHtml(html, 2026)[0]).toMatchObject({
      officeSlug: "state-house",
      district: "12",
    });
  });

  it("maps Representative_in_Congress → us-house, three-digit ordinals like 11th", () => {
    const html = section({
      anchor: "11th_District_Representative_in_Congress_2_Year_Term__1__Position_Files_In_OAKLAND_County",
      party: "Democratic",
      name: "Stevens, Haley",
      filedAt: "04/22/2026",
    });
    expect(parseMiCandidateHtml(html, 2026)[0]).toMatchObject({
      officeSlug: "us-house",
      district: "11",
      name: "Haley Stevens",
    });
  });

  it("dedupes multi-county filings for the same seat", () => {
    // Same candidate filed in two counties — should collapse to one row.
    const html =
      section({
        anchor: "20th_District_State_Senator_4_Year_Term__1__Position_Files_In_KENT_County",
        party: "Democratic",
        name: "Jones, Mary",
        filedAt: "04/20/2026",
      }) +
      section({
        anchor: "20th_District_State_Senator_4_Year_Term__1__Position_Files_In_OTTAWA_County",
        party: "Democratic",
        name: "Jones, Mary",
        filedAt: "04/20/2026",
      });
    const out = parseMiCandidateHtml(html, 2026);
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("Mary Jones");
  });

  it("keeps different candidates in the same district", () => {
    const html =
      section({
        anchor: "5th_District_State_Senator_4_Year_Term__1__Position_Files_In_WAYNE_County",
        party: "Democratic",
        name: "Doe, Jane",
        filedAt: "04/20/2026",
      }) +
      section({
        anchor: "5th_District_State_Senator_4_Year_Term__1__Position_Files_In_WAYNE_County",
        party: "Republican",
        name: "Roe, Richard",
        filedAt: "04/21/2026",
      });
    const out = parseMiCandidateHtml(html, 2026);
    expect(out).toHaveLength(2);
    expect(out.map((c) => c.name).sort()).toEqual(["Jane Doe", "Richard Roe"]);
  });

  it("ignores anchors for offices we don't cover (Governor etc.)", () => {
    const html = `
<a id="1st_District_Governor_4_Year_Term__1__Position_Files_In_State"></a>
<tr><td><span>Democratic </span></td><td><span>Whitmer, Gretchen </span></td><td><span>04/20/2026</span></td></tr>
`;
    expect(parseMiCandidateHtml(html, 2026)).toEqual([]);
  });

  it("handles middle initials and compound first names (Last, First M)", () => {
    const html = section({
      anchor: "30th_District_Representative_in_State_Legislature_2_Year_Term__1__Position_Files_In_KENT_County",
      party: "Republican",
      name: "VanWoerkom, Karl D",
      filedAt: "04/20/2026",
    });
    const out = parseMiCandidateHtml(html, 2026);
    expect(out[0].name).toBe("Karl D VanWoerkom");
  });
});
