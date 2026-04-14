# BallotCard Implementation Order

The sequence of work to get BallotCard from empty directory to shippable v1. Written for Claude Code to follow, with clear phase boundaries where you can pause, review, and adjust before proceeding.

Each phase ends with something that works. No phase is "make a bunch of files and hope they integrate." Prefer vertical slices (end-to-end thin features) over horizontal slabs (all the components, then all the server actions, then all the pages).

## Phase 0 — Project scaffolding (half a day)

**Goal: a running Next.js 16 app with the brand theme applied and a landing page that loads.**

1. `npx create-next-app@latest ballotcard --typescript --tailwind --app --src-dir --import-alias "@/*"`
2. Initialize git, first commit. Copy over from uunn: `.gitignore`, `eslint.config.mjs`, `tsconfig.json`, `vitest.config.ts` (adapted).
3. Install core dependencies to match uunn's stack:
   - `next-auth@beta`, `@supabase/supabase-js`, `bcryptjs`, `zod`, `date-fns`, `sonner`, `lucide-react`
   - `@radix-ui/react-slot`, `class-variance-authority`, `clsx`, `tailwind-merge`
   - `@sentry/nextjs`
   - Dev: `vitest`, `@vitest/coverage-v8`
4. Install shadcn/ui CLI, init with the project. Configure `components.json` for the brand palette (navy as primary).
5. Extend Tailwind config with the palette and font variables:
   ```js
   colors: {
     'bc-navy': '#232946',
     'bc-deep-navy': '#121629',
     'bc-lavender': '#b8c1ec',
     'bc-blush': '#eebbc3',
     'bc-offwhite': '#fffffe',
     'bc-light-lavender': '#d4d8f0',
   }
   ```
6. Load fonts via `next/font`: Bookman JF (or closest web-available alternative — likely a hosted Bookman variant via Adobe Fonts or self-hosted) for serif, Open Sans for sans. Set CSS variables `--font-serif` and `--font-sans`.
7. Build `WordMark` and `PublicNav` and `Footer` primitives.
8. Create a minimal landing page at `/` that shows the hero section from `DESIGN_BRIEF.md`. Hardcoded copy, no dynamic content yet.
9. Deploy to Vercel, verify the landing page renders correctly in production.

**Checkpoint:** `ballotcard.vercel.app` (or similar preview domain) shows the landing page with correct typography and palette. No features yet. This phase is about getting the foundation right.

## Phase 1 — Database and auth (1–2 days)

**Goal: users can sign up with a pseudonym, pick a home district, and log in.**

1. Set up a Supabase project. Put connection details in `.env.local` and `.env.example`.
2. Run the bootstrap: apply `migrations/0000_ballotcard_schema_v1.sql` and `migrations/0001_add_featured_links.sql` against the new Supabase project.
3. Seed a minimal district tree manually for testing: USA → NC → NC-07 (US House district) + New Hanover County + Wilmington. Just enough to test signup with home-district picker. A proper ingestion run comes later.
4. Port auth from uunn:
   - `src/lib/supabase.ts` — admin client
   - `src/lib/actions.ts` — simplified `register`, `authenticate`, `logout`, `getUserProfileAction`, `deleteAccountAction`, `changePasswordAction`. Drop crypto-vault fields.
   - `src/auth.ts` — NextAuth config (credentials provider, sessions in cookies)
   - `middleware.ts` — route protection for `(protected)` group
5. Build auth pages:
   - `/login` — username/password form
   - `/signup` — username, password, home district picker (cascading Select from `Districts` table)
6. Build `/settings/*` pages per `URL_STRUCTURE.md`.
7. Test: create an account, log in, log out, change password, delete account. All work.

**Checkpoint:** Auth works end-to-end. A new user can sign up, pick New Hanover / Wilmington as their home district, log in, see their username in the nav, log out.

## Phase 2 — First real surface: Office page (2–3 days)

**Goal: the Office page for US House NC-07 renders correctly in both healthy and cold variants, using real database data.**

This is the biggest phase. The Office page is the central artifact; getting it right establishes the pattern for everything downstream.

1. Seed an officeholder for NC-07 manually: Rep. Pat Vance, D, term 2025–2027.
2. Seed a Witness manually: @coastalwatcher (create a second user account, then insert a `Witnesses` row).
3. Seed 2–3 posts from @coastalwatcher including one with a featured link (use a real ProPublica article URL so you test actual OG fetching).
4. Build primitive components:
   - `AvatarPseudonym`, `StatusPill`, `TagPill`, `WitnessBadge`, `SerifHeading`, `Breadcrumb`
5. Build composite components:
   - `OfficeHeader`, `OfficeholderCard`, `WitnessCard`, `WitnessVacancyCard`, `OfficeActivityFeed`, `OfficeSidebar`
   - `PostCard` (preview variant for the feed) — the full variant comes later
   - `FeaturedLinkCard`
6. Build the route: `src/app/(public)/[state]/[...slug]/page.tsx` with a catchall dispatcher. Write a `resolveSlug()` utility that takes `[state, ...slug]` and returns a `{ kind: 'district' | 'office' | 'post' | 'election', data: ... }` discriminated union.
7. For `kind === 'office'`, render the Office page assembling the components above.
8. Classify office state (`healthy` / `cold` / `warming` / `vacant` / `dormant`) via a `classifyOfficeState()` function that takes Witness, posts, and followers data.
9. Render the cold variant when classification returns 'cold'. Use the same components; the cards themselves switch internal rendering based on props.
10. Manually test both states by toggling the seed data.

**Checkpoint:** `/nc/07/us-house` renders the Office page with real data. Switching the seed data between healthy and cold states produces the correct rendering. A logged-out user sees everything; a logged-in user sees a Follow button.

## Phase 3 — Following and basic writes (1–2 days)

**Goal: users can follow offices and create top-level posts.**

1. Server actions:
   - `followOfficeAction`, `unfollowOfficeAction`
   - `createPostAction` with OG fetching
2. Client interactions:
   - Follow button with optimistic update
   - Post composition surface at `/[...]/post/new`
3. Build `PostComposer`, `FeaturedLinkInput`, `MarkdownEditor`, `TagPicker` components.
4. Implement OG fetching: `fetchOpenGraph(url)` in `src/lib/og-fetch.ts` — self-hosted (not Cardyb or other third-party services, per the rationale in `INGESTION_SPEC.md`). Use `undici` for fetching, `node-html-parser` for head-only HTML parsing, `ipaddr.js` for private IP detection. Apply the security hardening, timeouts, and rate limits from `SERVER_ACTIONS_SPEC.md`. Set `fetch_status` on every post so the card can render gracefully in all states (ok / no_metadata / failed / timeout / blocked).
5. Implement tag typeahead: `searchTagsAction(query, kind)` — returns up to 10 matching tags. Wire into `TagPicker`.
6. Test: post a new message on NC-07 with a featured link. Verify the OG card renders correctly in the feed.

**Checkpoint:** Logged-in users can follow NC-07 and create new posts with featured links and tags. Their post appears immediately on the office page's activity feed.

## Phase 4 — Ballot home (2 days)

**Goal: `/ballot` shows the user's full ballot card with layer cards, in all three user states (cold / active / populated).**

1. Build `BallotHeader`, `BallotLayerCard`, `BallotOfficeRow`, `LayerToggle`.
2. Server data:
   - `getDistrictBallotAction(districtId)` — returns the grouped ballot for a district, with layer-mapped offices, their officeholders, their Witnesses, the user's follow state per office
3. Build `/ballot` page:
   - Gets user's `homeDistrictId` from session
   - Calls `getDistrictBallotAction`
   - Renders layer cards
4. Implement the three user states (cold / active / populated) via a classifier on user's follow count and recent activity.
5. Add the activity surfacing for followed offices — posts indented under the office, capped at 3 per office with "see more" link.

**Checkpoint:** A logged-in user on `/ballot` sees their ballot with every seeded and activated office grouped by layer. Cold-start shows the "Start here" navy card. Once they follow offices and those offices have posts, activity appears inline.

## Phase 5 — Thread view, replies, and post permalinks (1–2 days)

**Goal: users can view a full post thread and add threaded replies.**

1. Build `PostThread`, `PostReply`, full-variant `PostCard`.
2. Server actions: `createReplyAction`, `editPostAction`, `softDeletePostAction`.
3. Route: `/[...]/post/[postId]` renders the thread.
4. Short permalink: `/p/[postId]` route that 301-redirects to canonical URL.
5. Revision history: `PostRevisions` table migration, simple revision display on a sub-route.

**Checkpoint:** Click a post on the office page → land on a full thread view with replies. Reply to someone. Edit your own post, see the revision marker appear.

## Phase 6 — Witness elections (2 days)

**Goal: users can file candidacy, vote, and see live results.**

1. Build election components: `WitnessElectionHeader`, `VoterVerificationBanner`, `CandidateCard`, `ElectionSidebar`, `VoteReviewDialog`.
2. Server actions: `fileCandidacyAction`, `editCandidacyAction`, `withdrawCandidacyAction`, `castVoteAction`.
3. Route: `/[...]/election/[termStart]` renders the election page.
4. Route: `/[...]/election/[termStart]/vote` renders the review dialog (modal-like full-page).
5. District residency check helper in `src/lib/auth-helpers.ts`: `isUserResidentOfOffice(userId, officeId)`.

**Checkpoint:** Manually create a Witness election for NC-07. File a candidacy from a second user account. Vote from a third user account (whose home district is in NC-07). See the tally update.

## Phase 7 — District landing pages (1 day)

**Goal: `/nc`, `/nc/new-hanover`, `/nc/new-hanover/wilmington` render as proper district landings.**

1. Build `DistrictHeader`, `DistrictOfficesList`, `DistrictChildrenList`, `DistrictActivityFeed`, `DistrictSidebar`, `ZoomNav`.
2. In the catchall dispatcher, handle `kind === 'district'` by rendering the district landing.
3. Cross-reference query: find posts tagged with the district or any of its child districts, paginated.

**Checkpoint:** Navigate from `/ballot` to a district page via zoom-out. See the district's own offices, its children, and recent activity across the subtree.

## Phase 8 — Ingestion of seeded tier (1–2 days)

**Goal: real data for federal offices, governors, and top-300 city mayors. BallotCard looks like a real product.**

1. Build `/seed-data/districts.sql` — output of a Census TIGER load script, committed to the repo.
2. Build `/seed-data/mayors.csv` — manually curated top-300 city mayors.
3. Write an ingestion CLI at `scripts/ingest-seed.ts`:
   - Applies `districts.sql`
   - Reads `mayors.csv`, inserts offices and officeholders
   - Calls OpenStates for federal officeholders, inserts them
   - Calls Ballotpedia (via scraping with attribution) for governors/AGs, inserts them
4. Schedule a Vercel cron to run a refresh job weekly.

**Checkpoint:** Deploy the seeded data to production. The landing page's "see an example" link works for multiple real offices. Any US voter can find their Senator and Representative on the platform.

## Phase 9 — Activation flow (1 day)

**Goal: users can activate sub-threshold offices in their district.**

1. `activateOfficeAction` server action.
2. "Not yet on BallotCard · activate" button on ballot home and district pages triggers the action.
3. Live fetch of officeholder data at activation time.
4. On success, redirect to the now-live office page.

**Checkpoint:** A Wilmington resident can click "Activate" on the Wilmington City Council page and land on a live page with the current councilmembers pulled from external data.

## Phase 10 — Moderation (1 day)

**Goal: Witnesses can pin, warn, and hide within their office's scope.**

1. Build `mod-actions.ts`: `pinPostAction`, `unpinPostAction`, `moderateReplyAction`.
2. Build moderation UI — contextual "mod" menu on posts/replies when viewer is the current Witness.
3. Build `/[...]/[office]/moderate` dashboard page.
4. Public `ModActions` log visible on each office page (audit transparency).

**Checkpoint:** The current Witness for NC-07 can pin their weekly roundup, soft-delete a spam reply, and see the audit log on the office page.

## Phase 11 — Polish, accessibility, mobile (2–3 days)

**Goal: the product is genuinely shippable.**

1. Accessibility pass on every page: keyboard nav, screen reader labels, focus rings, contrast checks.
2. Responsive review at 320px, 360px, 768px, 1024px breakpoints.
3. Error states and loading skeletons everywhere.
4. Sentry integration verified, PII stripping confirmed.
5. Copy review: every piece of UI copy re-read against the voice principles in `DESIGN_BRIEF.md`.
6. `/stats`, `/support`, `/principles` pages.

**Checkpoint:** Product is ready for real users.

## Phase 12 — Launch preparation

Actions taken when you're ready to invite the first real residents:

1. Domain setup (ballotcard.org or chosen domain).
2. Ingest full seeded tier (all 50 states, not just NC).
3. Write the first "How it works" explainer post on the blog or `/about` page.
4. Seed a handful of example posts by you (acting as the first Witness for your own district) so new users land on a live product, not scaffolding.
5. Soft launch to a small group (friends, civic-minded contacts) before wider announcement.

## Total estimate

Roughly 3–4 weeks of focused work for one developer using Claude Code as pairing partner. Could be faster if phases are tackled in parallel where they don't block each other (e.g., ingestion can happen in the background while UI phases continue).

## Dependencies that would slow things down

- **Bookman JF licensing.** If the font isn't web-available for commercial use, pick an alternative (Bookman Old Style, Sentinel, or a free serif with similar feel) and get the decision made early.
- **Ballotpedia scraping permission.** Reach out to them before Phase 8 so there's no legal cloud over the ingestion.
- **Supabase pricing.** The free tier should cover early development. When users arrive, upgrade to Pro. Budget roughly per `CLAUDE.md`.
- **Font and asset CDN.** Vercel handles this fine for now.

## Decision points for you to review

After each phase, it's worth a pause to check:

1. Does this still feel like the civic product we designed?
2. Did anything in the implementation surface a design decision we got wrong?
3. Is the code organized in a way the next phase can build on?

Quick fixes at the end of each phase are cheaper than rework after launch.
