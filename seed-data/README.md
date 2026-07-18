# Curated seed data

Hand-curated datasets for offices with no reliable free API. Refreshed manually after
election cycles; `npm run ingest` upserts them idempotently.

| File | Coverage | Source | Last verified |
|---|---|---|---|
| `governors.json` | 50 governors | Wikipedia, List of current United States governors | 2026-07-16 |
| `statewide-execs.json` | Lt. governors (45), attorneys general (50), secretaries of state (47), treasurers/equivalent (50) | Wikipedia current-officeholder tables | 2026-07-16 (delta check) |
| `mayors.json` | 100 mayors: Ballotpedia's top-100 cities + DC, minus Santa Clarita (council-appointed mayor, not on any ballot) | Ballotpedia top-100 list + per-city Ballotpedia bios/election pages, cross-checked with city and news sources | 2026-07-16 |
| `high-courts.json` | 53 courts of last resort (50 states + DC + TX/OK Courts of Criminal Appeals) with sitting justices | Ballotpedia court pages + justice bios, cross-checked with court/news sources. (CourtListener was evaluated and rejected: its state rosters run years stale.) | 2026-07-16 |

Notes and known gaps:

- Mayors: `termEnd: null` (18 rows) means only the term-end *year* is public — the
  successor is seated at a post-canvass or organizational meeting whose date isn't
  fixed yet. `nextElection: null` (4 rows: OKC, Kansas City, Long Beach, Tulsa) means
  the next cycle's date isn't published. A wrong date is worse than null.
- Mayors: `party` is the officeholder's publicly identified affiliation (most big-city
  mayoral *elections* are nonpartisan); "Nonpartisan" means the person has no public
  affiliation (e.g. Guajardo, Treviño, Ross told Ballotpedia exactly that).
- High courts: justice `termStart`/`termEnd` may be a bare year when Ballotpedia
  publishes no day precision — ingestion stores Jan 1 / Dec 31 of that year, so day
  precision on justice terms is approximate. `termEnd` is the term-expiry year (the
  seat's election/retention usually falls in or just before it). Offices exist for
  vacant seats and for appointed courts (selection_method keeps the latter off ballot
  cards). Seats are labeled "Seat 1..N" with the chief justice in Seat 1; in states
  where the chief role rotates by peer vote, that labeling shifts with the roster.
- Pending: TX Secretary of State Jane Nelson's resignation is effective 2026-07-17
  (the day after this verification); Gov. Abbott had named no successor as of 7/16.
  Update `statewide-execs.json` when the appointee is sworn in.

- `selection` is `elected_partisan` or `appointed` (appointed rows are kept for context
  but never render on ballot cards). Some "elected" rows are nonpartisan in practice —
  refinement pass welcome.
- Lieutenant governors: AZ, ME, NH, OR, WY have no such office (AZ's first elected Lt.
  Gov arrives with the 2026 election); TN and WV give the title to the senate president
  (recorded as `appointed`). Whether an elected Lt. Gov runs on the governor's ticket or
  a separate ballot line is **not yet verified per state** — see `selectionDetail`.
- `nextElection` for elected_partisan execs is filled by the governor-co-cycle
  heuristic (most states elect AG/SoS/Treasurer with Governor). Known staggered
  states are overridden explicitly: **PA** row offices run in presidential
  years while Governor runs midterm; **IN** SoS/Treasurer/Auditor cycle in
  midterms while Governor/AG cycle presidential. Audit other states as needed —
  defensible date is better than null, but a *wrong* date is worse than null.
- Appointed execs (including PA Secretary of State, AK AG, etc.) keep
  `nextElection: null` — there is no election to point to.
- No-SoS states: AK, HI, UT. No-treasurer equivalents are titled per state
  (NY/TX Comptroller, FL CFO, etc.) — `title` carries the real ballot title.
