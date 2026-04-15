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
  termEnd: string;
  nextElection: string;
  termYears: number;
  ballotpedia?: string;
};
