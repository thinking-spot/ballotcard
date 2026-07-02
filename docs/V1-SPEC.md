# BallotCard v1.0 — "Your ballot, always"

*Spec adopted 2026-06-11. Supersedes the Witness-era product definition.*

## One sentence

Enter your address, see everyone who represents you — the faithful recreation of your actual
ballot, top to bottom — on one permanent, shareable page. No account, no ads, no tracking, ever.

## What changed from v0.x

The Witness mechanic (elected volunteer watchers, witness elections, the forum layer) is
removed entirely. BallotCard v1.0 is a pure information utility: anonymous, read-only,
zero-auth. The defensible primitive is the ballot card itself — the specific set of offices
one resident votes for — rendered with full fidelity even where data sources don't yet exist.

**Build for the complete ballot; let data fill in over time.** If a county elects a sheriff
and we have no sheriff dataset, the ballot card still shows the Sheriff row with an honest
"we don't have data for this office yet" state. The schema never limits the product to
today's data sources.

## Core flows

1. **Address → ballot card.** The US Census Geocoder (free, no key, .gov) resolves an
   address to state, county, congressional district, state legislative districts
   (upper/lower), and place. Resolution happens in a server route handler (the geocoder has
   no CORS); the address is **never stored or logged** — only the resulting district
   geographies survive the request. This is the privacy story; say it on the page.
2. **The ballot card** — one dense page, sections in ballot order:
   - **Federal:** President & Vice President, US Senate (both seats), US House.
   - **State:** Governor, Lt. Governor, Attorney General, Secretary of State, Treasurer,
     Auditor, other elected statewide execs (varies by state), State Senate, State House,
     elected state supreme/appellate judges (varies by state).
   - **County:** Sheriff, District Attorney, commissioners, clerks, elected county judges
     (schema-ready; data arrives in later phases).
   - **Municipal:** Mayor (top-300 mayors already ingested), council (later).
   Each row: name, party, photo, in office since, term ends, next election for the seat,
   outbound links. Rows, not cards — old-internet density.
3. **Permalinks for everything.** `/nc` (state overview), `/nc/us-house-7`,
   `/nc/state-senate-8`, `/nc/governor`, plus official pages. Every office and officeholder
   is browsable and indexable with no address entry. Static generation, revalidated on
   ingestion.
4. **"My ballot" without accounts.** Resolved district IDs persist in localStorage and in a
   shareable URL (`/card/nc?cd=7&su=8&sh=18&county=129&place=74440`). Bookmarkable,
   text-message shareable, zero auth.

## Office taxonomy

Offices carry three classification axes (columns on `Offices`):

- `branch`: `executive` | `legislative` | `judicial` | `law_enforcement` | `other`
- `level`: `federal` | `state` | `county` | `municipal` | `special`
- `selection_method`: `elected_partisan` | `elected_nonpartisan` | `retention` | `appointed`

Appointed offices exist in the schema (they matter for context — e.g. appointed state
supreme courts) but only `elected_*` and `retention` rows render on the ballot card.

## Data sources (verified June 2026)

| Domain | Source | Status | Notes |
|---|---|---|---|
| Address → districts | [Census Geocoder](https://geocoding.geo.census.gov/geocoder/Geocoding_Services_API.html) | free, no key, .gov | `returntype=geographies`, benchmark `Public_AR_Current`, vintage `Current_Current`. No CORS — proxy server-side. Returns CD, SLDU, SLDL, county, place. |
| Congress | [unitedstates/congress-legislators](https://github.com/unitedstates/congress-legislators) | free, public domain, actively maintained | `legislators-current.yaml`; photos via `unitedstates/images`. Already ingested in v0.x. Congress.gov API is the .gov fallback. |
| State legislators (~7,400) | [OpenStates](https://open.pluralpolicy.com/data/) people data | free (bulk CSV/YAML public domain; API keyed free tier) | Prefer bulk people data over per-call API for full-sweep ingestion. |
| Governors | curated seed (`seed-data/governors.json`) | exists from v0.x | refresh after each election cycle. |
| Statewide execs (AG, SoS, Treasurer, …) | curated seed (`seed-data/statewide-execs.json`) | to build | No live free API exists (DNC roster archived 2022; Ballotpedia API is paid). Curate ~300 rows; NGA/NAAG/NASS/NAST sites are the reference sources. |
| State judges | [CourtListener judges API](https://www.courtlistener.com/help/api/rest/v3/judges/) (Free Law Project) | free | 16k+ state/federal judges, person-centric. Phase 2 ingestion. |
| Sheriffs / county officials | none national | — | Schema-ready; per-state SoS rosters later. Ballot card renders honest empty states meanwhile. |
| Mayors | curated seed (`seed-data/mayors.json`) | exists from v0.x | top-300 cities. |
| Election dates / candidates | chamber schedule seed (`seed-data/legislature-schedule.json`) + FEC API + state SoS / Ballotpedia scrapers (37+ states) | live | Shipped post-v1.0: candidate lists on office pages + the ballot card. Staggered senates: the per-seat election year is resolved from candidate filings (`scripts/lib/resolve-staggered.ts`); seats without filings stay an honest "2026 or 2028". |

## The articleOne feed (designed-for, not yet live)

articleOne ingests and transcribes congressional floor/hearing/testimony activity with
speaker attribution. BallotCard has a standing agreement-in-principle for B2C access.
Official pages are built around a **feed-item contract** so the feed lights up when the
data lands:

```ts
type FeedItem = {
  id: string
  official_external_id: string   // bioguide / openstates id
  kind: 'vote' | 'floor_statement' | 'hearing' | 'testimony' | 'news_mention' | 'press_release'
  occurred_at: string            // ISO
  title: string
  summary?: string
  source_url: string
  source_name: string            // "Congressional Record", "AP", …
  chamber?: 'house' | 'senate'
  metadata?: Record<string, unknown>  // vote position, bill id, committee, …
}
```

Official pages render an Activity section against this contract. Pre-integration it shows
outbound links (Congress.gov member page, OpenStates page, official site) and an honest
"activity feed coming" note. `src/lib/feed/` owns the contract and a provider interface;
articleOne becomes the first provider.

## Privacy commitments (rendered on the site)

- Addresses are resolved, never stored, never logged (Sentry scrubbing verified in CI).
- No accounts, no cookies beyond what Next.js strictly requires, no analytics that
  identify users.
- localStorage holds district IDs only — data about *places*, never about *people*.

## Out of scope for v1.0

Accounts, posts/forums, Witnesses (all removed), notifications, school boards,
special districts, ranked-choice/multi-member edge-case rendering
(single-winner assumption documented where it leaks). Candidate lists were
originally out of scope but shipped shortly after v1.0 (FEC + 37-state scrapers).

## Phasing

1. **Schema rework** — drop Witness/forum/auth tables; extend Districts/Offices/Officials.
2. **Code removal** — auth, protected routes, forum components, dead tests.
3. **Ingestion v2** — Congress (existing), OpenStates bulk state legislators (new),
   governors (existing), statewide execs (new curated seed). Idempotent upserts on
   external IDs; weekly refresh; `data as of` stamps.
4. **Address resolution** — Census Geocoder proxy route.
5. **Ballot card UI** — address entry, card page, localStorage/URL persistence.
6. **Permalink pages** — state / office / official, with the feed-contract Activity section.
7. **Quality gate** — tests, types, lint, build.
8. **Deploy** — production on Vercel.

Later: county/municipal expansion, judges via CourtListener, election-forward
mode, articleOne integration. (Candidate lists: done.)
