import { describe, it, expect } from "vitest";
import { parseMoOfficePage } from "../mo";

// Synthesized from a real MO SoS office page (SE District 8, 2026 primary).
// Keeps the test deterministic and lets us pin the exact HTML shape the
// parser depends on — if MO ever rewrites the page, this fails loudly.
const SE08_HTML = `
<html><body>
  <h3>State Senator - District 8</h3>
  <table>
    <caption>Republican</caption>
    <tr><th class="NameCol">Name</th><th class="AddressCol">Mailing Address</th><th class="RandomCol">Random Number</th><th class="DateCol">Date Filed</th></tr>
    <tr>
      <td class="NameCol">Jon Patterson</td>
      <td class="AddressCol">617 NE LAKE POINTE DR<br/>LEE'S SUMMIT MO 64064</td>
      <td>195</td>
      <td>2/24/2026</td>
    </tr>
    <tr>
      <td class="NameCol">Dan Stacy</td>
      <td class="AddressCol">1215 SW HILLCREST DR<br/>BLUE SPRINGS MO 64015</td>
      <td>398</td>
      <td>2/24/2026</td>
    </tr>
  </table>
  <table>
    <caption>Democratic</caption>
    <tr><th class="NameCol">Name</th><th class="AddressCol">Mailing Address</th><th class="RandomCol">Random Number</th><th class="DateCol">Date Filed</th></tr>
    <tr>
      <td class="NameCol">Keri Ingle</td>
      <td class="AddressCol">PO BOX 2248<br/>LEES SUMMIT MO 64063</td>
      <td>580</td>
      <td>2/24/2026</td>
    </tr>
  </table>
</body></html>
`;

const CD7_HTML = `
<html><body>
  <h3>U.S. Representative - District 7</h3>
  <table>
    <caption>Republican</caption>
    <tr><th class="NameCol">Name</th><th class="AddressCol">Mailing Address</th><th>Random Number</th><th>Date Filed</th></tr>
    <tr>
      <td class="NameCol">Eric Burlison</td>
      <td class="AddressCol">123 Main St<br/>SPRINGFIELD MO 65801</td>
      <td>1</td>
      <td>2/25/2026</td>
    </tr>
  </table>
</body></html>
`;

describe("parseMoOfficePage", () => {
  it("parses a State Senate page across multiple parties", () => {
    const out = parseMoOfficePage(SE08_HTML, "20 SE 08", "state-senate", 2026);
    expect(out).toHaveLength(3);

    expect(out[0]).toMatchObject({
      source: "mo_sos",
      state: "MO",
      officeSlug: "state-senate",
      district: "8",
      name: "Jon Patterson",
      party: "Republican",
      cycle: 2026,
      // The November general — the August primary is provenance in extraRefs.
      electionDate: "2026-11-03",
    });

    // Per-party tables are walked in DOM order — Republicans before Democrats.
    expect(out.map((c) => c.party)).toEqual([
      "Republican",
      "Republican",
      "Democratic",
    ]);
    expect(out.map((c) => c.name)).toEqual([
      "Jon Patterson",
      "Dan Stacy",
      "Keri Ingle",
    ]);
  });

  it("preserves the MO ballot-order Random Number and primary date in extraRefs", () => {
    const out = parseMoOfficePage(SE08_HTML, "20 SE 08", "state-senate", 2026);
    expect(out[0].extraRefs?.mo_random_number).toBe("195");
    expect(out[0].extraRefs?.filed_at).toBe("2/24/2026");
    expect(out[0].extraRefs?.primary_date).toBe("2026-08-04");
  });

  it("synthesizes a stable externalId per (office, party, name)", () => {
    const out = parseMoOfficePage(SE08_HTML, "20 SE 08", "state-senate", 2026);
    expect(out[0].externalId).toBe("20-SE-08::republican::jon-patterson");
    expect(out[2].externalId).toBe("20-SE-08::democratic::keri-ingle");
  });

  it("parses a US House page with the us-house slug + numeric district", () => {
    const out = parseMoOfficePage(CD7_HTML, "25 CN 7", "us-house", 2026);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      officeSlug: "us-house",
      district: "7",
      name: "Eric Burlison",
      party: "Republican",
    });
  });

  it("returns [] for a page with no tables", () => {
    expect(
      parseMoOfficePage("<html><body><h3>Nobody filed</h3></body></html>", "20 SE 08", "state-senate", 2026)
    ).toEqual([]);
  });
});
