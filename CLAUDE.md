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

## UX Philosophy

Principle #5 ("Old-internet ergonomics") is anchored by three specific reference points:

- **old.reddit:** Information density — many threads visible per screen, not cards. Real threading — indented, collapsible, oldest-first within threads. Clear subcommunity boundaries — each office page is a distinct place with its own norms, not a personalized soup.
- **craigslist:** Locality as root of navigation — district pages are entry points, not a homepage that asks you to pick. Ruthless aesthetic restraint — every UI element justifies itself by utility, nothing is there for vibes. Persistence and permanence — permalinked, versioned edits, nothing truly deleted.
- **Wikipedia talk pages:** Epistemic norms — sourced claims, corrections visible, edit history as part of the record. The post list is the interface; clicking into a thread is a deliberate act, not the default mode.

Card-based UIs are for engagement-optimized products. BallotCard's disposition is forum-dense. The things to borrow from modern social (good mobile UX, clean typography, fast loads) are aesthetic. The things to not borrow (engagement optimization, algorithmic feeds, infinite scroll, push notifications, trending) are where modern social went wrong.

Anti-pattern test for every feature addition: "Does this extend the core mechanism, or introduce a second one?" Second mechanisms are where civic platforms go wrong.

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

## The Zoom Mechanic

Districts nest via `parent_id`. A user's view at any layer = "all offices whose district is in the subtree rooted at X."

- Users control their own altitude: most days you stay local; on quiet days or during crises you zoom out.
- Default zoom always resets to most-local on app open.
- Counter zoom-drift: show what you're missing at your local layer when zoomed out. Make locality gravitationally attractive even when the county layer has juicier content.
- This replaces algorithmic "recommended content" — the user stays in charge of the aperture.

## Cross-References

Posts tagged with a Pol or District appear on that entity's page even when authored at a different layer. A single good Witness post can seed content across dozens of related office pages via tags.

- Cross-references are visually distinguished from in-context posts (different card style, "from [page] →" attribution).
- Critical for cold-start: early activity has outsized footprint through structured tag routing.
- A post about coastal pollution in Wilmington tagged [Rep. Vance] + [New Hanover County] surfaces correctly at every zoom level.

## Cold-Start Design

Don't collapse content upward; collapse presence downward.

- Empty pages stay visibly empty with scaffolding intact. Vacancy is a recruitment pitch, not an error state.
- Cross-references flow up-to-down: content from higher layers mentioning this office appears on the empty page.
- Office states: `cold` | `warming` | `healthy` | `dormant` | `vacant` | `not_activated` — each classified and rendered differently.
- Vacancy is better than a fake mandate (quorum exists for a reason).
- Dormancy is surfaced: "Last post 47 days ago" for inactive Witnesses.
- "Not yet on BallotCard" offices are visible on the user's ballot with single-click activation.
- Empty pages show: officeholder identity card (from ingested data), "Run for Witness" / "Watch this office" / "Post here" as top CTAs, and cross-references from other layers.

## Seeding Strategy

- **Seeded tier** (~1,400 offices): US Congress, Governors, statewide execs, top-300 city mayors. Auto-created landing pages with ingested officeholder data.
- **Below threshold:** User-activated on first request. Page doesn't exist as a rendered URL until someone activates it.
- Activation = fetch from OpenStates, create Office + Official rows, create initial WitnessElection, credit the activating user as founder (timestamped, visible in page metadata).
- `src/lib/ingestion/` will handle external data fetchers (not yet built).

## Key Directories

```
src/app/(public)/                    # Landing, about, district pages, office pages, election pages
src/app/(public)/[state]/[district]/ # Geographic URL structure
src/app/(protected)/                 # Post, vote, candidacy, settings
src/components/ui/                   # shadcn/ui components
src/lib/                             # Server actions, validation, types
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

## Content Architecture

- **Threading:** Indented, collapsible, oldest-first everywhere — threads and top-level posts. Pinned posts float to top. This is a public record, not a social feed.
- **Edit history:** Edits produce versioned records, not overwrites. The original is preserved. The civic archive shows its seams. (PostEdits table — not yet built.)
- **Short permalinks:** `/p/[id]` resolves to canonical URL via 301. Posts must be shareable in a text message.
- **Featured links:** OG metadata snapshot at post creation. Survives source removal/paywalling. Gracefully degrades: full card → text-only → bare link based on fetch status.
- **Tags:** Structured, from controlled vocabulary. Three kinds: `official` (auto-generated per officeholder), `district` (geographic), `issue` (curated by Witnesses, dozen-to-thirty per district). No free-text hashtags. Users pick from dropdowns, not `#whateverfitsbehindahashtag`.
- **Soft deletion:** Content archived via `deleted_at`. ModActions audit log is public. The archive is a civic record.

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
- Headings use Libre Baskerville (substituting for Bookman JF, which lacks an open license). Body uses Open Sans. CSS variables: `--font-serif`, `--font-sans`.

## Terminology

- **Witness** — the elected volunteer watcher (title case, coined term).
- **Watch** (not Follow) — the user action for tracking an office. "Watch the office; the Witness watches the official." Schema table: `OfficeWatches`.
- **Quorum** — the minimum vote count to seat a Witness (not "threshold").
- **Activity** — the time-ordered content list on office pages. Use "Recent activity" in UI (not "feed").
- **Office page** — the per-office discussion community (not "pol page", not "beat").
- Officeholders are referred to by title (Senator, Representative, Mayor, etc.) — never "Primary Pol" or "Pol."
- "Parallel Pol" — fully deprecated. Never use.

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
