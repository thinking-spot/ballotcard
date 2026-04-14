# BallotCard URL Structure

A map of public and protected routes. Designed around the principle that geography is the organizing primitive and URLs should reflect the ballot card hierarchy.

## Conventions

### Segments and slugs
- **State**: two-letter lowercase (`nc`, `ca`, `tx`).
- **District slug**: kebab-case, nested under state (`nc/new-hanover`, `nc/new-hanover/wilmington`). Matches `Districts.geo_slug`.
- **Congressional districts**: use the numeric suffix (`nc/07`, `ca/12`). Distinct from county/municipal districts.
- **Office slug**: kebab-case within a district (`us-house`, `us-senate-a`, `mayor`, `commission-seat-3`).
- **Post ID**: short UUID or nanoid; post permalinks are always reachable via both canonical and short forms.
- **Username**: alphanumeric plus underscore/hyphen, case-preserved for display but case-insensitive for routing.

### Canonical vs. short URLs
- **Canonical URLs are fully nested** for legibility and SEO: `/nc/07/us-house`. This is what Witness links share by default, what search engines index, and what appears in breadcrumbs.
- **Short permalinks exist** for posts and elections to make sharing manageable: `/p/[post-id]` redirects to the canonical nested URL. Short URLs are for pasting into text messages; canonical URLs are for everything else.

### Trailing slash
- No trailing slash. All routes normalize with `next.config.ts`.

### Case
- All URL segments are lowercase. Routing is case-insensitive; server redirects mixed-case to lowercase canonical.


## Public routes

### Root and static
- `/` — Landing page. For unauthenticated visitors, shows the mission, how BallotCard works, and signup/login CTAs. For authenticated visitors, redirects to `/ballot` (their home view).
- `/about` — Mission and principles.
- `/how-it-works` — The Witness system explained with examples.
- `/principles` — The seven design principles (from `CLAUDE.md`), written for the general reader.
- `/privacy` — Privacy posture (no tracking, no analytics, pseudonymous, no email).
- `/terms` — Terms of service.
- `/support` — Future donation page, capped at operating costs. Placeholder until needed.
- `/stats` — Aggregate platform activity: total offices covered, active Witnesses, posts this week. Public transparency, no user-level metrics.
- `/login` — Public because it must be reachable without a session.
- `/signup` — Same. Accepts `?next=<path>` to redirect after account creation.

### Geographic tree
Districts nest; URLs mirror the nesting. Every district has a landing page that lists its offices and child districts.

- `/us` — National layer. Lists federal offices (Senate × 100, House × 435, Presidency, Vice Presidency when applicable). Links to all states.
- `/[state]` — State layer. Lists statewide offices (Governor, Lt Gov, AG, SoS, Supreme Court) and state legislative districts. Links to counties.
  - e.g., `/nc`
- `/[state]/[congressional-district]` — US House district page. Shows the US House seat and summarizes which counties/municipalities are covered.
  - e.g., `/nc/07`
- `/[state]/[county]` — County layer. Lists county-level offices and links to municipalities within.
  - e.g., `/nc/new-hanover`
- `/[state]/[county]/[municipality]` — City or town layer. Lists municipal offices.
  - e.g., `/nc/new-hanover/wilmington`
- `/[state]/[school-district]` — School board districts, when separately bounded.
  - e.g., `/nc/new-hanover-schools`

District pages all follow the same template: header with district name and description, list of offices (seeded + activated), list of child districts, recent activity across all offices in this subtree, sidebar with stats and zoom-in/zoom-out controls.

### Offices
Office URLs are nested under their district. An office page is the subreddit-for-this-seat that anchors the whole platform.

- `/[district-path]/[office-slug]` — Office page (the template we mocked).
  - `/nc/07/us-house`
  - `/nc/senate-a` (one of NC's two US Senate seats, differentiated by seat label)
  - `/nc/governor`
  - `/nc/new-hanover/commission/seat-3`
  - `/nc/new-hanover/wilmington/mayor`
  - `/nc/new-hanover/wilmington/council/district-4`

### officeholders
officeholder pages aggregate across any offices that person has held. Most residents will land on them via Pol-tag links.

- `/pol/[primary-pol-id]` — Canonical officeholder page. Shows current office, prior offices held, all posts tagged with this Pol across all districts, external references. Powerful for long-running accountability — Rep. X's record follows them across committee assignments and re-elections.

### Witness elections
Elections are nested under their office because they are attached to specific terms of specific seats.

- `/[district-path]/[office-slug]/election/[term-start-year]` — Election page for a specific term (the second mockup).
  - `/nc/07/us-house/election/2027`
- `/[district-path]/[office-slug]/election` — Redirects to the current or most recent election for the office.

### Posts
Post permalinks resolve to the office page context with the thread expanded.

- `/[district-path]/[office-slug]/post/[post-id]` — Canonical post permalink. Shows the post, its thread, and the office context.
- `/p/[post-id]` — Short permalink. Redirects to canonical.

### User profiles
Public, pseudonymous.

- `/u/[username]` — User profile. Shows their public posts, any Witness seats they hold (current and historical), any candidacies they've filed, date joined. No engagement score, no karma, no activity heatmap.

### Tags
Structured tag pages for cross-cutting surfacing.

- `/tag/issue/[scope-state]/[scope-district]/[issue-label]` — Issue tag page within a district scope.
  - `/tag/issue/nc/new-hanover/coastal-resilience`
- `/tag/pol/[primary-pol-id]` — All posts tagged with a specific officeholder. Equivalent to `/pol/[id]`'s post list; one canonicalizes to the other.
- `/tag/district/[state]/[district]` — All posts tagged with a specific district.

Tag pages are secondary navigation. The primary path is always district → office → post.

### Search
- `/search?q=[query]` — Text search across post titles and bodies, officeholder names, office titles, and district names. Scoped by default to the user's home district subtree; a toggle expands to all-layers.

### Discovery
- `/discover` — Optional: lists offices with recently active Witnesses, newly activated districts, elections opening soon. Useful in the early days when the platform is sparse and users want to see what *is* happening rather than what isn't in their district.


## Protected routes

Narrow. The bulk of the platform is public; auth is for writing, voting, running, and account management.

### Auth actions
- `/logout` — POST handler, clears session, redirects to `/`.

### Account and settings
- `/settings` — Account overview. Shows username, home district, account age, account deletion option.
- `/settings/district` — Change home district. Rate-limited (once per election cycle, tracked via `home_district_set_at`).
- `/settings/password` — Change password.
- `/settings/delete` — Account deletion confirmation flow.

### Home / ballot card
- `/ballot` — The authenticated user's home view. A rendered ballot card for their home district: every office on their ballot, Witness status per office, recent activity across followed offices. This is where most authenticated sessions start.
- `/ballot/zoom/[layer]` — Zoom controls apply here. `layer` is one of `local | county | state | national`. Sets the aperture for the feed.

### Writing
Post composition happens in the context of an office. The flow is: navigate to office → click "Post" → compose → submit → redirected to the permalink.

- `/[district-path]/[office-slug]/post/new` — Compose a new top-level post for this office.
- `/[district-path]/[office-slug]/post/[post-id]/reply` — Compose a reply to a post. (Could also be inline on the post page; this route exists for dedicated compose views on mobile.)
- `/[district-path]/[office-slug]/post/[post-id]/edit` — Edit your own post. Original version preserved in history (visible via a revision link).

### Elections
- `/[district-path]/[office-slug]/election/[term-start-year]/vote` — Cast or change your vote. Verifies home district before accepting. Redirects back to the election page after submission.
- `/[district-path]/[office-slug]/election/[term-start-year]/candidacy/new` — File a candidacy. Verifies home district. Allows `statement_short` and `statement_long`.
- `/[district-path]/[office-slug]/election/[term-start-year]/candidacy/[candidacy-id]/edit` — Edit your own candidacy statement or withdraw.

### Following
- `/[district-path]/[office-slug]/follow` — POST/DELETE handlers, toggles follow state. No dedicated page; returns to the office page.

### Activation
- `/[district-path]/[office-slug]/activate` — Activates an unseeded office page. Triggers ingestion of latest officeholder data from external sources, creates the Office row, schedules the first Witness election. Returns to the now-live office page.
- `/[district-path]/activate` — Activates a district (less common; usually districts are auto-created when an office in them is activated).

### Moderation
Moderation tools are scoped. A Witness can moderate within their office's subreddit; they have no authority elsewhere.

- `/[district-path]/[office-slug]/moderate` — Moderation dashboard for this office. Accessible only to the current Witness for this office. Shows flagged posts, recent activity, audit log of prior moderation actions.
- `/[district-path]/[office-slug]/post/[post-id]/moderate` — Per-post moderation actions (soft-delete, pin, warn author). Records to `ModActions`.


## Route group structure in Next.js

In the codebase, this maps to:

```
src/app/
  (public)/
    layout.tsx                        # Public layout: nav bar, no auth required
    page.tsx                          # /
    about/page.tsx                    # /about
    how-it-works/page.tsx             # /how-it-works
    principles/page.tsx               # /principles
    privacy/page.tsx                  # /privacy
    terms/page.tsx                    # /terms
    support/page.tsx                  # /support
    stats/page.tsx                    # /stats
    login/page.tsx                    # /login
    signup/page.tsx                   # /signup
    search/page.tsx                   # /search
    discover/page.tsx                 # /discover
    us/page.tsx                       # /us
    pol/[id]/page.tsx                 # /pol/[id]
    p/[id]/page.tsx                   # /p/[id] (short permalink, redirects)
    u/[username]/page.tsx             # /u/[username]
    tag/issue/[state]/[district]/[label]/page.tsx
    tag/pol/[id]/page.tsx
    tag/district/[state]/[district]/page.tsx
    [state]/
      page.tsx                        # /[state]
      [...slug]/                      # /[state]/... catchall for nested districts and offices
        page.tsx
  (protected)/
    layout.tsx                        # Protected layout: requires session, redirects to /login
    logout/route.ts                   # POST handler
    settings/
      page.tsx
      district/page.tsx
      password/page.tsx
      delete/page.tsx
    ballot/
      page.tsx
      zoom/[layer]/page.tsx
    [state]/
      [...slug]/                      # Catchall for protected actions on districts/offices/posts
        page.tsx
```

The `[...slug]` catchall pattern in both groups handles the variable-depth district nesting. The route handler parses the slug, resolves to a Districts row or Offices row, and dispatches to the appropriate page component based on what kind of URL was matched (district landing, office page, election page, post permalink, etc.).


## Redirects and canonicalization

- Trailing slashes are stripped.
- Mixed case normalizes to lowercase.
- Short permalinks (`/p/[id]`) 301-redirect to canonical nested URLs so shared links and indexed pages converge.
- Alternate district spellings (`new-hanover-county` vs `new-hanover`) resolve via an alias table in Districts or via 301s to the canonical slug.
- The root `/` is not redirected based on auth at the server level; the landing page checks session client-side and offers a "Go to your ballot" button for authenticated users, rather than forcing a redirect. This keeps `/` cacheable.


## SEO and indexing

- Every district, office, officeholder, Witness, and post page is indexable.
- User profile pages (`/u/[username]`) are indexable but use minimal metadata (pseudonym only) per the pseudonymous posture.
- Election pages are indexable during and after voting; candidate statements are part of the public record.
- Settings and moderation routes are `noindex`.
- `sitemap.xml` is generated from the seeded tier and activated offices; regenerated on any activation event.
- `robots.txt` allows all; no login-walled content exists to protect.


## Open questions

- **Office slug collisions across district levels.** A municipality and a county could both have a "council" office. Resolved by full nesting (`.../county/council` vs `.../city/council`), but worth codifying in a slug registry table to prevent accidental duplication.
- **How to handle redistricting.** When NC-07 boundaries change between cycles, the URL `/nc/07` stays the same, but the underlying geography shifts. Historical posts remain attached to the Office; the `Districts` row gets versioned boundaries. Schema supports this via `Districts.external_refs` (Census GEOID by year), but the UX for "this post was written when NC-07 covered different territory" needs thought.
- **At-large seats.** Some city councils are fully at-large (no sub-districts), others mixed. The slug pattern `council/at-large-1` handles this but the ballot card rendering should make at-large vs district-based seats visually distinct.
- **Judicial races.** Elected judges in many states, with idiosyncratic districts that don't match civil geography. Likely a separate branch of the Districts tree (`kind='judicial'`) with its own slug conventions.
