# BallotCard Glossary — Finalized

Decisions locked as of April 2026. This document supersedes the working draft and is ready for use in production copy, URLs, and schema names.

---

## Naming principles

The criteria all terms were evaluated against:

1. **Civic, not corporate.** Should feel like something a citizen does, not something a product offers.
2. **Civic, not social-media.** "Feed," "followers," "posts," and "engagement" have drifted into connotations we want to avoid. Where a civic word is available, prefer it.
3. **Neutral.** No partisan valence. Equally inviting to a conservative retiree and a progressive student.
4. **Legible.** Comprehensible on first reading. Minimal required onboarding.
5. **Distinctive.** Not generic.
6. **Honest.** Don't dress up the power relationship. Witnesses have no authority — the term shouldn't imply otherwise.
7. **Sayable.** Works in speech, not just on screen. "I'm the Witness for NC-07" should sound natural.

---

## Core vocabulary

### BallotCard
**The platform itself.**

Kept. Self-explanatory, descriptive, neutral, easy to say, tied to the central UX element. The name reinforces the product rather than feeling arbitrary, and has room to grow into its meaning.

---

### Witness
**A volunteer resident elected by their district to follow, report on, and publicly discuss the activities of a specific elected official. No governmental authority. Serves a fixed term, then faces re-election.**

The platform's core coined term — the only role that required a new word. Chosen over alternatives (Correspondent, Observer, Monitor, Watcher) because:
- It has civic pedigree (election witnesses, court witnesses)
- It implies action: witnesses don't just observe, they testify
- It works in speech: "I'm the Witness for NC-07"
- The election mechanic pairs naturally: "BallotCard elects a Witness for each district," "the Witness seat for NC-07 is vacant," "run for Witness"

Usage examples:
- *"Alicia was elected Witness for NC-07."*
- *"The Witness for NC-07 reports that Senator Markey voted..."*
- *"No Witness has been seated yet — be the first to run."*
- *"Your district's Witness seat is vacant."*

---

### [Elected official — no platform term]
**The real elected official — the person who actually holds the office.**

No platform-specific name. Use their actual title: Senator, Representative, Governor, Mayor, Judge. This is intentional — BallotCard didn't invent these people. They exist in the real world; the platform tracks them. Using real titles is more legible and more honest than a branded term, and it resolves the executive/judge problem automatically.

Usage: "Senator Markey's activity," "Mayor Johnson's vote record" — never "Pol Markey" or "Primary Pol Johnson."

---

## Full vocabulary reference

| Term | Use | Notes |
|------|-----|-------|
| **BallotCard** | The platform | Kept |
| **Witness** | The elected volunteer watcher role | Core coined term |
| **[Official title]** | The real elected official | No platform term; use Senator, Mayor, Judge, etc. |
| **Office page** | The per-office discussion community | Plain, clear; no colloquial shorthand needed |
| **Activity** | The time-ordered list of recent content | Use in UI ("Recent activity"); avoid "feed" |
| **Follow / Follower** | A user who tracks an office | Kept; familiarity outweighs social-media connotation |
| **Quorum** | Minimum votes to seat a Witness | Replaces "seating threshold"; "election requires a 25-vote quorum to seat a Witness" |
| **Term** | Duration of a Witness's service before re-election | Standard civic term |
| **Candidacy / Candidate** | Someone who has filed to run for a Witness seat | Standard civic term |
| **Statement** | A candidate's written pitch to voters | Short and long forms |
| **Post** | A top-level forum contribution | Standard |
| **Reply** | A threaded response to a post | Standard |
| **Thread** | A post plus its replies | Standard |
| **Tag** | Structured metadata (office tag, district tag, issue tag) | Standard |
| **Home district** | The district a user has identified as their residence | Kept |
| **Activation / Activated** | A sub-threshold office page going live | Kept |
| **Seeded / Seeded tier** | Pre-populated high-leverage offices | Internal use; "Already on BallotCard" or "Covered offices" in public copy |
| **Cross-reference** | Content from one office page appearing on another | Internal term; UI label: "Also mentioned in..." |
| **Zoom in / Zoom out** | Navigation mechanic for moving through the district tree | Kept |

---

## Consolidated vocabulary in use

A sentence using the finalized vocabulary:

*"Alicia is the Witness for NC-07. She follows Senator Markey and posts weekly activity summaries on the office page. Her last election had 41% turnout and cleared the 25-vote quorum."*

---

## Branding

### Color palette

BallotCard uses a two-mode palette — darker sections and lighter sections — built from the same base hues. The palette is muted and civic-feeling: deep navy, soft lavender, warm blush, and near-white. It avoids the saturated primaries common to political branding, which tends to read as partisan.

**Darker sections**

| Element | Hex |
|---------|-----|
| Background | `#232946` |
| Headline | `#fffffe` |
| Paragraph | `#b8c1ec` |
| Button | `#eebbc3` |
| Button text | `#232946` |
| Illustration stroke | `#121629` |
| Illustration main | `#b8c1ec` |
| Illustration highlight | `#eebbc3` |
| Illustration secondary | `#fffffe` |
| Illustration tertiary | `#eebbc3` |

**Lighter sections**

| Element | Hex |
|---------|-----|
| Background | `#d4d8f0` |
| Headline | `#232946` |
| Sub-headline | `#232946` |
| Card background | `#fffffe` |
| Card heading | `#232946` |
| Card paragraph | `#232946` |
| Icon stroke | `#121629` |
| Icon main | `#b8c1ec` |
| Icon highlight | `#eebbc3` |
| Icon secondary | `#fffffe` |
| Icon tertiary | `#eebbc3` |

**Core hues for reference**

- **Navy** `#232946` — primary background (dark mode), primary text (light mode)
- **Deep navy** `#121629` — strokes, outlines
- **Lavender** `#b8c1ec` — body text (dark mode), illustration fill
- **Blush** `#eebbc3` — buttons, highlights, accent
- **Off-white** `#fffffe` — headlines (dark mode), card backgrounds
- **Light lavender** `#d4d8f0` — section backgrounds (light mode)

---

### Typography

| Role | Font |
|------|------|
| Headings & wordmark | Bookman JF |
| Body text | Open Sans |

**Bookman JF** for headings and the wordmark gives BallotCard a slightly literary, editorial quality — it's a serif with historical weight, which suits a platform about civic record-keeping. It reads as serious without being bureaucratic.

**Open Sans** for body text keeps reading comfortable and accessible at small sizes. The contrast between the two — old-style serif headlines, clean sans-serif body — mirrors the platform's overall tone: civic gravity up top, plain legibility in the details.

---

## Terms considered and set aside

| Candidate | Reason set aside |
|-----------|-----------------|
| Parallel Pol | Branded, alliterative placeholder; lost its anchor when Primary Pol was dropped |
| Primary Pol | Wrong for executives and judges; unnecessary once real titles are used |
| Pol Prime / Pol | Creates namespace collision with platform UI; unnecessary |
| Correspondent | Implies press credentials; Witness is more citizen-native |
| Observer | Too passive; doesn't imply testimony |
| Monitor | Cold, institutional; UN-observer feel |
| Watcher | Slightly surveillance-coded; lacks civic history |
| Shadow | Espionage connotations in US usage |
| Feed | Algorithmic/social-media connotations |
| Seating threshold | Replaced by Quorum |
| Beat / Desk | Good in a journalism frame; orphaned without Correspondent |
| Downballot | Accurate but insider jargon; kept as a conceptual touchstone, not a product name |
