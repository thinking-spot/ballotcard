import { describe, it, expect } from "vitest";
import { parseNcCandidateCsv } from "../nc";

const HEADER =
  '"election_dt","county_name","contest_name","name_on_ballot","first_name","middle_name","last_name","name_suffix_lbl","nick_name","street_address","city","state","zip_code","phone","office_phone","business_phone","email","candidacy_dt","party_contest","party_candidate","is_unexpired","has_primary","is_partisan","vote_for","term"';

// US Senate is statewide — NC's CSV repeats the same candidate across all
// 100 counties. The parser must dedupe to one row per (contest, name).
const ROW_US_SEN_ALAMANCE =
  '"11/03/2026","ALAMANCE","US SENATE","Roy Cooper","ROY","ASBERRY","COOPER","III","","PO BOX 1190","RALEIGH","NC","27602","","","9196737115","ATIILGHMAN@ROYCOOPER.COM","12/03/2025","","DEM","FALSE","FALSE","TRUE","1","6"';

const ROW_US_SEN_ALEXANDER =
  '"11/03/2026","ALEXANDER","US SENATE","Roy Cooper","ROY","ASBERRY","COOPER","III","","PO BOX 1190","RALEIGH","NC","27602","","","9196737115","ATIILGHMAN@ROYCOOPER.COM","12/03/2025","","DEM","FALSE","FALSE","TRUE","1","6"';

const ROW_US_SEN_WHATLEY =
  '"11/03/2026","ALAMANCE","US SENATE","Michael Whatley","MICHAEL","DAVID","WHATLEY","","","1812 KENDRICK RD","GASTONIA","NC","28056","7048656094","","7042698497","INFO@WHATLEYFORSENATE.COM","12/02/2025","","REP","FALSE","FALSE","TRUE","1","6"';

const ROW_US_HOUSE_07 =
  '"11/03/2026","NEW HANOVER","US HOUSE OF REPRESENTATIVES DISTRICT 7","David Rouzer","DAVID","E","ROUZER","","","123 MAIN ST","BENSON","NC","27504","","","","","12/06/2025","","REP","FALSE","FALSE","TRUE","1","2"';

const ROW_NC_SEN_08 =
  '"11/03/2026","NEW HANOVER","NC STATE SENATE DISTRICT 08","Michael Lee","MICHAEL","V","LEE","","","456 OAK ST","WILMINGTON","NC","28401","","","","","12/02/2025","","REP","FALSE","FALSE","TRUE","1","2"';

const ROW_NC_HOUSE_018 =
  '"11/03/2026","NEW HANOVER","NC HOUSE OF REPRESENTATIVES DISTRICT 018","Frank Iler","FRANK","","ILER","","","789 PINE ST","OAK ISLAND","NC","28465","","","","","12/03/2025","","REP","FALSE","FALSE","TRUE","1","2"';

const ROW_COUNTY_SHERIFF =
  '"11/03/2026","ALAMANCE","ALAMANCE COUNTY SHERIFF","Terry Johnson","TERRY","","JOHNSON","","","123 SHERIFF LN","GRAHAM","NC","27253","","","","","12/05/2025","","REP","FALSE","FALSE","TRUE","1","4"';

function csv(...rows: string[]): string {
  return [HEADER, ...rows].join("\n");
}

describe("parseNcCandidateCsv", () => {
  it("collapses statewide US Senate duplicates across counties to one row per candidate", () => {
    const out = parseNcCandidateCsv(
      csv(ROW_US_SEN_ALAMANCE, ROW_US_SEN_ALEXANDER, ROW_US_SEN_WHATLEY),
      2026
    );
    expect(out).toHaveLength(2);
    const names = out.map((c) => c.name).sort();
    expect(names).toEqual(["Michael Whatley", "Roy Cooper"]);
  });

  it("maps US SENATE → us-senate-class-ii for the 2026 cycle (NC's Class II seat)", () => {
    const out = parseNcCandidateCsv(csv(ROW_US_SEN_WHATLEY), 2026);
    expect(out[0].officeSlug).toBe("us-senate-class-ii");
    expect(out[0].district).toBe("0");
  });

  it("parses US House districts", () => {
    const out = parseNcCandidateCsv(csv(ROW_US_HOUSE_07), 2026);
    expect(out[0]).toMatchObject({
      officeSlug: "us-house",
      district: "7",
      name: "David Rouzer",
      party: "Republican",
    });
  });

  it("parses NC state Senate + NC state House with un-padded districts", () => {
    const out = parseNcCandidateCsv(csv(ROW_NC_SEN_08, ROW_NC_HOUSE_018), 2026);
    expect(out[0]).toMatchObject({ officeSlug: "state-senate", district: "8" });
    expect(out[1]).toMatchObject({ officeSlug: "state-house", district: "18" });
  });

  it("expands party codes (REP → Republican, DEM → Democratic, LIB → Libertarian)", () => {
    const out = parseNcCandidateCsv(
      csv(ROW_US_SEN_ALAMANCE, ROW_US_SEN_WHATLEY),
      2026
    );
    const partyByName = Object.fromEntries(out.map((c) => [c.name, c.party]));
    expect(partyByName["Roy Cooper"]).toBe("Democratic");
    expect(partyByName["Michael Whatley"]).toBe("Republican");
  });

  it("ignores contests outside state-leg / federal (county boards, sheriffs, school)", () => {
    const out = parseNcCandidateCsv(csv(ROW_COUNTY_SHERIFF, ROW_NC_SEN_08), 2026);
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("Michael Lee");
  });

  it("handles RFC-4180 quoted fields (commas in addresses don't break parsing)", () => {
    const tricky =
      '"11/03/2026","WAKE","NC STATE SENATE DISTRICT 14","Jane Smith","JANE","","SMITH","","","123 MAIN ST, APT 4","RALEIGH","NC","27601","","","","","12/03/2025","","DEM","FALSE","FALSE","TRUE","1","2"';
    const out = parseNcCandidateCsv(csv(tricky), 2026);
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("Jane Smith");
    expect(out[0].extraRefs?.city).toBe("RALEIGH");
  });

  it("accepts both 'NC STATE SENATE' (current) and 'NC SENATE' (older) contest names", () => {
    const oldFormat =
      '"11/03/2026","WAKE","NC SENATE DISTRICT 8","Older Name","OLDER","","NAME","","","","RALEIGH","NC","27601","","","","","12/03/2025","","DEM","FALSE","FALSE","TRUE","1","2"';
    const out = parseNcCandidateCsv(csv(oldFormat), 2026);
    expect(out[0]?.officeSlug).toBe("state-senate");
    expect(out[0]?.district).toBe("8");
  });
});
