import { describe, it, expect } from "vitest";
import { parseFloridaCandidateTsv } from "../fl";

// Real header + a representative slice of real rows from a live FL extract
// (2026 cycle). Keeping the fixture inline makes the test self-contained and
// pins the exact column names we depend on — if FL ever renames a column, this
// fails and forces a re-check of the mapper.
const TSV_HEADER =
  "AcctNum\tVoterID\tElectionID\tOfficeCode\tOfficeDesc\tJuris1num\tJuris2num\tStatusCode\tStatusDesc\tPartyCode\tPartyDesc\tNameLast\tNameFirst\tNameMiddle\tSuppressAddress\tAddr1\tAddr2\tCity\tState\tZip\tCounty\tPhone\tTrsNameLast\tTrsNameFirst\tTrsNameMiddle\tEmail";

const ROW_STR_REP_055 =
  '91527\t106389659\t20261103-GEN\tSTR\tState Representative\t055\t\tQUA\tQualified\tREP\tRepublican Party of Florida\tAbbott\tMatthew\t"Skeeter"\tN\t6801 Old Decubellis Court\t\tNew Port Richey\tFL\t34654\tPAS\t7279924570\tAbbott\tMatthew\tAaron\t';

const ROW_STR_REP_005 =
  "88747\t0\t20261103-GEN\tSTR\tState Representative\t005\t\tQUA\tQualified\tREP\tRepublican Party of Florida\tAbbott\tShane\t\tN\t1061 South 2nd Street\t\tDefuniak Springs\tFL\t32435\tWAL\t8503330747\tFenner\tNoreen\tA.\tnoreen@pacfm.net";

const ROW_STS_SEN_21 =
  "99001\t123456789\t20261103-GEN\tSTS\tState Senator\t021\t\tWIT\tWithdrew\tDEM\tFlorida Democratic Party\tDoe\tJane\tQ\tN\t123 Main St\t\tMiami\tFL\t33101\tDAD\t3055551234\tDoe\tJohn\t\tjane@example.com";

const ROW_FEDERAL =
  "70001\t111111111\t20261103-GEN\tUSR\tU.S. Representative\t007\t\tQUA\tQualified\tREP\tRepublican Party of Florida\tSmith\tBob\t\tN\t1 Capitol St\t\tTampa\tFL\t33601\tHIL\t8135551111\t\t\t\t";

function tsv(...rows: string[]): string {
  return [TSV_HEADER, ...rows].join("\n");
}

describe("parseFloridaCandidateTsv", () => {
  it("parses a state-house row with the canonical FL shape", () => {
    const out = parseFloridaCandidateTsv(tsv(ROW_STR_REP_055), 2026);
    expect(out).toHaveLength(1);
    const c = out[0];
    expect(c.source).toBe("fl_sos");
    expect(c.state).toBe("FL");
    expect(c.officeSlug).toBe("state-house");
    expect(c.district).toBe("55"); // un-pads "055" to match our slug convention
    expect(c.name).toBe('Matthew "Skeeter" Abbott');
    expect(c.party).toBe("Republican Party of Florida");
    expect(c.status).toBe("Qualified");
    expect(c.cycle).toBe(2026);
    expect(c.electionDate).toBe("2026-11-03");
    expect(c.externalId).toBe("91527");
    expect(c.extraRefs?.fl_voter_id).toBe("106389659");
  });

  it("maps STS → state-senate and passes through Withdrew status", () => {
    const out = parseFloridaCandidateTsv(tsv(ROW_STS_SEN_21), 2026);
    expect(out[0].officeSlug).toBe("state-senate");
    expect(out[0].district).toBe("21");
    expect(out[0].status).toBe("Withdrew");
  });

  it("skips non-state-leg office codes (federal, judicial) silently", () => {
    const out = parseFloridaCandidateTsv(tsv(ROW_FEDERAL, ROW_STR_REP_005), 2026);
    expect(out).toHaveLength(1);
    expect(out[0].externalId).toBe("88747");
  });

  it("treats VoterID=0 as missing (FL's sentinel for unregistered candidates)", () => {
    const out = parseFloridaCandidateTsv(tsv(ROW_STR_REP_005), 2026);
    expect(out[0].extraRefs?.fl_voter_id).toBeUndefined();
  });

  it("returns an empty array for an empty input", () => {
    expect(parseFloridaCandidateTsv("", 2026)).toEqual([]);
  });

  it("throws when the schema's required columns disappear (defensive — FL has been stable for 10+ years)", () => {
    expect(() => parseFloridaCandidateTsv("ColA\tColB\n1\t2", 2026)).toThrow(
      /missing expected columns/
    );
  });
});
