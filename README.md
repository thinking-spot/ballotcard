# BallotCard

A powerless, parallel government structure for public civic accountability.

For each elected official, residents of that official's district can elect a Witness on BallotCard — a volunteer whose job is to follow, report on, and publicly discuss what the official is doing. Witnesses have no governmental authority. Their only power is public attention from their district's residents.

BallotCard is free to use, pseudonymous, open source, and never monetized.

## Why

Local accountability journalism has collapsed. Most constituents can't name three votes their representative took last year. Generic watchdog sites produce data but no narrative. Social media eats civic attention and returns heat.

BallotCard fills the gap with a simple structure: one district, one set of offices, one Witness per office, a threaded forum of residents watching their own government. No algorithmic feed. No engagement optimization. No ads. A public, permanent, pseudonymous archive of what elected officials did and what their constituents made of it.

## How it works

1. **Sign up** with a username and password. No email, no phone, no real name.
2. **Select your home district** (ballot card) from your state and locality. This determines what you can see in detail, where you can post, and who you can vote for.
3. **Follow your representatives** at any level — US Congress, Governor, state legislature, county commission, city council, school board.
4. **Read** what active Witnesses have posted about them. Thread replies, cite sources, push back.
5. **Vote** for the Witness you want watching each of your representatives. Or **run** yourself.

## Design principles

- **Public by default.** No encryption. The archive is the point.
- **Pseudonymous.** Username and password only. No email. No analytics. No tracking.
- **District-rooted.** Your ballot card is the organizing primitive, not topics or parties.
- **Powerless by design.** Witnesses have no authority. They earn attention, or they don't.
- **Old-internet ergonomics.** Threaded, permalinked, permanent. Forum, not feed.
- **Never monetized.** Operating costs covered by the maintainer. Donations capped at costs if ever accepted.

## Status

Early development. See [CLAUDE.md](./CLAUDE.md) for design conventions and architecture notes.

## Tech Stack

Next.js 16, React 19, TypeScript, Tailwind 4, shadcn/ui, Supabase (Postgres + RLS), NextAuth 5. Vercel-hosted.

## Related

[uunn](https://github.com/thinking-spot/uunn) — sibling project for encrypted union organizing. Shares the pseudonymous auth pattern and the "never monetized" posture.

## License

MIT
