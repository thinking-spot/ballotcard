// Registry of per-state candidate scrapers. The orchestrator iterates this
// map and runs each registered fetcher; states without a scraper render the
// existing "Candidate filings aren't published here yet" empty state.

import type { ScrapedCandidate } from "./types";
import { fetchFloridaStateLegCandidates } from "./fl";
import { fetchMissouriCandidates } from "./mo";
import { fetchNorthCarolinaCandidates } from "./nc";
import { fetchPennsylvaniaCandidates } from "./pa";
import { fetchMichiganCandidates } from "./mi";
import {
  fetchBallotpediaState,
  fetchNebraskaCandidates,
  BALLOTPEDIA_STATES,
} from "./ballotpedia";

export type StateScraper = (cycle: number) => Promise<ScrapedCandidate[]>;

// Primary-source scrapers (direct SoS data, richer fields than Ballotpedia).
// These take precedence over the Ballotpedia fallback when both exist.
const PRIMARY_SOURCES: Record<string, StateScraper> = {
  FL: fetchFloridaStateLegCandidates,
  MO: (cycle) => fetchMissouriCandidates(cycle), // SE + CN by default
  NC: fetchNorthCarolinaCandidates,
  PA: fetchPennsylvaniaCandidates,
  MI: fetchMichiganCandidates,
};

// Auto-register a Ballotpedia fetcher for every state in the Ballotpedia
// registry that doesn't already have a primary source. See
// docs/ballotpedia-pipeline.md for the workflow.
function buildSourceRegistry(): Record<string, StateScraper> {
  const out: Record<string, StateScraper> = { ...PRIMARY_SOURCES };
  for (const state of Object.keys(BALLOTPEDIA_STATES)) {
    if (out[state]) continue; // primary source already registered
    // Nebraska is nonpartisan unicameral — needs the dedicated parser.
    out[state] =
      state === "NE"
        ? (cycle) => fetchNebraskaCandidates(cycle)
        : (cycle) => fetchBallotpediaState(state, cycle);
  }
  return out;
}

export const STATE_CANDIDATE_SOURCES: Record<string, StateScraper> = buildSourceRegistry();

export type { ScrapedCandidate };
