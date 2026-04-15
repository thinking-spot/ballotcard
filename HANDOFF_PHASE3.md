# BallotCard — Development handoff (start of Phase 3)

**Date:** 2026-04-14  
**Phases complete:** 0 (scaffolding), 1 (auth), 2 (office page)  
**Next:** Phase 3 — Following and basic writes

---

## How to run

```bash
npm run dev         # dev server at localhost:3000
npx tsc --noEmit    # type check
npm run build       # production build
```

Supabase credentials are in `.env.local`. The dev server is configured in `.claude/launch.json` as `"BallotCard"` on port 3000.

---

## What's working right now

- `/` — landing page (5 static sections)
- `/signup` — username + password + home district picker (cascading selects backed by live DB)
- `/login` — credentials auth
- `/settings/profile`, `/settings/password`, `/settings/delete-account`
- `/nc/07/us-house` — **the office page**, rendering live from Supabase

The office page at `/nc/07/us-house` shows:
- Rep. Pat Vance (incumbent, Democratic, Term Jan 2025 – Jan 2027, next election Nov 3, 2026) with Ballotpedia / house.gov / FEC links
- @coastalwatcher (Witness, elected Mar 2025, term ends Feb 2027, 3 posts, 0 followers) with statement
- 3 posts in the activity feed: pinned weekly roundup, ProPublica featured link with OG card, FOIA thread
- Sidebar: follower count, upcoming election date, issue tags (Healthcare, Veterans, Coastal)
- Follow button renders but is **currently disabled** — Phase 3 activates it

---

## Key files

### Data layer
| File | Purpose |
|---|---|
| `src/lib/office-data.ts` | `getOfficePageData(districtGeoSlug, officeSlug)` — all data for office page |
| `src/lib/slug-resolver.ts` | `resolveSlug(state, slug[])` → `{kind: 'office'|'district', ...}` |
| `src/lib/supabase.ts` | Service role Supabase client (bypasses RLS for server reads) |
| `src/lib/actions.ts` | Auth server actions: register, authenticate, logout, changePasswordAction, deleteAccountAction |
| `src/lib/district-actions.ts` | Cascading district picker: getStatesAction, getCountiesAction, getMunicipalitiesAction |
| `src/lib/validation.ts` | Zod schemas — see UUID gotcha below |
| `src/auth.ts` | NextAuth v5 config (JWT strategy, credentials provider) |
| `src/proxy.ts` | Route-protection middleware (Next.js 16 — named proxy.ts, not middleware.ts) |

### Office page components
| File | Purpose |
|---|---|
| `src/components/office/OfficeholderCard.tsx` | Incumbent card with party, term, next election, external links |
| `src/components/office/WitnessCard.tsx` | Witness card with term end, post/follower counts, statement |
| `src/components/office/WitnessVacancyCard.tsx` | Amber vacancy card with filing link |
| `src/components/office/PostCard.tsx` | Post preview: badges (WITNESS, PINNED), title, body excerpt, FeaturedLinkCard, tag pills |
| `src/components/office/FeaturedLinkCard.tsx` | OG preview card (degrades gracefully on failed/blocked/timeout fetch_status) |
| `src/components/office/OfficeActivityFeed.tsx` | "Recent activity" section header + PostCard list |
| `src/components/office/OfficeSidebar.tsx` | Followers count, Upcoming real election, Related offices, Issue tags |

### Primitive UI components
`src/components/ui/`: `AvatarPseudonym`, `StatusPill`, `TagPill`, `WitnessBadge`, `Breadcrumb`

### Route
`src/app/(public)/[state]/[...slug]/page.tsx` — catchall; dispatches to district (Phase 7 placeholder) or office page

### Migrations applied to Supabase
| File | Contents |
|---|---|
| `migrations/0000_ballotcard_schema_v1.sql` | Full schema: Districts, Offices, Officials, Users, Witnesses, Posts, Tags, FeaturedLinks, etc. |
| `migrations/0001_add_featured_links.sql` | FeaturedLinks table, fetch_status column |
| `migrations/0002_phase1_seed.sql` | District tree seed: USA → NC → NC-07, New Hanover County, Wilmington |
| `migrations/0003_phase2_seed.sql` | Adds `slug`/`description` to Offices; seeds Pat Vance, @coastalwatcher, Witness, Tags, Posts |

---

## Finalized vocabulary

| Term | UI use |
|---|---|
| **Witness** | `WITNESS · ELECTED {date}` label on Witness card |
| **Incumbent** | `INCUMBENT` label on officeholder card |
| Real officeholder | Use their title — Senator, Representative, Governor, Mayor, Judge. Never "pol" |
| **Activity** | "Recent activity" in UI (not "feed") |
| **Follow / Follower** | Standard; follower count shown in sidebar and office header |
| **Quorum** | Minimum votes to seat a Witness |

"Primary pol" and "Parallel pol" have been removed from all UI labels.

---

## Technical gotchas

### 1. Zod v4 rejects non-RFC-4122 UUIDs
Zod v4 `.uuid()` enforces version nibble `[1-8]` and variant `[89ab]`. Seed UUIDs (`00000000-0000-4000-8000-...`) fail. Fixed in `src/lib/validation.ts` with a loose hex regex:
```ts
.regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
```
Production `gen_random_uuid()` values pass fine. When adding new UUID Zod fields, use this form instead of `.uuid()`.

### 2. Tailwind v4 — no tailwind.config.ts
Brand tokens are defined in `src/app/globals.css` via `@theme inline`. Do not create `tailwind.config.ts`.

### 3. Date timezone off-by-one
`new Date('2025-03-01')` parses as UTC midnight → renders as Feb 28 in US timezones. Always append `T12:00:00` before constructing a Date from a date-only string:
```ts
new Date(dateString + "T12:00:00")
```
This is already applied in `OfficeholderCard.tsx` and `WitnessCard.tsx`.

### 4. React controlled selects + automation
`DistrictPicker.tsx` selects have stable IDs (`district-state`, `district-county`, `district-municipality`). Automation tools must use the `preview_fill` tool targeting these IDs — native `dispatchEvent(new Event('change'))` does not trigger React synthetic handlers.

### 5. Protected layout nav button ordering
`src/app/(protected)/layout.tsx` has `<form action={logout}><button type="submit">Log out</button></form>` in the nav, which appears before page-level forms in DOM order. When targeting page forms use `main button[type="submit"]`, not just `button[type="submit"]`.

### 6. Next.js 16 middleware naming
Route-protection file is `src/proxy.ts` (not `middleware.ts`). This is the Next.js 16 convention.

---

## Seed credentials (dev only)

| Account | Username | Password |
|---|---|---|
| Witness account | `coastalwatcher` | `witnesspass123` |
| Test residents | create via `/signup` | — |

Seed user `@coastalwatcher` UUID: `00000000-0000-4000-8000-000000000010` (in `migrations/0003_phase2_seed.sql`).

---

## Phase 3 spec

From `IMPLEMENTATION_ORDER.md`:

> **Goal: users can follow offices and create top-level posts.**

### Server actions to write

**`src/lib/office-actions.ts`** (new file):
- `followOfficeAction(officeId)` — inserts into `OfficeFollows`, returns updated count
- `unfollowOfficeAction(officeId)` — deletes from `OfficeFollows`, returns updated count

**`src/lib/post-actions.ts`** (new file):
- `createPostAction(officeId, { title, body, url?, tagIds[] })` — inserts `Posts` row + `FeaturedLinks` row (if URL) + `PostTags` rows; enqueues OG fetch

**`src/lib/og-fetch.ts`** (new file):
- `fetchOpenGraph(url: string): Promise<OGResult>` — self-hosted; do not use third-party OG services
- Use `undici` for HTTP fetch, `node-html-parser` for head-only HTML parsing
- Use `ipaddr.js` for SSRF protection (block private/loopback IPs)
- 5s timeout, set `fetch_status` to `ok | no_metadata | failed | timeout | blocked`
- Full security requirements in `SERVER_ACTIONS_SPEC.md`

**`src/lib/tag-actions.ts`** (new file):
- `searchTagsAction(query: string, kind?: string)` — returns ≤10 matching tags from `Tags` table

### Components to build

- `PostComposer` — title input, body textarea (markdown), optional URL field, TagPicker, submit
- `FeaturedLinkInput` — URL field that shows a live OG preview before submit
- `MarkdownEditor` — simple textarea with preview tab (no heavy WYSIWYG library)
- `TagPicker` — typeahead backed by `searchTagsAction`
- Follow button (replace the disabled button in `src/app/(public)/[state]/[...slug]/page.tsx`) — optimistic update

### Route to add

`src/app/(public)/[state]/[...slug]/post/new/page.tsx` — protected; renders `PostComposer`

### Phase 3 checkpoint

A logged-in resident can:
1. Click Follow on `/nc/07/us-house` → follower count increments immediately (optimistic)
2. Navigate to `/nc/07/us-house/post/new`, write a post with a ProPublica URL
3. Submit → redirected back to office page → new post appears at top of activity feed with OG card rendered
