# BallotCard Server Actions Spec

The complete mutation surface of BallotCard. Every action that writes to the database is a Next.js server action in `src/lib/*-actions.ts`. This document specifies the contract: input, validation, output, side effects, and security checks for each action.

Pattern follows uunn's approach (see `src/lib/actions.ts` in the uunn repo): Zod-validated inputs, NextAuth session for actor identity, Supabase admin client for writes, descriptive error strings returned on failure.

## File organization

```
src/lib/
  actions.ts                    # Auth: register, login, logout, profile
  district-actions.ts           # District selection, activation
  office-actions.ts             # Office activation, follow/unfollow
  witness-actions.ts            # Witness candidacy, voting, elections
  post-actions.ts               # Create, edit, soft-delete posts + replies
  tag-actions.ts                # Tag creation, proposal, moderation
  mod-actions.ts                # Moderation actions (pin, hide, warn)
  ingestion-actions.ts          # External data ingestion (see INGESTION_SPEC.md)
```

## Common conventions

- All actions are `'use server'`.
- All return `{ success: true, data?: T } | { error: string }`.
- All check `auth()` session for actor identity unless explicitly public.
- All validate input with Zod schemas from `src/lib/validation.ts`.
- All rate-limited via the sliding-window limiter in `src/lib/rate-limit.ts`.
- All mutations that affect cached pages call `revalidatePath()` or `revalidateTag()` after success.
- All errors are logged to Sentry (server-side only) with PII stripped.

## Auth actions (`src/lib/actions.ts`)

Inherited mostly from uunn, simplified. Remove the crypto-vault fields (`publicKey`, `encryptedVault`, `vaultSalt`). Add home-district selection at registration.

### `register(prevState, formData)`
Create a pseudonymous account.

**Input:**
- `username` (3–30 chars, alphanumeric + underscore + hyphen, unique)
- `password` (12+ chars)
- `homeDistrictId` (UUID of an existing district)

**Validation:**
- Username uniqueness check
- Password hashed with bcryptjs at cost 10
- homeDistrictId must reference a real district

**Output:** `null` on success (client handles `signIn`), error string on failure.

**Rate limit:** 5 attempts per IP per hour to prevent enumeration.

### `authenticate(prevState, formData)`
Log in existing user. Unchanged from uunn.

### `logout()`
POST handler at `/logout` route. Clears session, redirects to `/`.

### `getUserProfileAction()`
Return current user's profile.

**Output:** `{ profile: { username, createdAt, homeDistrict, ... } }`.

### `updateHomeDistrictAction(newDistrictId)`
Change user's home district. Rate-limited to once per ~2 years (based on `home_district_set_at`).

**Validation:**
- District must exist
- Cannot be the same as current
- `home_district_set_at` must be null or more than 2 years ago

**Output:** Success or "You can change your home district again on [date]."

### `changePasswordAction(oldPassword, newPassword)`
Standard password change with old-password verification.

### `deleteAccountAction()`
Soft-redacts user. Posts by the user are not deleted (permanence principle), but authorship is anonymized to `[deleted]`. Any active Witness seat held by the user is vacated and triggers an immediate election.

**Side effects:**
- Update `Users` row: `username = '[deleted-' || short_id || ']'`, `password_hash = null`, `home_district_id = null`
- Update all `Posts` by this user: `author_id = null` (RLS uses null as "deleted author")
- Update `Witnesses` row if current: `is_current = false`, trigger new election
- Insert `ModActions` row recording the deletion event

## District actions (`src/lib/district-actions.ts`)

### `activateDistrictAction(districtGeoSlug)`
Marks a district as activated (`activated_at = NOW()`). This is rarely called directly; usually happens as a side effect of `activateOfficeAction`.

**Requires:** Authenticated user.

**Output:** Success with district row, or error if district doesn't exist.

### `getDistrictBallotAction(districtId)`
Returns the set of offices on a given district's ballot — including seeded, activated, and unactivated offices known from external data. Used by ballot home and district landing pages.

**Public — no auth required.**

**Output:**
```typescript
{
  district: District;
  layers: {
    federal: Office[];
    state: Office[];
    county: Office[];
    municipal: Office[];
  };
  // for each office: primary_pol, witness (or null), followers count
}
```

## Office actions (`src/lib/office-actions.ts`)

### `activateOfficeAction(officeId)`
Bring an unseeded office live on BallotCard.

**Requires:** Authenticated user whose home district contains this office (or is a descendant in the district tree).

**Validation:**
- Office exists (known from ingested data)
- Office is not already activated
- User's home district is in the office's district subtree

**Side effects:**
- `Offices.activated_at = NOW()`
- Also activates parent `Districts` if not already activated (cascade up)
- Fetches latest officeholder data from external sources (OpenStates, Ballotpedia)
- Creates `Officials` row
- Creates initial `WitnessElection` scheduled to align with next real election for the seat
- Inserts activation audit record

**Output:** Success with redirect target (the now-live office page).

### `followOfficeAction(officeId)`
User follows an office.

**Requires:** Authenticated user.

**Side effects:** Insert `OfficeFollows` row. Idempotent — re-following is a no-op.

### `unfollowOfficeAction(officeId)`
Inverse of above.

**Side effects:** Delete `OfficeFollows` row.

## Witness actions (`src/lib/witness-actions.ts`)

### `fileCandidacyAction(electionId, statementShort, statementLong)`
File a candidacy for a Witness seat.

**Requires:** Authenticated user whose home district contains the office this election is for.

**Validation:**
- Election exists and is in filing or voting phase
- User is a resident of the office's district (home_district_id is in the subtree)
- User has not already filed for this election (one candidacy per user per election)
- `statementShort` is 10–280 characters
- `statementLong` is optional, 0–5000 characters

**Side effects:**
- Insert `WitnessCandidacies` row
- Revalidate election page

**Output:** Success with candidacy ID, or error.

### `editCandidacyAction(candidacyId, statementShort, statementLong)`
Edit your own candidacy statement. Allowed until voting closes.

**Requires:** Authenticated user is the candidate (auth.uid() = candidacy.user_id).

### `withdrawCandidacyAction(candidacyId)`
Withdraw from an election. Existing votes for this candidate are preserved in the record but flagged as "for a withdrawn candidate" in the tally.

**Side effects:**
- Set `WitnessCandidacies.withdrawn_at = NOW()`
- Revalidate election page

### `castVoteAction(electionId, candidacyId)`
Vote for a Witness candidate.

**Requires:** Authenticated user who is a resident of the office's district.

**Validation:**
- Election is in voting phase
- Candidacy is active (not withdrawn) and belongs to this election
- User is a resident of the office's district
- One vote per user per election (enforced by unique constraint `(election_id, voter_id)`)
- If the user has already voted, this is treated as a vote change — update rather than insert

**Side effects:**
- Upsert `WitnessVotes` row on `(election_id, voter_id)` key
- Revalidate election page

**Output:** Success with current tally snapshot.

### `seatWitnessAction(electionId)`
Internal action (called by scheduled job at `voting_closes_at`) to seat the winning Witness.

**Requires:** System-scheduled; not user-callable from UI.

**Logic:**
- Determine winner (most votes, breaking ties by earliest candidacy filing)
- If total votes < quorum, the seat remains vacant
- If a winner: insert `Witnesses` row with the term dates
- Set previous Witness for the office `is_current = false`
- Revalidate office page, ballot home of all followers

## Post actions (`src/lib/post-actions.ts`)

### `createPostAction(officeId, title, body, featuredLinkUrl?, tagIds[])`
Create a new top-level post on an office page.

**Requires:** Authenticated user. Home-district residency is NOT required for posting — any authenticated user can post on any office page. (This is the one place where cross-district participation is allowed, because residency-gated posting would silence legitimate cross-district analysis like coastal policy posts tagging multiple coastal districts.)

**Validation:**
- Office exists and is activated
- Title is 5–300 characters
- Body is 10–50000 characters
- Tags are all from the valid controlled vocabulary
- If featured link URL provided: must be valid http(s), must pass the fetch step

**Side effects:**
- Fetch OG metadata if `featuredLinkUrl` provided (with 5s timeout and redirect following)
- Insert `Posts` row with OG snapshot fields populated
- Insert `PostTags` rows
- If author is current Witness for this office: set `is_witness_post = true`
- Revalidate office page, ballot homes of followers, district activity feeds

**Output:** Success with post ID, or error.

**Rate limit:** 10 posts per user per day; 3 per minute.

### `createReplyAction(parentPostId, body)`
Create a threaded reply.

**Requires:** Authenticated user. No residency gate.

**Validation:**
- Parent post exists and is not deleted
- Body is 1–20000 characters
- Nesting depth ≤6; beyond this, reply is attached to the 6th-level ancestor

**Side effects:**
- Insert `Posts` row with `parent_id` set
- If author is current Witness for this office: `is_witness_post = true`
- Revalidate thread page

**Rate limit:** 30 replies per user per day; 5 per minute.

### `editPostAction(postId, newTitle?, newBody?, newFeaturedLinkUrl?)`
Edit your own post. Revision history preserved (each edit creates a row in `PostRevisions` — a table to be added).

**Requires:** Authenticated user is the author.

**Side effects:**
- Insert `PostRevisions` row with pre-edit snapshot
- Update `Posts` row with new values + new `updated_at`
- Re-fetch OG metadata if featured link URL changed

### `softDeletePostAction(postId, reason?)`
Soft-delete your own post. Sets `deleted_at`. Post body remains in DB but is hidden from public views.

**Logic:**
- If author deleting their own post: allowed
- If current Witness for the office deleting someone else's post: allowed, creates `ModActions` row
- Otherwise: denied

### `getPostAction(postId)`
Public read of a post plus its replies. Returns full thread.

**No auth required.**

**Output:** Post with `replies` array, each with nested `replies`, etc.

## Tag actions (`src/lib/tag-actions.ts`)

### `searchTagsAction(query, kind?, scopeDistrictId?)`
Public typeahead search for tags.

**Output:** Up to 10 matching tags.

### `proposeIssueTagAction(label, scopeDistrictId, justification?)`
Propose a new issue tag. Goes to review queue, not live immediately.

**Requires:** Authenticated user.

**Side effects:** Insert row in `TagProposals` table (to be added) with status 'pending'.

### `approveTagProposalAction(proposalId)` / `rejectTagProposalAction(proposalId)`
Moderator actions on tag proposals.

**Requires:** User is Witness for an office that touches the proposal's scope district. (Tag vocabulary governance is distributed to Witnesses.)

## Mod actions (`src/lib/mod-actions.ts`)

### `pinPostAction(postId)` / `unpinPostAction(postId)`
Pin a post to the top of its office page. Only one pinned post per office at a time.

**Requires:** Current Witness of the office.

### `moderateReplyAction(postId, action: 'warn' | 'hide')`
Light moderation on replies that violate norms.

**Requires:** Current Witness of the office that contains this reply.

**Side effects:**
- `warn`: prepend `[Moderator note: this reply may not meet community standards for sourcing.]` to the reply
- `hide`: soft-delete the reply (author sees it, others see "[reply hidden by Witness]")
- Insert `ModActions` audit row

### `getModActionLogAction(officeId)`
Public read of moderation history for an office.

**Output:** List of `ModActions` rows scoped to this office.

## Ingestion actions (`src/lib/ingestion-actions.ts`)

These are scheduled jobs / admin endpoints rather than user-facing actions. See `INGESTION_SPEC.md` for full details on:

- `ingestSeededTier()` — populate federal, state-exec, top-city-mayor offices from OpenStates + Ballotpedia + curated lists
- `refreshOfficialsAction(districtId)` — re-fetch officeholder data for a district
- `fetchOpenGraphAction(url)` — fetch OG metadata for a URL (used by post creation)

### `fetchOpenGraphAction(url)` — implementation notes

Self-hosted, not third-party. BallotCard does not use Cardyb, Microlink, or other external OG services because:
1. User composition patterns should not flow through another company's infrastructure on a pseudonymous civic platform
2. Public courtesy services (like Cardyb) can rate-limit, change, or disappear — a hard dependency is fragile

**Implementation shape:**
```typescript
// src/lib/og-fetch.ts
export async function fetchOpenGraph(url: string): Promise<FeaturedLink> {
  // 1. Validate scheme (http/https only), URL length, syntax
  // 2. Resolve DNS, block private IPs (use ipaddr.js)
  // 3. Fetch with undici, 5s total timeout, max 5 redirects, 2MB response cap
  // 4. Parse HTML head with node-html-parser
  // 5. Extract og:*, twitter:*, fallback to <title> / <meta name="description">
  // 6. Return structured FeaturedLink with fetchStatus
}
```

**Recommended libraries:**
- `node-html-parser` — faster than cheerio, sufficient for head-only parsing
- `undici` — built into Node 18+, no new dependency
- `ipaddr.js` — private IP detection

**Security requirements (non-negotiable):**
- Accept only http:// and https://
- Block: localhost, 10/8, 172.16/12, 192.168/16, 127/8, 169.254/16, ::1, fc00::/7, fe80::/10
- Check post-DNS-resolution IP, not just hostname
- 5-second timeout total (connect + read)
- 2 MB response size cap
- User-Agent: `BallotCard/1.0 (+https://ballotcard.org)`
- Rate limit per-user: 10/min, 100/day

**Fallback behavior:**
- Valid OG tags found → `fetch_status = 'ok'`, full card renders
- Valid page but no OG tags → use `<title>` and description if available, set `fetch_status = 'no_metadata'`
- Fetch fails (network error, timeout, blocked) → save the URL only, set `fetch_status` accordingly
- Never block the post from saving because of fetch failure

## Validation schemas

All Zod schemas live in `src/lib/validation.ts`. Example shape:

```typescript
export const CreatePostSchema = z.object({
  officeId: z.string().uuid(),
  title: z.string().min(5).max(300),
  body: z.string().min(10).max(50000),
  featuredLinkUrl: z.string().url().optional().nullable(),
  tagIds: z.array(z.string().uuid()).max(10),
});

export const CandidacySchema = z.object({
  electionId: z.string().uuid(),
  statementShort: z.string().min(10).max(280),
  statementLong: z.string().max(5000).optional(),
});

// ...etc for each action
```

## Security principles re-stated

1. **RLS handles public reads.** All `SELECT` policies are `USING (true)` on public-content tables. Server actions don't need to re-check read authorization.

2. **Server actions handle write authorization.** RLS is a second line of defense, but the primary check happens in the server action (user identity via `auth()`, district-scope checks that RLS can't express).

3. **Never trust client input.** Zod-validate every parameter. Reject on any shape violation.

4. **District residency is checked in actions, not RLS.** Because district residency requires traversing the `Districts.parent_id` tree, it's done in server action code with a recursive query.

5. **Rate limiting is per-user-per-action.** Keyed by `user_id + action_name`. Uses the uunn-style sliding-window limiter.

6. **Sentry captures errors but strips PII.** Usernames are hashed before sending to Sentry; no bodies or emails are logged.
