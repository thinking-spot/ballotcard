// Types for the ingestion pipeline.

// Shape of each entry in legislators-current.json from theunitedstates.io
export type LegislatorId = {
  bioguide: string;
  thomas?: string;
  govtrack?: number;
  opensecrets?: string;
  fec?: string[];
};

export type LegislatorName = {
  first: string;
  last: string;
  official_full?: string;
};

export type LegislatorTerm = {
  type: "sen" | "rep";
  start: string; // YYYY-MM-DD
  end: string;
  state: string; // two-letter
  district?: number; // for reps only
  class?: 1 | 2 | 3; // for senators only
  party: string;
  url?: string;
};

export type Legislator = {
  id: LegislatorId;
  name: LegislatorName;
  terms: LegislatorTerm[];
};

// Shape of seed-data/governors.json
export type GovernorEntry = {
  state: string; // two-letter
  name: string;
  party: string;
  termStart: string; // YYYY-MM-DD
  termEnd: string;
  nextElection: string; // YYYY-MM-DD
  termYears: number;
  ballotpedia?: string;
};

// Shape of seed-data/mayors.json
export type MayorEntry = {
  geoSlug: string; // e.g. "ny/new-york-city"
  cityName: string;
  state: string; // two-letter
  name: string;
  party: string;
  termStart: string;
  // Null when only the term-end year is public (e.g. a seat filled by a
  // late-seated runoff winner) — a wrong date is worse than null.
  termEnd: string | null;
  nextElection: string | null;
  termYears: number;
  ballotpedia?: string;
};

// Shape of seed-data/statewide-execs.json
export type StatewideExecEntry = {
  state: string; // two-letter
  office:
    | "lieutenant_governor"
    | "attorney_general"
    | "secretary_of_state"
    | "treasurer";
  title: string; // real ballot title, e.g. "Secretary of State", "Comptroller"
  name: string;
  party: string | null;
  tookOffice: string | null; // year or YYYY-MM-DD
  selection: "elected_partisan" | "appointed";
  selectionDetail: string;
  nextElection: string | null;
};

// Shape of seed-data/federal-execs.json
export type FederalExecEntry = {
  office: "president" | "vice-president";
  title: string;
  name: string;
  party: string;
  termStart: string;
  termEnd: string;
  firstTookOffice: string;
  nextElection: string;
  termYears: number;
  photoUrl?: string;
  wikipedia?: string;
  ballotpedia?: string;
};

// Shape of seed-data/high-courts.json
export type HighCourtJustice = {
  name: string;
  role: "chief" | "associate";
  // YYYY-MM-DD when the swearing-in date is public; bare "YYYY" otherwise
  // (stored as Jan 1 / Dec 31 of that year — see seed-data/README.md).
  termStart: string;
  termEnd: string | null;
  party: string | null; // only for partisan-court justices with a public affiliation
  ballotpedia?: string;
};

export type HighCourtEntry = {
  state: string; // two-letter
  court: "supreme-court" | "court-of-criminal-appeals"; // office slug
  courtName: string; // proper name, e.g. "New York Court of Appeals"
  seats: number; // total seats — offices are created for vacancies too
  selectionMethod:
    | "elected_partisan"
    | "elected_nonpartisan"
    | "retention"
    | "appointed";
  selectionDetail: string;
  termYears: number;
  ballotpediaCourt?: string;
  justices: HighCourtJustice[];
};

// A person row from Open States bulk people CSV (data.openstates.org).
export type OpenStatesPerson = {
  id: string; // ocd-person/...
  name: string;
  current_party: string;
  current_district: string;
  current_chamber: "upper" | "lower";
  image: string;
};
