# BallotCard

A powerless, parallel government structure. For each elected official there is a "Witness" — a volunteer resident elected on BallotCard to watch, report on, and publicly discuss that official's activities. No governmental authority, no monetization, no engagement optimization. Civic accountability infrastructure.

## Mission

Make democratic functioning legible at the district level. Give residents a structured, permanent, pseudonymous place to follow their elected officials and collectively hold them to account. The platform is a public archive, not a social stream.

## Core Design Principles

1. **Public by default.** All content is world-readable. Encryption would defeat the mission. The users who need protection are pseudonymous; the content they produce is meant to be seen.
2. **District-rooted.** The organizing primitive is the ballot card — the specific set of offices one resident can vote for. Organization is never by topic, party, or personality.
3. **Powerless by design.** Witnesses have zero governmental authority. Their only currency is public attention from their district's residents. This is a feature; it keeps the evaluation rubric simple.
4. **Self-regulating.** Witnesses are themselves elected and re-elected. Bad actors lose their perch at the next election. The same mechanism applies at every level.
5. **Old-internet ergonomics.** Forum-shaped, threaded, permalinked, permanent. Modern aesthetics, pre-engagement-optimization behavior. Reference points: old.reddit for threading, craigslist for locality-as-root, Wikipedia talk pages for epistemic norms.
6. **Never monetized.** Operating costs are covered by the maintainer. If donations are ever accepted, they are capped at operating costs. No ads, no enterprise contracts, no pay-for-visibility.
7. **One mechanism, applied recursively.** Voters watch officeholders through Witnesses, who are themselves watched by voters. Feature additions should extend this mechanism, not introduce a second one.

## Tech Stack

- **Framework:** Next.js 16 (App Router), React 19, TypeScript
- **Styling:** Tailwind CSS 4, shadcn/ui (custom components in `src/components/ui/`)
- **Database:** Supabase (PostgreSQL) with Row-Level Security
- **Auth:** NextAuth 5 (credentials provider — username/password, no OAuth, no email)
- **Hosting:** Vercel
- **Monitoring:** Sentry (production only, no PII)
- **Validation:** Zod schemas in `src/lib/validation.ts`
- **Rate limiting:** In-memory sliding window in `src/lib/rate-limit.ts`

## What BallotCard Does Not Use

- No client-side encryption (public content)
- No real-time / Supabase Realtime (async forum, not chat)
- No Web Push / service worker notifications (no emails, no push)
- No AI inference at platform cost (Witnesses can use AI on their own)
- No image uploads (links to external hosting only)
- No video (links only)
- No algorithmic feeds or trending
- No infinite scroll
- No engagement metrics visible to users as reputation scores
- No global karma or user ranking

## Architecture

- **Route groups:** `(public)` for the bulk of the app — reading is anonymous. `(protected)` for posting, voting in Witness elections, candidacy, and account settings.
- **Server actions** in `src/lib/*-actions.ts` handle mutations.
- **RLS on every table.** Public SELECT on nearly all tables. INSERT/UPDATE/DELETE gated on `auth.uid()` matching the actor, with additional district-scope checks for district-restricted actions.
- **Soft deletion.** Content is archived via `deleted_at`, not removed. The archive is a civic record.
- **Aggressive caching.** District and office pages change slowly. Static generation with on-write revalidation.
- **Ingestion.** Seeded tier of offices (US Congress, Governors, top-300 city mayors, statewide execs) from OpenStates + Ballotpedia + SoS feeds. Sub-threshold offices are user-activated on first request.

## Key Directories

```
src/app/(public)/                    # Landing, about, district pages, office pages, election pages
src/app/(public)/[state]/[district]/ # Geographic URL structure
src/app/(protected)/                 # Post, vote, candidacy, settings
src/components/ui/                   # shadcn/ui components
src/lib/                             # Server actions, validation, types
src/lib/ingestion/                   # External data fetchers (OpenStates, Ballotpedia)
src/context/                         # Auth and District contexts
migrations/                          # Supabase SQL migrations (applied in order)
```

## Data Model Summary

- **Districts** — nested geographic units (municipality, county, state-leg district, US House district, state, USA). `parent_id` creates the tree. Zoom layers are subtree queries.
- **Offices** — seats. One office per district per type (e.g., "US House NC-07", "New Hanover County Commission Seat 3").
- **Officials** — real elected officials. One current per office, history preserved.
- **Witnesses** — elected watchers. One current per office, history preserved.
- **WitnessElections / Candidacies / Votes** — the election mechanic for Witnesses.
- **Posts** — threaded forum content. Bound to an Office. Tagged for cross-office surfacing.
- **Tags** — structured controlled vocabulary: `pol`, `district`, or `issue` kind. No free-text hashtags.
- **PostTags** — many-to-many.
- **ModActions** — audit log for moderation.

## Conventions

- Table names: PascalCase, quoted (matches uunn style).
- Column names: snake_case.
- Primary keys: UUID with `DEFAULT gen_random_uuid()`.
- Timestamps: `TIMESTAMPTZ DEFAULT NOW()`.
- Toast notifications: `sonner`.
- Date formatting: `date-fns`.
- Tabs component import: `@/components/ui/Tabs` (capital T, matches uunn).
- Sentence case everywhere. No Title Case, no ALL CAPS.
- `text-muted-foreground` over `text-gray-500 dark:text-gray-400`. Use shadcn semantic tokens.

## Writing Style for Witness Communities

- Sourced, not opinionated. Every substantive claim about an officeholder should link to a primary source (vote record, FOIA response, transcript, news article).
- Paraphrase over quote. Direct quotes are reserved for cases where exact wording matters legally or rhetorically.
- Critiques should be specific and factual, not characterological.
- Supporters and critics are equally welcome to run for Witness. The rubric is informational quality, not viewpoint.

## Commands

- `npm run dev` — Start dev server
- `npm run build` — Production build
- `npm run lint` — ESLint
- `npm test` — Run tests (Vitest)
- `npx tsc --noEmit` — Type check

## Related Projects

- [uunn](https://github.com/thinking-spot/uunn) — sibling project, same maintainer, encrypted union organizing. Opposite threat model (private coordination vs public accountability). Shares stack philosophy and the pseudonymous auth pattern.
