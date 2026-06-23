// What canonical offices should appear on a ballot for each layer of district?
// Templates drive the "honest empty row" architecture: when we don't have an
// office in the DB for a layer we expect (e.g. Sheriff for a county), the
// ballot card still renders the row with "data coming" rather than silently
// omitting it.
//
// Templates are intentionally minimal — only offices that the vast majority of
// US ballots include. Per-state nuance (some counties have a Public Defender on
// the ballot, some don't) is a refinement; the cost of being slightly generic
// is much lower than the cost of looking incomplete.

export type BallotTemplate = {
  /** Slug for the office (used as React key + stable identifier). */
  slug: string;
  /** Function producing the title from the district name (e.g. "Sheriff of Wake County"). */
  title: (districtName: string) => string;
  /** "federal" | "state" | "county" | "municipal" — drives the section. */
  level: string;
  branch: string;
  selectionMethod: string;
};

export const COUNTY_TEMPLATES: BallotTemplate[] = [
  {
    slug: "sheriff",
    title: (d) => `Sheriff of ${d}`,
    level: "county",
    branch: "law_enforcement",
    selectionMethod: "elected_partisan",
  },
  {
    slug: "district-attorney",
    title: (d) => `District Attorney, ${d}`,
    level: "county",
    branch: "law_enforcement",
    selectionMethod: "elected_partisan",
  },
];

export const MUNICIPAL_TEMPLATES: BallotTemplate[] = [
  {
    slug: "mayor",
    title: (d) => `Mayor of ${d}`,
    level: "municipal",
    branch: "executive",
    selectionMethod: "elected_nonpartisan",
  },
];
