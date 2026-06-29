import { describe, it, expect } from "vitest";
import { parsePaCandidateHtml } from "../pa";

// A minimal HTML fixture in PA's actual shape — one hidden input per office
// group, JSON-encoded candidate rows inside the value attribute. Real PA
// pages have 40+ such inputs; we test the parser against a representative
// slice that exercises every office mapping and one ignored office.
function fixture(rows: Record<string, unknown>[][]): string {
  return rows
    .map(
      (group, i) =>
        `<input id='ElectionOffice${i + 1}dataJson' type='hidden' value='${JSON.stringify(group).replace(/'/g, "&#39;")}' />`
    )
    .join("\n");
}

describe("parsePaCandidateHtml", () => {
  it("maps SENATOR IN THE GENERAL ASSEMBLY → state-senate, strips ordinal suffix from district", () => {
    const html = fixture([
      [
        {
          Office: "SENATOR IN THE GENERAL ASSEMBLY ",
          District: "12th Senatorial District",
          Party: "Democratic",
          "Candidate Name": "JANE DOE",
          "Ballot Position": 1,
          CandidateNumber: "2026C0100",
        },
      ],
    ]);
    const out = parsePaCandidateHtml(html, 2026);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      source: "pa_sos",
      state: "PA",
      officeSlug: "state-senate",
      district: "12",
      name: "Jane Doe",
      party: "Democratic",
      cycle: 2026,
      electionDate: "2026-11-03",
      externalId: "2026C0100",
    });
    expect(out[0].extraRefs?.pa_ballot_position).toBe("1");
  });

  it("maps REPRESENTATIVE IN THE GENERAL ASSEMBLY → state-house (203 districts, three-digit ordinals)", () => {
    const html = fixture([
      [
        {
          Office: "REPRESENTATIVE IN THE GENERAL ASSEMBLY ",
          District: "203rd Legislative District",
          Party: "Republican",
          "Candidate Name": "JOHN SMITH",
          "Ballot Position": 1,
          CandidateNumber: "2026C0203",
        },
      ],
    ]);
    const out = parsePaCandidateHtml(html, 2026);
    expect(out[0]).toMatchObject({
      officeSlug: "state-house",
      district: "203",
      name: "John Smith",
    });
  });

  it("maps REPRESENTATIVE IN CONGRESS → us-house", () => {
    const html = fixture([
      [
        {
          Office: "REPRESENTATIVE IN CONGRESS ",
          District: "7th Congressional District",
          Party: "Democratic",
          "Candidate Name": "CAROL OBANDO-DERSTINE",
          "Ballot Position": 1,
          CandidateNumber: "2026C0998",
        },
      ],
    ]);
    const out = parsePaCandidateHtml(html, 2026);
    expect(out[0]).toMatchObject({ officeSlug: "us-house", district: "7" });
  });

  it("ignores offices outside our scope (Governor, Lt Gov, state committee)", () => {
    const html = fixture([
      [
        {
          Office: "GOVERNOR ",
          District: "Statewide",
          Party: "Democratic",
          "Candidate Name": "JOSH SHAPIRO",
        },
      ],
      [
        {
          Office: "MEMBER OF DEMOCRATIC STATE COMMITTEE ",
          District: "1st Senatorial District",
          Party: "Democratic",
          "Candidate Name": "SOME PERSON",
        },
      ],
    ]);
    expect(parsePaCandidateHtml(html, 2026)).toEqual([]);
  });

  it("handles all four ordinal forms (1st, 2nd, 3rd, 4th, 11th, 21st, 22nd, 23rd)", () => {
    const cases = ["1st", "2nd", "3rd", "4th", "11th", "21st", "22nd", "23rd", "100th", "101st"];
    const html = fixture(
      cases.map((ord) => [
        {
          Office: "SENATOR IN THE GENERAL ASSEMBLY ",
          District: `${ord} Senatorial District`,
          Party: "Republican",
          "Candidate Name": `CAND ${ord}`,
          CandidateNumber: `2026C${ord}`,
        },
      ])
    );
    const out = parsePaCandidateHtml(html, 2026);
    expect(out.map((c) => c.district)).toEqual([
      "1", "2", "3", "4", "11", "21", "22", "23", "100", "101",
    ]);
  });

  it("survives a malformed JSON blob and continues to the next input", () => {
    const goodGroup = JSON.stringify([
      {
        Office: "SENATOR IN THE GENERAL ASSEMBLY ",
        District: "1st Senatorial District",
        Party: "Democratic",
        "Candidate Name": "OK CAND",
        CandidateNumber: "2026C001",
      },
    ]);
    const html = [
      `<input id='ElectionOffice1dataJson' type='hidden' value='[{not-json'/>`,
      `<input id='ElectionOffice2dataJson' type='hidden' value='${goodGroup}' />`,
    ].join("\n");
    const out = parsePaCandidateHtml(html, 2026);
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("Ok Cand");
  });

  it("synthesizes a stable externalId when PA omits CandidateNumber", () => {
    const html = fixture([
      [
        {
          Office: "SENATOR IN THE GENERAL ASSEMBLY ",
          District: "4th Senatorial District",
          Party: "Democratic",
          "Candidate Name": "ART HAYWOOD",
        },
      ],
    ]);
    const out = parsePaCandidateHtml(html, 2026);
    expect(out[0].externalId).toBe("state-senate-4-democratic-art-haywood");
  });
});
