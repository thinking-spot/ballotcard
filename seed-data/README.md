# Curated seed data

Hand-curated datasets for offices with no reliable free API. Refreshed manually after
election cycles; `npm run ingest` upserts them idempotently.

| File | Coverage | Source | Last verified |
|---|---|---|---|
| `governors.json` | 50 governors | Wikipedia, List of current United States governors | 2026-06-11 |
| `statewide-execs.json` | Lt. governors (45), attorneys general (50), secretaries of state (47), treasurers/equivalent (50) | Wikipedia current-officeholder tables | 2026-06-11 |
| `mayors.json` | 29 large-city mayors | v0.x seed | 2026-04 |

Notes and known gaps:

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
