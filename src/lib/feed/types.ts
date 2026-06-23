// The FeedItem contract for the official Activity section.
// Providers (articleOne first, when access lands) map their data into FeedItem.
// See docs/V1-SPEC.md § "The articleOne feed". UI copy calls this "Activity", never "feed".

export type FeedItemKind =
  | "vote"
  | "floor_statement"
  | "hearing"
  | "testimony"
  | "news_mention"
  | "press_release";

export type FeedItem = {
  id: string;
  /** bioguide / openstates id of the official this item belongs to */
  officialExternalId: string;
  kind: FeedItemKind;
  /** ISO-8601 timestamp */
  occurredAt: string;
  title: string;
  summary?: string;
  sourceUrl: string;
  /** e.g. "Congressional Record", "Associated Press" */
  sourceName: string;
  chamber?: "house" | "senate";
  /** vote position, bill id, committee, etc. — provider-specific */
  metadata?: Record<string, unknown>;
};

/**
 * A source of activity for officials. Implement this interface to add a provider
 * (articleOne, Congress.gov, a news API). The official page renders whatever the
 * registered providers return, newest first. Never bypass this interface.
 */
export interface FeedProvider {
  readonly name: string;
  /**
   * Return activity for an official, identified by their external refs
   * (bioguide, openstates, fec…). Return [] when this provider has nothing.
   */
  getActivity(params: {
    externalRefs: Record<string, string>;
    limit?: number;
  }): Promise<FeedItem[]>;
}
