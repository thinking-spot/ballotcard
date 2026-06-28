// Shared shape across per-state candidate scrapers. Each scraper module
// fetches its state's candidate filings, normalizes to this type, and the
// orchestrator (scripts/scrape-candidates.ts) handles district matching,
// incumbency detection, and idempotent upsert into Candidates.

export type ScrapedCandidate = {
  /** "STATE_SOURCE" — e.g. "fl_sos". Lower-snake. Used as the source field. */
  source: string;
  /** Two-letter state code, uppercase. */
  state: string;
  /** Matches Offices.slug — extend as new chambers are wired up. */
  officeSlug:
    | "state-senate"
    | "state-house"
    | "us-house"
    | "us-senate-class-i"
    | "us-senate-class-ii"
    | "us-senate-class-iii";
  /** District number (string, no zero-padding). State-leg matches sldu-/sldl-
   * slugs; US House matches the CD slug (e.g. "07", "al" for at-large);
   * US Senate is statewide so the value is ignored ("0" by convention). */
  district: string;
  /** Display name as the SoS publishes it. Normalization happens at render time. */
  name: string;
  /** Display party label (state-specific naming kept as-is). */
  party?: string;
  /** Source-defined status (Qualified, Withdrew, Unopposed, etc.) — passed through. */
  status?: string;
  /** Election cycle (YYYY) — e.g. 2026. */
  cycle: number;
  /** General-election date (YYYY-MM-DD) when known. */
  electionDate?: string;
  /** SoS's own identifier — the upsert key for this source. */
  externalId: string;
  /** Anything else worth keeping (contact info, treasurer, etc.). */
  extraRefs?: Record<string, string>;
};
