# BallotCard — Data Sources Research

Researched June 2026. Covers candidates, ballot measures, and campaign finance at state
and local level. Federal sources (FEC, congress-legislators, OpenStates) are already
handled by existing ingestion — this document focuses on the gap: state and local races
and ballot measures.

---

## The core finding

Your candidate contact was right about the pattern. Every state has an FEC-equivalent
ethics/campaign finance commission. **FollowTheMoney.org (now part of OpenSecrets)**
has already done the work of aggregating all 50 of them into a single API. That API
covers candidates in state primary and general elections plus ballot measures back to 2002,
across all 50 states, for free.

That is the primary source to build against first.

---

## Tier 1 — Free / open sources (build now)

### 1. FollowTheMoney API (OpenSecrets)
**URL:** https://www.followthemoney.org/our-data/apis  
**What it covers:** 50-state candidate campaign finance data + ballot measures.
Contributions, expenditures, independent spending for all state-level races.
Ballot measures specifically searchable by election and state.  
**Access:** Free account required (register at followthemoney.org). API is immediately
available after registration.  
**Format:** REST API ("Ask Anything API" + Entity Details API). PDF documentation
available.  
**Data freshness:** Current through 2024 election year. Integration with OpenSecrets
is ongoing — may improve or shift.  
**License:** Creative Commons Attribution-Noncommercial-Share Alike 3.0 US.
BallotCard's no-ads, no-monetization structure almost certainly qualifies, but verify
before ingesting at scale.  
**Ballot measures:** Yes — dedicated Ballot Measures tool and API endpoint. Coverage
back to 2002.  
**Local races:** "Selected local-level data" — not comprehensive below state legislative
level, but improving.  
**Verdict:** Start here. One API key, 50-state coverage, free. This is the aggregator
of all those state MEC equivalents your candidate described.

---

### 2. State disclosure agencies — direct ingestion
FollowTheMoney has mapped all 50 state disclosure agencies:
https://www.followthemoney.org/resources/state-disclosure-agencies/

For states with good bulk data infrastructure, going direct gives fresher data and
avoids the intermediary. States confirmed to have usable bulk download or API:

| State | Agency | Data access |
|---|---|---|
| California | Secretary of State (CAL-ACCESS) | Raw tab-delimited files, full database |
| Washington | Public Disclosure Commission | Excellent open data portal, bulk CSV |
| New York | Board of Elections | Bulk download available |
| Michigan | Dept. of State | Annual bulk files, 1998–present |
| Iowa | Ethics & Campaign Disclosure Board | CSV on state open data portal |
| Nevada | Secretary of State | Run-your-own bulk report export |
| Minnesota | Sec. of State | Candidate filing lists as downloadable text |
| Missouri | Ethics Commission (MEC) | Web search portal — scrapeable |

For most other states, the disclosure agency is a search portal without a bulk export.
FollowTheMoney handles those states on your behalf.

**Recommended strategy:** Use FollowTheMoney API for initial 50-state coverage. Add
direct-state ingestion for high-population states (CA, TX, FL, NY, WA) where bulk
data is available and freshness matters.

---

### 3. OpenElections
**URL:** https://openelections.net / https://github.com/openelections  
**What it covers:** Certified election *results* — precinct-level where available,
county-level otherwise. Federal + major statewide + state legislative.  
**Format:** CSV, standardized schema, GitHub repos per state.  
**Useful for:** Historical context in the challengers panel — who won last time, by
how much. Not useful for upcoming candidates (it's backward-looking by design).  
**Verdict:** Good complement to FollowTheMoney for historical margin data.

---

### 4. The Accountability Project
**URL:** https://publicaccountability.org/datasets/  
**What it covers:** Aggregates individual state campaign finance commission datasets.
Currently covers CO, CT, NV, NE, NH, and growing.  
**Format:** Searchable database + downloadable datasets.  
**Verdict:** Useful fallback for states where FollowTheMoney coverage is thin.

---

## Tier 2 — Commercial sources (evaluate for later)

### BallotReady / CivicEngine
**URL:** https://organizations.ballotready.org/ballotready-api  
**What it covers:** The most comprehensive local race data in the industry. Candidates,
ballot measures, elected officials, districts, normalized positions — down to school board
and special districts. GraphQL API. Hundreds of thousands of officeholder records.  
**Access:** Paid subscription, pricing on request (contact data@ballotready.org).  
**Verdict:** This is what BallotCard would eventually want for truly local coverage —
the races below the state legislative threshold that no free source covers reliably.
Price it when BallotCard has traction.

### Democracy Works Elections API
**URL:** https://www.democracy.works/elections-api  
**What it covers:** Federal, state, county, municipal, sub-municipal, school board
elections for jurisdictions over 5,000 people. Statewide ballot measures. Won Best
Data API 2024.  
**Access:** Commercial. Their ballot info data is sourced from Ballotpedia.  
**Verdict:** Strong product; likely redundant if you have Ballotpedia or BallotReady.

### Ballotpedia API
**URL:** https://api.ballotpedia.org  
**What it covers:** All federal + statewide offices, top 100 US cities by population,
plus 32 additional state capitals. Ballot measures. Candidate biographies, issue
stances, endorsements.  
**Access:** Paid subscription. Single-state subscriptions available.  
**Note:** Ballotpedia is the upstream data provider for Democracy Works.  
**Verdict:** Premium option with excellent editorial quality. Worth a conversation
when budget allows.

---

## What FollowTheMoney does NOT cover well

- Municipal races below state legislative level (city council, school board, water
  districts, etc.) — these file locally, not with state commissions
- Judicial elections in most states
- Special district elections
- Candidate biographical data (positions, endorsements, biography) — it has finance
  data only

For the truly local gap, BallotReady is the only known comprehensive national source.
Until then, honest empty rows for those offices remain correct.

---

## Ballot measures specifically

This is the clearest new data category to add. FollowTheMoney has explicit ballot
measure coverage (committees formed to support/oppose measures, money raised/spent)
across all 50 states back to 2002. The schema needs a `ballot_measures` table before
ingestion can begin.

Minimum schema:
```sql
CREATE TABLE "BallotMeasures" (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  district_id     UUID REFERENCES "Districts"(id),
  title           TEXT NOT NULL,          -- official ballot title
  description     TEXT,                   -- plain-language summary
  election_date   DATE NOT NULL,
  measure_type    TEXT,                   -- constitutional_amendment, statute, bond, etc.
  status          TEXT,                   -- on_ballot | passed | failed | withdrawn
  external_refs   JSONB DEFAULT '{}',     -- followthemoney ID, state-specific ID
  source_url      TEXT,                   -- link to official text
  last_ingested   TIMESTAMPTZ DEFAULT NOW(),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Recommended ingestion order

1. **Register for FollowTheMoney API** — free, immediate.
2. **Explore the Ballot Measures endpoint** — test against MO to validate data quality.
3. **Add `BallotMeasures` table** — migration + schema, before any ingestion.
4. **Wire challengers panel** — FollowTheMoney "Candidate by Election" → right accordion.
5. **Wire ballot measures to ballot card** — new section below county offices.
6. **Direct-state ingestion for CA, WA, NY** — high-value states, fresh data.
7. **Evaluate BallotReady** — when BallotCard has traction and budget.
