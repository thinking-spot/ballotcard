# BallotCard Design Brief

Consolidates the design decisions made across the mockup phase. Sits alongside CLAUDE.md as implementation reference. When a later decision has to be made and you want to know "what was the principle behind how we handled X," this is where the answer lives.

## The core design tension

BallotCard looks like a modern web product but behaves like pre-engagement-era civic infrastructure. Every design decision reconciles this tension. Modern typography, clean components, shadcn/ui polish — but no algorithmic feeds, no engagement metrics, no notification loops, no infinite scroll. The aesthetics are 2026; the behavior is closer to a municipal bulletin board.

When in doubt, pull away from engagement-era conventions and toward civic ones.

## Organizing primitive: the ballot card

The ballot card is the product's central metaphor and its most important UX element. A user's ballot card is the exact set of offices they can vote for — Federal / State / County / Municipal — stacked vertically, in ballot order, on one page. This is `/ballot`.

The ballot card scales to every geographic layer. A county district page is a ballot card for county-and-below offices. A state page is a ballot card for state-and-below offices. Same component, different scope.

Why this matters: almost every civic product organizes by topic, party, or personality. BallotCard organizes by ballot. This reintroduces locality as the native unit of civic attention, which is how democracy is supposed to work and has mostly stopped working online.

## Five user roles to design for

1. **Unauthenticated reader** — browses pages, reads posts, sees everything. No friction until they try to write, follow, vote, or run.
2. **Authenticated resident** — signed up, has a home district. Can follow offices, post, reply, vote in their home-district Witness elections, run for Witness, activate unseeded offices in their district.
3. **Witness** — an authenticated resident elected to watch a specific office. Has moderation scope on their office's page only. Serves a fixed term, then faces re-election.
4. **Cross-district reader** — authenticated, but reading a page outside their home district. Can read freely, cannot post or vote there. Their home district is used for the "reading as observer" banner.
5. **New user (day-zero)** — authenticated, has picked a home district, but has not yet followed anything, posted, voted, or engaged. Their ballot home is in the cold-start state.

Every major page has to render coherently for each of these where relevant.

## The three-state rendering pattern

Most substantive pages render in three user-state modes:

- **Cold** — no Witness elected, no posts, no followers. Shows scaffolding and recruitment pitches.
- **Warming** — some activity, some followers, possibly a Witness, possibly not. Mixed state.
- **Healthy** — Witness active and posting, followers engaged, threads live.

The same template handles all three via a state classifier. Cold-start guidance surfaces only when needed. Empty states are civic invitations, not dead ends.

## Color and typography

### Palette

Two-mode: dark sections (navy `#232946` background) and light sections (lavender `#d4d8f0` background, off-white `#fffffe` cards). The alternation creates a reading rhythm without decorative effects.

| Hex | Role |
|---|---|
| `#232946` | Navy — dark backgrounds, light-mode text, primary buttons |
| `#121629` | Deep navy — strokes, outlines |
| `#b8c1ec` | Lavender — dark-mode body text, illustrative fills |
| `#eebbc3` | Blush — accent, highlighted CTAs |
| `#fffffe` | Off-white — light-mode cards, dark-mode headlines |
| `#d4d8f0` | Light lavender — light-mode section backgrounds |

Semantic colors (amber for vacant, blue for active election, green for active Witness, red for critical-only states) come from shadcn's standard palette and are used sparingly. Partisan colors are never used. A Democratic and a Republican officeholder are rendered identically.

### Typography

- **Bookman JF** for headings, post titles, Witness statement headlines, and the wordmark. Serif gives civic gravity.
- **Open Sans** for body text, metadata, UI. Clean sans-serif for legibility.
- No title case, no ALL CAPS anywhere. Sentence case for headings.
- Two weights: 400 regular, 500 bold. Never 600 or 700.
- Body text: 15px/1.7 line-height for long-form post bodies. 14px/1.6 for UI. 12px for metadata.

### Density

Dense enough to show information without scrolling, not dense enough to feel like a dashboard. A ballot home row gets ~14px vertical padding; a post card gets ~1.25rem. Old.reddit information density is the reference, not Twitter.

## Design decisions by page

### Ballot home (`/ballot`)

- Layer-grouped sections (Federal → State → County → Municipal). Mirror of a paper ballot.
- Each office row shows: title, officeholder name with party, next election date, Witness status (active / election open / vacant / not-yet-on-BallotCard).
- Active-user state surfaces recent posts from followed offices *indented under the office they belong to*. Not a merged chronological feed.
- Cold-start state shows a navy "Start here" card with three equal-weight paths (follow, run, activate).
- A persistent "offices not yet on BallotCard" banner at the bottom for users with unactivated offices in their district.
- Layer toggle at top (`Local / County / State / National`) sets aperture for zoom views elsewhere in the app. On the ballot home itself, scrolling is the navigation.
- No algorithmic ranking. No "for you." No trending.

### Office page (`/[state]/[district]/[office]`)

- Breadcrumb at top showing full district hierarchy.
- Primary officeholder card: name, party, term dates, next real election, external references (Ballotpedia, OpenStates, official site, FEC).
- Witness card: handle, statement, post count, follower count, last active. Vacant state shown as amber recruitment pitch.
- Activity feed of office-scoped posts. Pinned Witness post at top (usually a weekly roundup).
- Sidebar: follower count, upcoming real and Witness elections, related offices in same district subtree, issue tags active on this office.
- Cold variant: Witness card replaced with vacancy pitch; activity feed shows cross-references only; followers show "Be the first."

### District landing page (`/[state]`, `/[state]/[district]`, etc.)

- Breadcrumb.
- Main column: list of county/district offices, list of child districts (municipalities), recent activity across subtree.
- Sidebar: zoom navigation (zoom out to parent, zoom in to children), federal representation callout (which US House/Senate covers this district), active issue tags, activation CTA.
- Same three-state handling (cold / warming / healthy) at district level.

### Witness election page (`/[district]/[office]/election/[year]`)

- Voter verification banner at top showing residency status.
- Candidate cards listed in current vote-share order. User's current vote marked with "Your vote" label. Other candidates show "Switch vote" button.
- Live vote percentages always visible (no ballot secrecy; elections are powerless and public).
- Sidebar: turnout count with quorum indicator (green bar when past threshold), election timeline, "about this election" explainer.
- "File candidacy" footer always present, even during voting.

### Vote interaction (modal-style dialog on vote submission)

- Review step, not a click-once cast. Shows candidate card, eligibility checklist (4 items: verified, unique, reversible, public), button labeled with specific action ("Cast vote for @username").
- Reversibility messaged explicitly. Publicness messaged explicitly.
- No ceremony. Serious without being solemn.

### Post thread view (`/[district]/[office]/post/[id]`)

- Full post card with serif headline, byline, Witness badge if applicable, post body in editorial-quality typography (15px/1.7).
- Featured link OG card between byline and body when present. Horizontal layout, image on left, citation on right.
- Inline source links in body text as standard blue underlined (no OG cards for non-featured citations).
- Tag pills at bottom of post.
- Reply count, permalink, revision history link.
- Replies threaded with 2px lavender left-rule per nesting level. Old.reddit indentation pattern.
- Sort toggle: oldest first (default), newest, most discussed. No "best" algorithm.
- Witness badge on Witness replies inline.
- Reply composition at bottom, always visible, with placeholder copy setting norms ("Add to the record. Cite sources where you can...").
- Pagination via explicit "Show N more replies" button. No infinite scroll.

### Post composition (`/[district]/[office]/post/new`)

- Breadcrumb shows where the post will land.
- Title field with serif rendering at write-time.
- Featured source field with live OG preview. Optional, one per post.
- Body with markdown toolbar (B, I, Link, Quote, List, Heading). Write/Preview toggle.
- Tag picker from controlled vocabulary (Pol, District, Issue kinds). Auto-suggests Pol tag for the office. Typeahead against existing tags. New issue tags go through review.
- Sidebar: where-you're-posting context, writing norms, permanence disclosure.
- Autosave draft every ~30s. No scheduled posting, no visibility controls, no anonymous option.

### Landing page (`/`)

- Navy hero: wordmark, minimal nav, sign-up CTA, headline ("A parallel government, with no power and nothing to sell."), sub-headline explaining mechanism, primary CTA ("Find your ballot") plus "See an example."
- Four-card "How it works" section: Ballot / Witness / Thread / Next election.
- "What this isn't" section: five explicit non-features (no algorithm, no ads, no email required, no power, no engagement optimization).
- Two-column "Why it might work / Why it might not" — honest about prospects.
- Final navy CTA ("Be an early resident. Sign up — takes 60 seconds.").
- Footer with open-source link, principles, privacy, terms, support.

### Signup (`/signup`)

- Centered card. Three fields: username (pseudonym), password (12+ chars), home district (cascading State → County → Municipality picker, with "skip municipality" option).
- Four-value footer recap (no email, no tracking, no ads, pseudonymous) linking terms/privacy.
- One primary button: "Create account."

### Settings (`/settings`)

- Sidebar menu: Account, Home district, Password, Delete.
- Account: username, created-at, account overview.
- Home district: change form, rate-limited ("You can change your home district once every two years. Next eligible: [date].").
- Password: standard change flow.
- Delete: two-step confirmation. Explains what happens to posts (remain with authorship redacted; deletion is visible in the record per the permanence principle).

## Layout and responsiveness

### Breakpoints

- Default (wide): two-column where applicable, sidebars visible
- Tablet (~768px): one column, sidebars stack below main content
- Mobile (~360px): single column, tighter padding, status badges stack below office titles, layer toggles become horizontal scroll or select

### Layout principles

- No hidden drawers. No "show sidebar" toggles. If it doesn't fit, it reorders; nothing is hidden behind a hamburger.
- Sidebars stack below main content on narrow screens in the order they appear at wide widths (top-to-bottom when stacked = left-to-right when side-by-side).
- Dense but breathable. Mobile rows get 10px vertical padding as a floor; never less.

## Accessibility commitments

- Semantic HTML always. Every heading is actually a heading. Every button is a button.
- Color never carries sole meaning. Witness status uses both a colored pill and explicit text ("Witness seat vacant," not just an amber dot).
- Focus rings visible, keyboard navigation complete for every action.
- Screen reader–only headings on complex pages.
- No contrast below 4.5:1 for body text, 3:1 for large text.
- Forms have visible labels (no placeholder-only labeling).

## Error and empty states

- Every list component handles its empty state explicitly with civic copy.
- "No posts yet" on an empty office page → invitation to post, not a sad robot.
- "No candidates" on an empty election → explanation of filing and invitation to run.
- Error states use amber (warning) color, not red (except for critical errors like a failed vote submission).
- Network errors preserve user input. Autosave prevents draft loss.

## Voice and copy

Short list of rules:

- **Plain civic language.** Not corporate, not journalistic, not legalistic.
- **Describe, then editorialize.** "Vance skipped scheduled town hall (again)" is better than "Vance is ducking constituents." This applies to the platform's own copy as much as to Witness posts.
- **Name the thing, then explain the constraint.** "Witnesses have no authority. What they have is attention."
- **Sentence case.** No title case.
- **No emoji.** No exclamation points in UI copy.
- **Second person, moderate distance.** "You can change your vote" rather than "You'll be able to change your vote, no worries!"
- **Concede uncertainty where honest.** The landing page's "why it might not work" section is a design decision about tone as much as content.

## What BallotCard deliberately does not look like

- Not Twitter. No algorithmic timeline, no follower-as-status, no trending, no share-to-amplify mechanics.
- Not Reddit. No karma, no downvotes, no subreddit-rivalry dynamics.
- Not Substack. Not a newsletter platform, not pay-to-publish.
- Not NextDoor. Not for neighborhood gossip. Scope is elected government, not local life.
- Not Wikipedia. Not a neutral-tone encyclopedia. Posts are authored; voice is expected. The Wikipedia parallel is the talk-page epistemics (cite, correct, revision history), not the mainspace style.

## What BallotCard is most like

A public-access civic archive run by volunteers, with the ergonomics of old.reddit, the geographic primitive of craigslist, and the epistemic norms of Wikipedia talk pages — delivered through modern typography and clean components.

## Review cadence

Design decisions recorded here should be revisited when any of the following happen:

- A page doesn't work for a user role we hadn't considered
- A feature addition requires a second mechanism rather than extending the core one
- A copy decision produces user confusion in testing
- A layout decision fails at a breakpoint we hadn't accounted for

When in doubt, the principles in CLAUDE.md take precedence over specific decisions in this document.
