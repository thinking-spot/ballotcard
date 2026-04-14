# BallotCard Handoff Package

This is the design-phase output. Start here, then navigate to the specific doc you need.

## The platform in one paragraph

BallotCard is a powerless, parallel government structure for civic accountability. For every elected official, residents of their district can elect a "Witness" — a volunteer who watches, reports, and publicly discusses the official's activities. Witnesses have no authority; their only currency is attention. The platform is public, pseudonymous, open source, and never monetized. It looks like a modern web product and behaves like pre-engagement-era civic infrastructure.

## Documents in this package

### For orientation

- **`README.md`** — Public-facing project description. The first thing a contributor or curious visitor sees.
- **`CLAUDE.md`** — Design principles, architecture overview, tech stack, what we build and what we deliberately don't. Claude Code reads this first on every session.

### For design reference

- **`GLOSSARY.md`** — Finalized vocabulary: BallotCard, Witness, officeholder, Watch, Quorum, etc. If you're writing copy, check here first.
- **`DESIGN_BRIEF.md`** — Consolidated design decisions from the mockup phase. Page-by-page rationale, voice and copy rules, color and typography, accessibility commitments.
- **`URL_STRUCTURE.md`** — Every public and protected route. Catchall pattern, canonical vs short permalinks, redirects.

### For implementation

- **`COMPONENT_INVENTORY.md`** — Every React component implied by the mockups, organized by layer. Props, states, usage notes. Includes TypeScript type definitions for core entities.
- **`SERVER_ACTIONS_SPEC.md`** — Every server action (the mutation surface). Inputs, validation, outputs, side effects, security checks.
- **`INGESTION_SPEC.md`** — External data pipeline for seeded-tier offices. OpenStates, Ballotpedia, Census TIGER, schedule, cost model.
- **`IMPLEMENTATION_ORDER.md`** — The 12-phase build sequence. Each phase is a vertical slice ending with something that works.

### Database migrations

- **`0000_ballotcard_schema_v1.sql`** — Core schema: Districts, Users, Offices, Officials, Witnesses, elections, posts, tags, moderation.
- **`0001_add_featured_links.sql`** — OG metadata columns on Posts, plus implementation notes for OG fetching.

## Which doc to read when

| Situation | Document |
|---|---|
| Starting a new Claude Code session | `CLAUDE.md` |
| Writing UI copy, deciding on terminology | `GLOSSARY.md` |
| Making a design decision on a new page | `DESIGN_BRIEF.md` |
| Wiring up a new route | `URL_STRUCTURE.md` |
| Building a component | `COMPONENT_INVENTORY.md` |
| Writing a server action | `SERVER_ACTIONS_SPEC.md` |
| Handling external data | `INGESTION_SPEC.md` |
| Deciding what to build next | `IMPLEMENTATION_ORDER.md` |
| Schema questions | migrations + `COMPONENT_INVENTORY.md` type definitions |

## Conventions worth restating here

From `CLAUDE.md`, because they come up every session:

- **PascalCase quoted table names.** `"Districts"`, `"Witnesses"`, `"Posts"`. Matches uunn.
- **snake_case columns.** `home_district_id`, `is_current`, `featured_link_url`.
- **RLS on every table.** Public SELECT on public-content tables; writes gated on `auth.uid()` matching the actor.
- **Server actions for all mutations.** No API routes for business logic.
- **Sentence case everywhere.** Headings, buttons, titles. No Title Case, no ALL CAPS.
- **Serif for headings** (Bookman JF / var(--font-serif)), **sans for body** (Open Sans / var(--font-sans)).
- **No engagement optimization.** No algorithmic feeds, no notifications, no trending, no karma, no streaks.
- **Public by default.** The mission is publicness; encryption would defeat it.
- **Pseudonymous.** Username + password only. No email, no phone, no real name.

## What to do with this package

1. Create the BallotCard GitHub repo.
2. Drop all of these files into the repo root (or, for the migrations, into `/migrations`).
3. Open Claude Code pointed at the repo.
4. Start with `IMPLEMENTATION_ORDER.md` Phase 0. Proceed phase by phase.
5. When Claude Code needs context mid-build, direct it to the relevant doc above.

## What's missing from this package

Things that are *deliberately* not designed yet, because they're better figured out during implementation or after launch:

- Moderation policy details (what constitutes "personal attacks," how many warns before a hide, etc.). Seed with minimal rules; let Witness community inform the rest.
- Crisis playbook for brigade attempts, impersonation, or abuse of the activation system. Build monitoring first, design response after first incident.
- Accessibility audit pass with real screen reader users. Do this before public launch, not during design.
- Search implementation details. Phase 11 polish item; start with Postgres full-text search.
- Internationalization. Explicitly not in scope for v1 — US-only.
- Admin dashboard. Build the minimum needed for data-quality review during Phase 8, expand as needs surface.

## The voice of the platform, in one paragraph

BallotCard should read like something a civic-minded neighbor made carefully, not like something a company shipped. Writing is direct, factual, and restrained. Mistakes are acknowledged openly. The product doesn't apologize for being slow or small. It assumes its users are serious people, and it speaks to them as such. No emoji. No exclamation points. No growth tricks. No dark patterns. If that sounds old-fashioned, good.

---

Good luck. Build something that lasts.
