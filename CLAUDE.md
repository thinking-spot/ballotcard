# BallotCard

Enter your address, see everyone who represents you — a faithful recreation of your actual
ballot, federal to local — on one permanent, shareable page. No account, no ads, no
tracking, ever. A pure civic information utility.

See `docs/V1-SPEC.md` for the full v1.0 product definition.

## Mission

Make representation legible. Every voter should be able to see, in one place, the complete
set of offices they vote for, who holds each seat, and when each seat is next on the
ballot — without creating an account or surrendering their address.

**History:** v0.x included an elected-volunteer "Witness" layer with forums and witness
elections. It was removed in the June 2026 v1.0 rescope (git history preserves it). Do not
reintroduce auth, posting, or any user-generated-content mechanic.

## Core Design Principles

1. **Public and anonymous.** All content is world-readable. There are no accounts. The user
   never identifies themselves; their address is resolved to districts and discarded.
2. **The ballot is the organizing primitive.** The specific set of offices one resident
   votes for. Organization is never by topic, party, or personality.
3. **Faithful to the booth.** The card shows the *complete* ballot — including offices we
   have no data source for yet, rendered as honest empty rows. Schema never limits the
   product to today's data sources.
4. **Old-internet ergonomics.** Dense rows, not cards. Permalinked, permanent, indexable.
   craigslist's locality-as-root; Wikipedia's epistemic honesty ("data as of", sources
   linked).
5. **Never monetized.** Operating costs covered by the maintainer. No ads, no enterprise
   contracts, no lead-gen. (This is what distinguishes BallotCard from BallotReady et al.)
6. **Privacy as architecture, not policy.** Addresses are never stored or logged.
   localStorage holds district IDs only — facts about places, never people.

## Tech Stack

- **Framework:** Next.js 16 (App Router), React 19, TypeScript
- **Styling:** Tailwind CSS 4, shadcn/ui (custom components in `src/components/ui/`)
- **Database:** Supabase (PostgreSQL), RLS public-SELECT on all tables; writes only via
  service-role ingestion
- **Hosting:** Vercel
- **Monitoring:** Sentry (production only, no PII — address scrubbing is load-bearing)
- **Validation:** Zod schemas in `src/lib/validation.ts`
- **Dates:** `date-fns`

## What BallotCard Does Not Use

- No auth of any kind (NextAuth removed in v1.0)
- No user-generated content, forums, or comments
- No client-side encryption (public content)
- No real-time, no push/email notifications
- No image uploads (officials' photos come from ingestion sources)
- No algorithmic feeds, trending, infinite scroll, or engagement metrics
- No analytics that identify users

## Architecture

- **All routes are public.** Reading is anonymous; there is no `(protected)` group.
- **Mutations happen only in ingestion** (scripts + cron), never from user requests, with
  one exception: the address-resolution route handler, which is stateless.
- **RLS on every table:** public SELECT, no anon writes.
- **Aggressive caching:** office/official pages are static, revalidated on ingestion.
- **Address resolution:** server-side proxy to the US Census Geocoder
  (`returntype=geographies`, benchmark `Public_AR_Current`, vintage `Current_Current`).
  The geocoder has no CORS, which conveniently forces the privacy-preserving proxy shape.
  Never log the address.

## Data Model

- **Districts** — nested geographic units (country → state → county/CD/SLDU/SLDL →
  municipality). `parent_id` creates the tree.
- **Offices** — seats. Classified on three axes:
  `branch` (executive/legislative/judicial/law_enforcement/other),
  `level` (federal/state/county/municipal/special),
  `selection_method` (elected_partisan/elected_nonpartisan/retention/appointed).
  Only elected/retention offices render on ballot cards.
- **Officials** — real officeholders. One current per office (`is_current`), history
  preserved. `external_refs` JSONB carries bioguide/openstates/fec/courtlistener IDs —
  these are the upsert keys for ingestion and the join keys for the future activity feed.

## Data Sources

| Domain | Source |
|---|---|
| Address → districts | US Census Geocoder (free, no key, .gov) |
| Congress | `unitedstates/congress-legislators` YAML (+ `unitedstates/images` photos) |
| State legislators | OpenStates bulk people data |
| Governors / statewide execs / mayors | curated seeds in `seed-data/` |
| State courts of last resort | curated seed (`high-courts.json`, Ballotpedia-sourced — CourtListener's state rosters proved years stale; its IDs remain the plan for the activity feed) |
| Lower state judges (later) | no fresh national source yet — schema-ready, honest empty states |
| Sheriffs / county (later) | no national source yet — schema-ready, honest empty states |

Ingestion lives in `scripts/` and `src/lib/ingestion/`; everything is an idempotent upsert
keyed on external IDs. Every page shows "data as of" from the last ingestion run.

## The articleOne Feed (designed-for)

Official pages include an Activity section built against the `FeedItem` contract in
`src/lib/feed/` (votes, floor statements, hearings, testimony, news mentions). articleOne
(partner data source: transcribed congressional activity with speaker attribution) becomes
the first provider when access lands. Until then the section renders outbound links and an
honest "coming" state. Extend the provider interface; don't bypass it.

## Key Directories

```
src/app/(public)/                    # Everything: landing, card, state/office/official pages
src/app/(public)/[state]/            # Geographic URL structure
src/app/api/                         # Address resolution proxy, og-preview
src/components/ui/                   # shadcn/ui components
src/lib/                             # Data access, validation, types
src/lib/ingestion/                   # Source fetchers and mappers
src/lib/feed/                        # FeedItem contract + provider interface
scripts/                             # ingest.ts, verify.ts
seed-data/                           # curated JSON seeds
migrations/                          # Supabase SQL migrations (applied in order)
docs/                                # V1-SPEC.md and other specs
```

## Conventions

- Table names: PascalCase, quoted. Column names: snake_case.
- Primary keys: UUID `DEFAULT gen_random_uuid()`. Timestamps: `TIMESTAMPTZ DEFAULT NOW()`.
- Sentence case everywhere. No Title Case, no ALL CAPS.
- `text-muted-foreground` and other shadcn semantic tokens over raw colors.
- Headings: Libre Baskerville (`--font-serif`). Body: Open Sans (`--font-sans`).
- Tabs component import: `@/components/ui/Tabs` (capital T).
- Toasts: `sonner`. Dates: `date-fns`.

## Terminology

- **Ballot card** — the rendered page of offices for one resident's districts.
- **Office page** — the per-seat permalink page.
- **Activity** — the time-ordered content list on official pages (never "feed" in UI copy).
- Officeholders are referred to by title (Senator, Representative, Mayor, Sheriff…).
- "Witness", "Watch/Watcher", "Parallel Pol" — deprecated v0.x terms. Never use.

## Commands

- `npm run dev` — Start dev server
- `npm run build` — Production build
- `npm run lint` — ESLint
- `npm test` — Run tests (Vitest)
- `npx tsc --noEmit` — Type check
- `npm run ingest` — Run ingestion against Supabase
- `npm run verify` — Spot-check ingested data

## Related Projects

- [uunn](https://github.com/thinking-spot/uunn) — sibling project, same maintainer,
  encrypted union organizing. Opposite threat model. Shares stack philosophy.
- **articleOne** — partner project (friend of maintainer, DC): ingests/transcribes
  congressional floor, hearing, and testimony records with speaker attribution. Future
  data source for official Activity pages.
