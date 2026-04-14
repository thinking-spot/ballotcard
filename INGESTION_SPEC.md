# BallotCard Ingestion Spec

External data populates BallotCard's seeded tier and informs user-activated offices. This document specifies the sources, schedule, and handling for each data type.

The principle: BallotCard does not replicate Ballotpedia or OpenStates. It ingests just enough to make every seeded page useful on day one, and to support one-click activation of sub-threshold offices.

## Seeded tier: scope

The seeded tier — offices that exist on BallotCard without user activation — targets the 20% of offices that cover 80% of voter attention.

| Tier | Count | Source |
|---|---|---|
| US Senate | 100 | OpenStates (federal), Congress.gov |
| US House | 435 | OpenStates (federal), Congress.gov |
| President / VP | 2 | Hardcoded, updated per-term |
| Governors | 50 | Ballotpedia + SoS feeds |
| Lt Governors | 45 | Ballotpedia (not all states have Lt Gov) |
| Attorneys General | 50 | Ballotpedia + state AG association |
| Secretaries of State | 47 | Ballotpedia (not all states have elected SoS) |
| State Supreme Court justices | ~350 | Ballotpedia |
| Big-city mayors (top 300 by population) | 300 | Curated list, maintained in `/seed-data/mayors.csv` |
| **Total seeded** | **~1,379** | |

Below this tier (state legislators ~7,400, county offices, school boards, city councils, small-town mayors, judicial) offices are user-activated on demand.

## Data sources

### OpenStates (openstates.org)
Primary source for federal and state legislative data.

**Coverage:** US House, US Senate, state houses, state senates.

**API:** REST at `https://v3.openstates.org/`. Requires API key (free tier: 500 requests/day).

**Useful endpoints:**
- `/people` — officeholders with party, chamber, district, external IDs
- `/bills` — bill metadata (not currently used; possible future feature)
- `/jurisdictions` — district geography, session calendars

**Data quality:** Good for federal and most state legislatures. Inconsistent for rural states (NH, VT, WY have gaps).

**License:** CC0, free to use commercially.

### Ballotpedia (ballotpedia.org)
Primary source for executive and judicial officeholders, backup for legislative.

**Coverage:** Everything. Comprehensive encyclopedia of US elections.

**API:** Ballotpedia has restricted API access; most data is scraped from their well-structured wiki pages. Their API licensing needs investigation before launch.

**For MVP, use Ballotpedia via:**
1. Their free CSV exports when available
2. Careful, respectful scraping for seeded-tier data (governors, AGs, top-city mayors)
3. Linking to Ballotpedia pages for every officeholder regardless of whether we scrape

**License considerations:** Ballotpedia is published by Lucy Burns Institute, 501(c)(3). They welcome attribution and linking. Bulk scraping requires permission — reach out before building this pipeline.

### Census TIGER (census.gov)
District boundary data.

**Coverage:** US House districts, state legislative districts, counties, municipalities, school districts, Census-defined places.

**Format:** Shapefiles and GeoJSON, annual updates.

**Usage in BallotCard:** Not for real-time queries. Used once at bootstrap to populate `Districts.external_refs` with Census GEOIDs, and to establish the district tree (parent-child relationships).

### Congress.gov + clerk.house.gov
Authoritative source for federal officeholder data and voting records.

**Usage:** Secondary verification for OpenStates federal data. Link target for vote record references in posts.

### FEC (fec.gov)
Campaign finance data.

**Usage:** External reference link only. BallotCard doesn't ingest FEC data; we link to the FEC page for each seeded federal officeholder.

### Open Graph metadata (for featured links)
Fetched on post creation, not batch-ingested. See Server Actions Spec for `fetchOpenGraphAction` implementation details.

**Key decisions:**
- **Self-hosted, not third-party.** We do not use Cardyb (Bluesky's public service), Microlink, or other external OG services. User composition patterns should not flow through another company on a pseudonymous civic platform, and public courtesy services can change or disappear.
- **Snapshot at fetch time.** OG data is stored in Posts columns at post creation. Re-rendering a post never re-fetches. The snapshot preserves what the source said when the post was made, even if the source later changes, paywalls, or disappears.
- **No image caching.** We reference the original `og:image` URL. Image rot over time is accepted; text content of the card remains.
- **Rate limits and security hardening in the fetcher, not in infrastructure.** See server actions spec for the specific requirements.

**Expected cost:** Negligible. At 1,000 posts/day with featured links, roughly <$1/month in Vercel compute. No meaningful storage impact (OG metadata is ~1KB per post).

## Ingestion pipeline

### Bootstrap (one-time, pre-launch)

**Step 1: Load districts.**
- Pull Census TIGER data for the current year
- Populate `Districts` table with country → states → congressional districts → counties
- Parent-child relationships derived from GEOID hierarchy
- Municipalities populated selectively (top-300 cities only for v1)
- Each district gets `external_refs: { census_geoid: "..." }`

**Step 2: Load seeded offices.**
- For each seeded-tier office type, create `Offices` rows with `is_seeded = true`
- `term_years` and election schedules hardcoded per office kind (US Senate = 6, US House = 2, governors = 4, etc.)

**Step 3: Load current officeholders.**
- Federal: OpenStates `/people?jurisdiction=congress`
- State execs: Ballotpedia scrape + manual curation pass
- Supreme Court justices: Ballotpedia
- Mayors: manually curated CSV at `/seed-data/mayors.csv` (one-time research pass; top-300 mayors is a manageable human task)
- For each: insert `Officials` row with `is_current = true`, populate `external_refs` with whatever IDs we have

**Step 4: Schedule initial Witness elections.**
- For each seeded office, create a `WitnessElections` row
- `filing_opens_at` = 90 days before `voting_opens_at`
- `voting_opens_at` = 30 days before the office's next real election
- `voting_closes_at` = 2 weeks after voting opens
- `term_start` = day after voting closes
- `term_end` = aligned to the next seeded election cycle

### Ongoing refresh (weekly cron)

A scheduled Vercel cron job runs weekly to refresh officeholder data.

**For each seeded office:**
1. Check external source (OpenStates for federal/state leg, Ballotpedia where applicable)
2. If the currently listed officeholder has changed: mark old row `is_current = false`, insert new row with `is_current = true`, `term_start = NOW()` (or scraped start date)
3. Update `next_election_at` on `Offices` row if election calendar has shifted
4. Log any discrepancies to an admin dashboard for manual review

**Conflict handling:** If OpenStates and Ballotpedia disagree on who holds an office, prefer OpenStates for federal/state leg, Ballotpedia for execs. If both fail, keep the stale row and flag for manual review.

### User-triggered activation

When a user clicks "Activate" on an unseeded office in their district:

1. Read the office metadata we already have (from the Census/Ballotpedia preload — we know *that* the office exists, just haven't populated officeholder data)
2. Fetch latest officeholder data from OpenStates (for state legislators) or Ballotpedia (for county/municipal)
3. Insert/update the `Officials` row
4. Set `Offices.activated_at = NOW()`
5. Create initial `WitnessElections` row aligned with next real election
6. Return redirect to the now-live office page

If external data can't be fetched (rate limit, timeout, data not available), the activation proceeds with a placeholder officeholder (name = "Unknown", external_refs = null). The user can follow up or a Witness can post the officeholder's name once elected.

## Data quality safeguards

- **Every external data point is stamped with source and fetch time.** `Posts.featured_link_fetched_at`, `Officials.external_refs_fetched_at`, etc.
- **Never silently overwrite user-authored data with ingestion data.** Ingestion only touches `officeholders` and `Offices` metadata. Never `Posts`, `Witnesses`, `OfficeFollows`.
- **Maintain a `DataDiscrepancies` table** for flagged conflicts needing manual review. Admin-readable via a protected admin route.
- **Backfill on schema changes.** When we add a new column to `Offices` (e.g., `is_at_large`), a migration backfills it from external source before being deployed.

## Cost model

Supabase writes during weekly ingestion are small (~1,400 upserts). The OpenStates API tier is free up to 500 requests/day — well within bounds for our usage (one batch call per chamber, ~10 calls total weekly). Ballotpedia scraping should be rate-limited to 1 req/sec with respectful User-Agent and caching. Image storage is zero (we don't cache OG images).

Estimated monthly cost for ingestion overhead: <$5 on top of normal Supabase usage.

## Implementation order

This is the sequence for actually building the ingestion:

1. **Census TIGER district tree** (pre-launch). One-time script, run locally, dumps SQL to `/seed-data/districts.sql` which is committed to the repo and applied during bootstrap.

2. **Mayors CSV** (pre-launch). Hand-curated top-300 cities with current mayors. Committed to repo at `/seed-data/mayors.csv`.

3. **Seeded offices loader** (pre-launch). Script that reads the district tree + mayors CSV and creates `Offices` rows for all seeded-tier positions.

4. **OpenStates federal ingestion** (pre-launch). Script pulls current US House/Senate members, inserts `Officials`.

5. **Ballotpedia scraper for governors/AGs/SoS** (pre-launch). Script + HTML parsing. Manual verification pass before committing to the seed.

6. **Weekly refresh cron** (post-launch, when live data accuracy matters). Vercel cron job.

7. **User-triggered activation** (post-launch, when the platform has users). Server action.

8. **OG metadata fetching** (with post composer). Small fetcher, called from `createPostAction`.

## What we are not doing for v1

- **No voting record ingestion.** Witnesses and residents can post about votes with links; we don't auto-track.
- **No FEC data ingestion.** Linked externally only.
- **No news ingestion.** Witnesses post the news themselves. We don't aggregate.
- **No image caching.** OG images are referenced at source URLs; rot is accepted.
- **No district boundary redraw handling.** When redistricting happens, we update the Districts rows manually per cycle.

These can all come later if the platform grows to need them. For v1, every ingestion job is "known number of rows, predictable schedule, small cost."

## Legal and ethical notes

- **Ballotpedia attribution.** Every page that uses Ballotpedia-derived data should link to the source page. No bulk scraping without outreach; consider donating to Ballotpedia if we build a production dependency on their data.
- **OpenStates attribution.** Footer link to openstates.org on pages that use their data.
- **No officeholder contact scraping.** Email addresses, office phones, staff names are not ingested. If a Witness wants to list them in a post, that's their choice; BallotCard does not systematically aggregate.
- **No voter data, ever.** Voter rolls, registration status, voting history, donation records at the individual level — none of this touches BallotCard.
