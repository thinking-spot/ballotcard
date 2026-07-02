// Cross-source filter for "is this candidate still on the upcoming ballot?"
//
// Each scraper passes through its source's own status vocabulary verbatim
// (FL: "Qualified", "Withdrew", "Did Not Qualify"; FEC: omitted / "C" / etc.).
// We normalize and check against a denylist of statuses that mean "not on
// the ballot" — rather than an allowlist, because allowlists silently drop
// rows when a source adds a new active-status value.

const NOT_ON_BALLOT = new Set([
  "withdrew",
  "withdrawn",
  "did not qualify",
  "disqualified",
  "defeated",
  "transferred to local",
]);

/** True when the candidate row should appear on a forward-looking ballot. */
export function isOnUpcomingBallot(row: { status?: string | null }): boolean {
  const s = (row.status ?? "").toString().trim().toLowerCase();
  if (!s) return true; // missing status → assume on the ballot (FEC + seed rows)
  return !NOT_ON_BALLOT.has(s);
}

// Office slugs that scripts/lib/candidate-sources ever writes rows for (state
// chambers) plus federal, which FEC covers directly. Everything else —
// governor, statewide execs, mayor, county, judicial, etc. — has no candidate
// data source anywhere in the ingestion pipeline; an empty candidate list
// there means "we don't track this office type" rather than "no one has
// filed yet." Used to pick between those two honest empty-state messages.
const STATE_LEG_SLUGS = new Set(["state-senate", "state-house"]);

/** True when BallotCard has (or could have) a candidate feed for this office. */
export function hasCandidateSource(office: { slug: string; level: string }): boolean {
  return office.level === "federal" || STATE_LEG_SLUGS.has(office.slug);
}
