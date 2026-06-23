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
- `nextElection` is null for statewide execs where the cycle wasn't verified; the UI
  must render null as unknown, never guess from the governor's cycle (e.g. PA row
  offices run in presidential years while the governor runs in midterms).
- No-SoS states: AK, HI, UT. No-treasurer equivalents are titled per state
  (NY/TX Comptroller, FL CFO, etc.) — `title` carries the real ballot title.
