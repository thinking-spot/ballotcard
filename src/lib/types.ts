// Core domain types for BallotCard.
// These match the database schema and are imported by components and server actions.

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

export type Office = {
  id: string;
  districtId: string;
  title: string;
  kind: "legislative" | "executive" | "judicial" | "board";
  seatLabel?: string;
  termYears?: number;
  nextElectionAt?: Date;
  isSeeded: boolean;
  activatedAt?: Date;
  externalRefs?: Record<string, string>;
};

// ─── People ──────────────────────────────────────────────────────────────────

export type User = {
  id: string;
  username: string;
  homeDistrictId?: string;
  homeDistrictSetAt?: Date;
  createdAt: Date;
};

export type Official = {
  id: string;
  officeId: string;
  name: string;
  party?: string;
  termStart?: Date;
  termEnd?: Date;
  isCurrent: boolean;
  externalRefs?: Record<string, string>;
};

export type Witness = {
  id: string;
  officeId: string;
  userId: string;
  username: string;
  termStart: Date;
  termEnd: Date;
  isCurrent: boolean;
  statement?: string;
};

// ─── Elections ───────────────────────────────────────────────────────────────

export type WitnessElection = {
  id: string;
  officeId: string;
  termStart: Date;
  termEnd: Date;
  filingOpensAt: Date;
  votingOpensAt: Date;
  votingClosesAt: Date;
  quorum: number;
};

export type WitnessCandidacy = {
  id: string;
  electionId: string;
  userId: string;
  username: string;
  statementShort: string;
  statementLong?: string;
  withdrawnAt?: Date;
  createdAt: Date;
};

// ─── Content ─────────────────────────────────────────────────────────────────

export type FeaturedLink = {
  url: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  domain: string;
  publishedAt?: Date;
  fetchedAt: Date;
  fetchStatus: "ok" | "no_metadata" | "failed" | "timeout" | "blocked";
};

export type Tag = {
  id: string;
  kind: "pol" | "district" | "issue";
  refId?: string;
  label: string;
  scopeDistrictId?: string;
};

export type Post = {
  id: string;
  authorId?: string;
  authorUsername?: string;
  authorIsWitness: boolean;
  parentId?: string;
  officeId?: string;
  title?: string;
  body: string;
  isWitnessPost: boolean;
  isPinned: boolean;
  featuredLink?: FeaturedLink;
  tags: Tag[];
  replyCount: number;
  createdAt: Date;
  updatedAt?: Date;
  deletedAt?: Date;
};

// ─── UI state ────────────────────────────────────────────────────────────────

export type Layer = "local" | "county" | "state" | "national";

export type OfficeState =
  | "cold" // no Witness, no posts, no watchers
  | "warming" // some engagement, partial
  | "healthy" // active Witness posting regularly
  | "dormant" // Witness elected but inactive >30 days
  | "vacant" // active watchers but no Witness currently seated
  | "not_activated"; // sub-threshold office not on BallotCard

// ─── Server action responses ──────────────────────────────────────────────────

export type ActionResult<T = void> =
  | { success: true; data?: T }
  | { error: string };
