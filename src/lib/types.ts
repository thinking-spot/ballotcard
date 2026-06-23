// Core domain types for BallotCard.
// These match the database schema (see migrations/) and are imported by
// data-access modules and components. v1.0: pure civic data, no auth/forum types.

// ─── Geography ───────────────────────────────────────────────────────────────

export type DistrictKind =
  | "country"
  | "state"
  | "us_house"
  | "us_senate_state"
  | "governor_state"
  | "state_house"
  | "state_senate"
  | "county"
  | "municipality"
  | "school_board"
  | "judicial";

export type District = {
  id: string;
  name: string;
  kind: DistrictKind;
  state?: string;
  parentId?: string;
  geoSlug: string;
  externalRefs?: Record<string, string>;
  activatedAt?: Date;
  createdAt: Date;
};

// ─── Offices ─────────────────────────────────────────────────────────────────
// Three classification axes (see docs/V1-SPEC.md). Only elected_* and retention
// offices render on a ballot card; appointed offices exist for context.

export type OfficeBranch =
  | "executive"
  | "legislative"
  | "judicial"
  | "law_enforcement"
  | "other";

export type OfficeLevel =
  | "federal"
  | "state"
  | "county"
  | "municipal"
  | "special";

export type SelectionMethod =
  | "elected_partisan"
  | "elected_nonpartisan"
  | "retention"
  | "appointed";

export type Office = {
  id: string;
  districtId: string;
  title: string;
  branch: OfficeBranch;
  level: OfficeLevel;
  selectionMethod: SelectionMethod;
  seatLabel?: string;
  termYears?: number;
  nextElectionAt?: Date;
  isSeeded: boolean;
  activatedAt?: Date;
  externalRefs?: Record<string, string>;
};

// ─── Officials ───────────────────────────────────────────────────────────────

export type Official = {
  id: string;
  officeId: string;
  name: string;
  party?: string;
  termStart?: Date;
  termEnd?: Date;
  firstTookOffice?: Date;
  photoUrl?: string;
  isCurrent: boolean;
  externalRefs?: Record<string, string>;
};

// ─── UI state ────────────────────────────────────────────────────────────────

export type Layer = "municipal" | "county" | "state" | "federal";
