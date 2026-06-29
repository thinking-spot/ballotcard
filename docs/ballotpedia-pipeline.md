# Ballotpedia state-leg candidate pipeline

A repeatable workflow for ingesting state Senate + state House candidates
from Ballotpedia, for any state in any cycle. Used today for states whose
official SoS endpoints are inaccessible to plain-fetch scraping (OH and GA
are Akamai-blocked), but the pattern scales to all 50 states.

## Why Ballotpedia (and when not to)

Ballotpedia maintains structured per-state, per-chamber election rosters
at predictable URLs. The data they publish ultimately originates from each
state's Secretary of State filings, so it's secondary-source — primary SoS
data is preferred where accessible. We use Ballotpedia as the fallback
when:

- The state SoS site is bot-blocked (OH, GA — Akamai TLS fingerprinting)
- The state SoS hasn't published cycle data yet (TX dropdown stops at 2025)
- The state SoS data shape is too brittle to maintain (PDF-only, etc.)

**Don't** use Ballotpedia when:

- We have a working primary SoS scraper (FL, MO, NC, PA, MI today)
- Ballotpedia data appears stale relative to a primary source
- Data we need isn't expressible as the public-record facts (e.g. fundraising — FEC primary)

The implementation only ingests the **underlying public-record facts** —
name, party, district, incumbency — which under *Feist v. Rural Telephone*
(1991) are not copyrightable in the US. Ballotpedia's expression of those
facts (their prose, infoboxes, analysis) is CC-BY-SA 3.0; we don't copy
any of it. The source label is preserved on every ingested row so the UI
can attribute clearly.

## URL pattern

Every state's chamber-elections page lives at a predictable URL:

```
https://ballotpedia.org/{State_Name}_{Chamber_Path}_elections,_{cycle}
```

`{State_Name}` is the state name with spaces replaced by underscores:
`Ohio`, `North_Carolina`, `West_Virginia`.

`{Chamber_Path}` varies by state:

| Lower chamber name | URL fragment | States |
|---|---|---|
| House of Representatives | `House_of_Representatives` | Most (40 states) |
| State Assembly | `State_Assembly` | CA, NV, NY, WI |
| House of Delegates | `House_of_Delegates` | MD, VA, WV |
| General Assembly | `General_Assembly` | NJ (lower only) |
| _(unicameral)_ | — | NE (senate URL only) |

Upper chamber is always `State_Senate` except NE (also `State_Senate`,
though their unicameral legislature has no lower chamber).

### Examples

```
https://ballotpedia.org/Ohio_State_Senate_elections,_2026
https://ballotpedia.org/Ohio_House_of_Representatives_elections,_2026
https://ballotpedia.org/North_Carolina_State_Senate_elections,_2026
https://ballotpedia.org/California_State_Assembly_elections,_2026
https://ballotpedia.org/Maryland_House_of_Delegates_elections,_2026
https://ballotpedia.org/Nebraska_State_Senate_elections,_2026
```

States with **no 2026 state-leg election** (404s) — skip these:

- Louisiana (off-cycle 2027)
- Mississippi (off-cycle 2027)
- New Jersey (last 2025)
- Virginia (last 2025)

## Page shape

Each page contains a `<table class="candidateListTablePartisan">` with
columns:

| Office | Democratic | Republican | Other |
|---|---|---|---|

Per-district rows. Each candidate is in a `<span class="candidate"><a>Name</a></span>`
with an optional `(i)` suffix for incumbents. The "Other" column contains
free-text annotations like `(Libertarian Party)`, `(Independent)`, or
`(Write-in)`.

Multiple tables can appear on a single page (general + primary + previous
cycles). The parser picks the first table whose caption contains
"general election" — that's the post-primary qualified-candidate roster.

## How to add a new state

Two edits, no migration:

1. **Add the state's display name** in `scripts/lib/candidate-sources/ballotpedia.ts`
   to the `STATE_NAMES` map:

   ```ts
   const STATE_NAMES: Record<string, BallotpediaStateConfig> = {
     OH: { displayName: "Ohio" },
     CA: { displayName: "California", houseFragment: "State_Assembly" },
     MD: { displayName: "Maryland", houseFragment: "House_of_Delegates" },
     NE: { displayName: "Nebraska", senateOnly: true },
   };
   ```

   Only override `houseFragment` for non-default chamber names. Only set
   `senateOnly: true` for Nebraska.

2. **Register the scraper** in `scripts/lib/candidate-sources/index.ts`:

   ```ts
   export const STATE_CANDIDATE_SOURCES: Record<string, StateScraper> = {
     // ...
     CA: (cycle) => fetchBallotpediaState("CA", cycle),
   };
   ```

Run `npm run scrape CA` to ingest. Verify with `npm test` (existing tests
cover the parser shape across all variants).

## Verifying a state worked

```bash
# Confirm row count + source label
npm run scrape XX

# Spot-check a district in the browser
npm run dev
# Visit /xx/sldu-N/state-senate or /xx/sldl-N/state-house
```

The orchestrator emits warnings for districts it couldn't match (compound
districts in NH/MA/VT, tribal seats in ME, special-character names).
These are accepted — the rest of the state ingests cleanly.

## Replacing a Ballotpedia source with a primary SoS source

When a state's SoS becomes scrapable (e.g. OH SoS removes Akamai
protection, or we wire up Playwright):

1. Build the SoS scraper at `scripts/lib/candidate-sources/{state}.ts`
2. Replace the registry entry — point `XX:` at the new fetcher
3. Run once. The orchestrator's `source` label changes from
   `xx_ballotpedia` to `xx_sos`. The old Ballotpedia rows for this cycle
   stay in DB but the new run replaces them.
4. (Optional) Delete the orphaned `xx_ballotpedia` rows manually if you
   want the cleanup: `DELETE FROM "Candidates" WHERE source='xx_ballotpedia'`.

## Limitations

- **Volunteer-paced freshness**: Ballotpedia is updated by their staff
  and contributors on their own schedule. Primary SoS data is generally
  fresher.
- **Disclaimer**: Ballotpedia themselves note "the candidate list in this
  election may not be complete" on every page. Treat coverage as best-effort.
- **No fundraising / contact info**: only name, party, district, incumbency.
  Federal races are still better served by FEC (which our orchestrator
  prefers via the federal-overlap dedup).
- **Compound districts** (NH/MA/VT named multi-county seats): Ballotpedia
  uses different naming than our slug convention. These appear in unmatched
  warnings.
