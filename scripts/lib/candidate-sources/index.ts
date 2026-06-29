// Registry of per-state candidate scrapers. The orchestrator iterates this
// map and runs each registered fetcher; states without a scraper render the
// existing "Candidate filings aren't published here yet" empty state.

import type { ScrapedCandidate } from "./types";
import { fetchFloridaStateLegCandidates } from "./fl";
import { fetchMissouriCandidates } from "./mo";
import { fetchNorthCarolinaCandidates } from "./nc";
import { fetchPennsylvaniaCandidates } from "./pa";

export type StateScraper = (cycle: number) => Promise<ScrapedCandidate[]>;

export const STATE_CANDIDATE_SOURCES: Record<string, StateScraper> = {
  FL: fetchFloridaStateLegCandidates,
  MO: (cycle) => fetchMissouriCandidates(cycle), // SE + CN by default
  NC: fetchNorthCarolinaCandidates,
  PA: fetchPennsylvaniaCandidates,
};

export type { ScrapedCandidate };
