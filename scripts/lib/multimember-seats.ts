// Some state legislative districts elect 2-3 members at-large from one
// district (AZ House, MD House of Delegates, NH House, NJ Assembly, ND
// House, SD House, VT House/Senate, WA House, WV Senate). Open States lists
// each of them under the identical current_district, so a naive one-office-
// per-district ingestion silently drops every seat past the first — a real,
// currently-serving legislator just isn't in BallotCard. Migration 0011
// lets an Office carry a seat_label so each real seat gets its own row.
//
// Guard against Open States data noise (a stale/un-retired record after a
// resignation can transiently duplicate a genuinely single-member district):
// only treat a chamber as multi-member when the duplication is systemic
// (most of its districts show it), not an isolated one-off.

import type { OpenStatesPerson } from "./types";

const MULTIMEMBER_CHAMBER_THRESHOLD = 0.1;

export type SeatAssignment = {
  state: string;
  person: OpenStatesPerson;
  seatLabel: string | null;
};

/**
 * Stable seat assignment: sorts each district's people by their Open States
 * id (unaffected by CSV row order) so the same real seat maps to the same
 * office run over run. Pure — tests exercise it without network/DB access.
 */
export function assignLegislativeSeats(
  states: { abbr: string }[],
  openStatesByState: Map<string, OpenStatesPerson[]>
): SeatAssignment[] {
  const byChamberDistrict = new Map<
    string,
    { state: string; person: OpenStatesPerson }[]
  >();
  const chamberDistrictCounts = new Map<string, { total: number; dup: number }>();

  for (const s of states) {
    const byDistrict = new Map<string, { state: string; person: OpenStatesPerson }[]>();
    for (const p of openStatesByState.get(s.abbr) ?? []) {
      if (!p.current_district) continue;
      const distKey = `${s.abbr}::${p.current_chamber}::${p.current_district}`;
      if (!byDistrict.has(distKey)) byDistrict.set(distKey, []);
      byDistrict.get(distKey)!.push({ state: s.abbr, person: p });
    }
    for (const [distKey, entries] of byDistrict) {
      byChamberDistrict.set(distKey, entries);
      const chamberKey = distKey.split("::").slice(0, 2).join("::");
      const c = chamberDistrictCounts.get(chamberKey) ?? { total: 0, dup: 0 };
      c.total++;
      if (entries.length > 1) c.dup++;
      chamberDistrictCounts.set(chamberKey, c);
    }
  }

  const out: SeatAssignment[] = [];
  for (const [distKey, entries] of byChamberDistrict) {
    const chamberKey = distKey.split("::").slice(0, 2).join("::");
    const counts = chamberDistrictCounts.get(chamberKey)!;
    const isSystemicMultiMember =
      entries.length > 1 && counts.dup / counts.total >= MULTIMEMBER_CHAMBER_THRESHOLD;

    const sorted = [...entries].sort((a, b) => a.person.id.localeCompare(b.person.id));
    if (isSystemicMultiMember) {
      sorted.forEach((entry, i) => {
        out.push({ state: entry.state, person: entry.person, seatLabel: `Seat ${i + 1}` });
      });
    } else {
      // Not a real multi-member chamber — keep prior single-seat behavior
      // (one office, deterministically the lowest Open States id) rather
      // than fabricating a phantom seat from noisy source data.
      out.push({ state: sorted[0].state, person: sorted[0].person, seatLabel: null });
    }
  }
  return out;
}
