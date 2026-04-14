# BallotCard Component Inventory

Every React component implied by the mockups. Organized by layer: primitives, composites, pages. Each entry has props, key states, and notes on usage.

This is not an exhaustive implementation spec — it's a map. Actual prop types will get firmed up in TypeScript as components are built. Think of this as the outline before writing.

## Directory layout

```
src/components/
  ui/                    # shadcn/ui primitives, lightly customized
    Button.tsx
    Input.tsx
    Textarea.tsx
    Card.tsx
    Badge.tsx
    Breadcrumb.tsx
    Toast.tsx
    Select.tsx
    Tabs.tsx             # note: capital T, matches uunn convention
    ...

  brand/                 # BallotCard-specific low-level pieces
    WordMark.tsx
    AvatarPseudonym.tsx
    StatusPill.tsx
    TagPill.tsx
    WitnessBadge.tsx
    SerifHeading.tsx
    LayerToggle.tsx
    ZoomNav.tsx

  ballot/                # ballot-card primitives
    BallotLayerCard.tsx
    BallotOfficeRow.tsx
    BallotHeader.tsx

  office/                # office page components
    OfficeHeader.tsx
    OfficeholderCard.tsx
    WitnessCard.tsx
    WitnessVacancyCard.tsx
    OfficeActivityFeed.tsx
    OfficeSidebar.tsx

  district/
    DistrictHeader.tsx
    DistrictOfficesList.tsx
    DistrictChildrenList.tsx
    DistrictActivityFeed.tsx
    DistrictSidebar.tsx

  election/
    WitnessElectionHeader.tsx
    VoterVerificationBanner.tsx
    CandidateCard.tsx
    ElectionSidebar.tsx
    VoteReviewDialog.tsx

  post/
    PostCard.tsx
    PostThread.tsx
    PostReply.tsx
    PostComposer.tsx
    FeaturedLinkInput.tsx
    FeaturedLinkCard.tsx
    MarkdownEditor.tsx
    TagPicker.tsx

  landing/
    LandingHero.tsx
    LandingHowItWorks.tsx
    LandingNegations.tsx
    LandingProspects.tsx
    LandingFinalCta.tsx

  layout/
    PublicLayout.tsx
    ProtectedLayout.tsx
    PublicNav.tsx
    Footer.tsx
```

## Primitives (`src/components/brand/`)

### `WordMark`
The BallotCard wordmark. Bookman serif, configurable color (navy on light, off-white on dark).
- Props: `color: 'navy' | 'offwhite'`, `size: 'sm' | 'md' | 'lg'`
- Used in: nav bars, footer, auth pages

### `AvatarPseudonym`
Circle with two-letter initials derived from username. Used everywhere a user avatar appears.
- Props: `username: string`, `size: 'xs' | 'sm' | 'md' | 'lg'`, `colorHash?: boolean` (derive bg color from username hash, default true)
- No image uploads on BallotCard; avatars are always initials-based.

### `StatusPill`
Small pill label for Witness status, activation state, election status.
- Props: `kind: 'witness-active' | 'witness-vacant' | 'election-open' | 'not-activated' | 'your-vote'`, `children: string`
- Each kind has fixed color mapping (amber for vacant, blue for election, green for active, muted for not-activated, blue-inverted for your-vote).

### `TagPill`
Tag display and picker element. Always links to the tag page unless `onRemove` is provided.
- Props: `tag: Tag`, `onRemove?: () => void`, `clickable?: boolean` (default true when no onRemove)
- Renders as blue-tinted pill (`#E6F1FB` bg, `#0C447C` text).

### `WitnessBadge`
Small "Witness" badge inline with usernames and post metadata.
- Props: `size: 'sm' | 'md'`
- Fixed styling: navy pill, uppercase, letter-spacing.

### `SerifHeading`
Wrapper for Bookman serif headings. Ensures consistent sizing across the app.
- Props: `level: 1 | 2 | 3`, `children: ReactNode`
- Level 1: 22–24px, level 2: 18px, level 3: 16px.

### `LayerToggle`
The Local / County / State / National toggle. Used on ballot home and zoom controls.
- Props: `current: Layer`, `onChange: (l: Layer) => void`, `variant: 'horizontal' | 'select'`
- At narrow breakpoints renders as select.

### `ZoomNav`
The zoom-out / zoom-in sidebar widget on district pages.
- Props: `parent?: District`, `children: District[]`, `current: District`

## Ballot primitives (`src/components/ballot/`)

### `BallotHeader`
Top section of the ballot home showing district name, stats, and layer toggle.
- Props: `district: District`, `stats: { offices: number; witnessesActive: number; upcomingElections: number }`, `state: 'cold' | 'warming' | 'healthy'`

### `BallotLayerCard`
A collapsible card for one ballot layer (Federal, State, County, Municipal).
- Props: `layerName: string`, `offices: Office[]`, `subtitleStats?: string`, `variant: 'populated' | 'with-activity'`
- In `with-activity` variant, each office row may expose recent posts indented beneath it.

### `BallotOfficeRow`
One row within a ballot layer card.
- Props: `office: Office`, `primaryHolder: Official`, `witness: Witness | null`, `election: WitnessElection | null`, `isFollowed: boolean`, `userIsResident: boolean`, `recentPosts?: Post[]`
- States: healthy (active Witness, green dot), vacant (amber pill), election-open (blue pill), not-activated (muted pill), with-activity (expanded with indented posts)

## Office page components

### `OfficeHeader`
Breadcrumb, office title, district description, top-right action buttons (Follow, Post).
- Props: `office: Office`, `district: District`, `userCanPost: boolean`, `isFollowed: boolean`

### `OfficeholderCard`
The Primary officeholder card. Real person, real title.
- Props: `officeholder: Official`, `office: Office`
- Shows avatar initial, name with title, party, term, next election, external reference links.

### `WitnessCard`
The elected Witness display. Statement, post count, follower count, last-active.
- Props: `witness: Witness`, `user: User`, `stats: { posts: number; followers: number; lastActiveDaysAgo: number }`
- Used in healthy state.

### `WitnessVacancyCard`
Recruitment pitch for an empty Witness seat. Amber-tinted, "Run for Witness" and "How it works" CTAs.
- Props: `office: Office`, `election: WitnessElection | null`, `userIsResident: boolean`

### `OfficeActivityFeed`
List of recent posts on an office page. Handles pinned Witness posts, cross-references, empty state.
- Props: `posts: Post[]`, `crossReferences: Post[]`, `emptyStatePrompt?: string`
- Empty state in cold variant shows "Be the first to post" with recent cross-references below.

### `OfficeSidebar`
The right-column sidebar on office pages.
- Props: `office: Office`, `followerCount: number`, `upcoming: { realElection?: Date; witnessElection?: Date }`, `relatedOffices: Office[]`, `issueTags: Tag[]`

## District components

### `DistrictHeader`
Breadcrumb, district name, population, office counts.
- Props: `district: District`, `stats: { population?: number; childDistrictCount: number; officesOnBallotCard: number; totalOffices: number }`

### `DistrictOfficesList`
Office list grouped by district-level offices. Similar to BallotLayerCard but scoped to this district's own offices.
- Props: `district: District`, `offices: Office[]`

### `DistrictChildrenList`
Links to child districts (e.g., Wilmington, Wrightsville Beach from New Hanover County).
- Props: `children: District[]`

### `DistrictActivityFeed`
Recent activity across the district's subtree, including cross-references from higher layers.
- Props: `district: District`, `items: (Post | CrossReference)[]`, `timeWindowDays: number`

### `DistrictSidebar`
Zoom nav, federal representation callout, issue tags, activation CTA.
- Props: `district: District`, `parentDistrict?: District`, `childDistricts: District[]`, `federalOffice?: Office`, `issueTags: Tag[]`, `notActivatedCount: number`

## Election components

### `WitnessElectionHeader`
Title, timing, status ("voting open · closes Feb 28").
- Props: `election: WitnessElection`, `office: Office`, `phase: 'filing' | 'voting' | 'closed'`

### `VoterVerificationBanner`
Blue inline banner that shows the user's residency status relative to this election.
- Props: `userIsResident: boolean`, `hasVoted: boolean`, `voteCanBeChanged: boolean`

### `CandidateCard`
One candidate in the election. Shows avatar, handle, join date, statement preview, vote count, user's vote status.
- Props: `candidacy: WitnessCandidacy`, `voteCount: number`, `totalVotes: number`, `isUsersVote: boolean`, `userCanVote: boolean`
- The "Your vote" variant has `border: 2px solid var(--color-border-info)` and a "Your vote" pill; others show "Switch vote" button.

### `ElectionSidebar`
Turnout + quorum indicator, timeline, "about this election."
- Props: `election: WitnessElection`, `totalVotes: number`, `followerCount: number`, `quorum: number`

### `VoteReviewDialog`
Modal-style confirmation before casting a vote.
- Props: `candidacy: WitnessCandidacy`, `election: WitnessElection`, `office: Office`, `isResident: boolean`, `isChangingVote: boolean`, `onConfirm: () => void`, `onCancel: () => void`

## Post components

### `PostCard`
A rendered post. Used both as a top-level post on thread pages and as an embed in activity feeds.
- Props: `post: Post`, `variant: 'full' | 'preview'`, `showOfficeContext?: boolean`
- Full variant includes byline, featured link card, body, tags, reply count.
- Preview variant shows title, one-line excerpt, metadata only.

### `PostThread`
A post plus its threaded replies.
- Props: `post: Post`, `replies: Post[]`, `sortOrder: 'oldest' | 'newest' | 'discussed'`, `userCanReply: boolean`
- Handles nested indentation via `PostReply` recursion.

### `PostReply`
A single reply with optional nested replies.
- Props: `post: Post`, `nestingLevel: number`, `children?: Post[]`, `authorIsWitness: boolean`
- Recursion cap at ~6 levels; deeper threads collapse behind "continue this thread →"

### `PostComposer`
The full composition surface for a new post.
- Props: `office: Office`, `user: User`, `draftPost?: DraftPost`
- Includes title, featured link input, markdown editor, tag picker, autosave indicator, submit actions.
- Used at `/[...]/post/new`.

### `FeaturedLinkInput`
URL input with live OG preview fetch.
- Props: `url: string | null`, `onChange: (url: string | null) => void`, `onFetchError?: (err: Error) => void`
- Debounces URL changes (~600ms after typing stops) before fetching.
- Renders `FeaturedLinkCard` below the input once metadata is loaded.

### `FeaturedLinkCard`
The OG preview card. Used during composition (in the input) and in rendered posts (in the thread view).
- Props: `link: FeaturedLink`, `variant: 'composer' | 'rendered'`
- Composer variant has "Remove source" button.
- Rendered variant is wrapped in an anchor tag; whole card clickable.
- Renders differently based on `link.fetchStatus`:
  - `'ok'`: full card with image, title, description, domain, published date
  - `'no_metadata'`: text-only card with just domain and URL
  - `'failed' | 'timeout' | 'blocked'`: bare link with no card wrapper (component returns a simple styled `<a>` instead)

### `MarkdownEditor`
Write/preview toggleable editor with minimal toolbar.
- Props: `value: string`, `onChange: (v: string) => void`, `minHeight?: number`, `placeholder?: string`
- Toolbar: Bold, Italic, Link, Quote, List, Heading.

### `TagPicker`
Input for adding tags from controlled vocabulary with typeahead.
- Props: `selectedTags: Tag[]`, `onChange: (tags: Tag[]) => void`, `officeContext: Office`, `suggestions: Tag[]`
- Suggests Pol tag for the office automatically. Allows new-issue-tag proposal (goes to review).

## Landing page components

### `LandingHero`
Navy hero with wordmark, nav, CTAs, headline, sub-headline.
- No props; static copy.

### `LandingHowItWorks`
Four-card grid (Ballot / Witness / Thread / Next election).
- No props; static.

### `LandingNegations`
"What this isn't" section. Five paragraphs with serif-rendered emphasis on each negation.
- No props; static.

### `LandingProspects`
Two-column "Why it might work / Why it might not" section.
- No props; static.

### `LandingFinalCta`
Navy "Be an early resident" section with signup button.
- No props; static.

## Layout components

### `PublicLayout`
Wrapper for all public pages. Includes `PublicNav` and `Footer`. No auth required.
- Props: `children: ReactNode`

### `ProtectedLayout`
Wrapper for authenticated pages. Redirects to `/login` if no session. Includes authenticated nav (with user avatar, "your ballot" link, settings).
- Props: `children: ReactNode`, `session: Session`

### `PublicNav`
Top nav bar for public pages. Wordmark, "How it works," "About," "Log in," "Sign up."
- Props: none (pulls session from server if present, shows "Go to your ballot" instead of log in/sign up when authenticated).

### `Footer`
Navy footer with "open source · github" on left and principles / privacy / terms / support links on right.
- No props.

## Data types (referenced by components)

Shared type definitions. These live in `src/lib/types.ts` and are the TypeScript interfaces components import.

```typescript
// Geography
type District = {
  id: string;
  name: string;
  kind: 'country' | 'state' | 'us_house' | 'us_senate_state' | 'governor_state' | 'state_house' | 'state_senate' | 'county' | 'municipality' | 'school_board' | 'judicial';
  state?: string;
  parentId?: string;
  geoSlug: string;
  externalRefs?: Record<string, string>;
  activatedAt?: Date;
};

type Office = {
  id: string;
  districtId: string;
  title: string;
  kind: 'legislative' | 'executive' | 'judicial' | 'board';
  seatLabel?: string;
  termYears?: number;
  nextElectionAt?: Date;
  isSeeded: boolean;
  activatedAt?: Date;
  externalRefs?: Record<string, string>;
};

// People
type User = {
  id: string;
  username: string;
  homeDistrictId?: string;
  homeDistrictSetAt?: Date;
  createdAt: Date;
};

type Official = {
  id: string;
  officeId: string;
  name: string;
  party?: string;
  termStart?: Date;
  termEnd?: Date;
  isCurrent: boolean;
  externalRefs?: Record<string, string>;
};

type Witness = {
  id: string;
  officeId: string;
  userId: string;
  username: string;
  termStart: Date;
  termEnd: Date;
  isCurrent: boolean;
  statement?: string;
};

// Elections
type WitnessElection = {
  id: string;
  officeId: string;
  termStart: Date;
  termEnd: Date;
  filingOpensAt: Date;
  votingOpensAt: Date;
  votingClosesAt: Date;
  minVotesToSeat: number;
};

type WitnessCandidacy = {
  id: string;
  electionId: string;
  userId: string;
  username: string;
  statementShort: string;
  statementLong?: string;
  withdrawnAt?: Date;
  createdAt: Date;
};

// Content
type Post = {
  id: string;
  authorId?: string;
  authorUsername?: string;
  authorIsWitness: boolean;
  parentId?: string;
  officeId?: string;
  title?: string;
  body: string;
  isWitnessPost: boolean;
  isPinned: boolean;
  featuredLink?: FeaturedLink;
  tags: Tag[];
  replyCount: number;
  createdAt: Date;
  updatedAt?: Date;
  deletedAt?: Date;
};

type FeaturedLink = {
  url: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  domain: string;
  publishedAt?: Date;
  fetchedAt: Date;
  fetchStatus: 'ok' | 'no_metadata' | 'failed' | 'timeout' | 'blocked';
};

type Tag = {
  id: string;
  kind: 'pol' | 'district' | 'issue';
  refId?: string;
  label: string;
  scopeDistrictId?: string;
};

// UI-derived types
type Layer = 'local' | 'county' | 'state' | 'national';

type OfficeState =
  | 'cold'           // no Witness, no posts, no followers
  | 'warming'        // some engagement, maybe partial
  | 'healthy'        // active Witness posting regularly
  | 'dormant'        // Witness elected but inactive >30 days
  | 'vacant'         // active followers but no Witness currently seated
  | 'not_activated'; // sub-threshold office not on BallotCard
```

## Notes for implementation

- **Props flow down, server actions handle writes.** Every mutation (follow, post, vote, file candidacy, activate) is a server action. Components are thin; validation and DB writes live in `src/lib/*-actions.ts`.
- **Server components by default.** Every page is server-rendered unless it needs interactivity (composer, vote dialog, tag picker typeahead). Mark `"use client"` only where needed.
- **Form elements use `<form action={serverAction}>`** where possible (Next.js Server Actions for forms). Complex interactions (tag picker typeahead, markdown editor, OG fetch) are client components.
- **No state management library.** React state + server actions + URL params for anything shareable. No Redux, no Zustand, no Jotai.
- **Suspense boundaries on slow queries.** Office activity feeds, election turnout stats, cross-reference fetches — wrap in Suspense with skeleton UI.
