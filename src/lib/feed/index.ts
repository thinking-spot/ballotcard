import type { FeedItem, FeedProvider } from "./types";

export type { FeedItem, FeedItemKind, FeedProvider } from "./types";

// Registered activity providers. Empty until articleOne (or another source)
// access lands — at which point we push a provider here and the official
// Activity section lights up with zero page changes.
const providers: FeedProvider[] = [];

export function registerFeedProvider(provider: FeedProvider): void {
  providers.push(provider);
}

/**
 * Aggregate activity for an official across all registered providers,
 * newest first. Returns [] when no provider has data yet — the official
 * page renders an honest "activity coming" state in that case.
 */
export async function getOfficialActivity(params: {
  externalRefs: Record<string, string>;
  limit?: number;
}): Promise<FeedItem[]> {
  if (providers.length === 0) return [];

  const results = await Promise.all(
    providers.map((p) =>
      p.getActivity(params).catch(() => [] as FeedItem[])
    )
  );

  const merged = results.flat();
  merged.sort(
    (a, b) =>
      new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
  );

  return params.limit ? merged.slice(0, params.limit) : merged;
}

/** Whether any activity provider is currently wired up. */
export function hasFeedProviders(): boolean {
  return providers.length > 0;
}
