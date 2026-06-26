// Pure helpers for the ballot row. Lifted out of BallotCardRow.tsx so they
// can be unit-tested without mounting React.
import { format } from "date-fns";

export function partyMeta(
  party?: string
): { abbr: string; cls: string } | null {
  if (!party) return null;
  const p = party.toLowerCase();
  // "democratic-farmer" must come before "democrat" — DFL substring matches both.
  if (p.includes("republican")) return { abbr: "R", cls: "party-r" };
  if (p.includes("democratic-farmer")) return { abbr: "DFL", cls: "party-d" };
  if (p.includes("democrat")) return { abbr: "D", cls: "party-d" };
  if (p.includes("libertarian")) return { abbr: "L", cls: "party-i" };
  if (p.includes("independent")) return { abbr: "I", cls: "party-i" };
  if (p.includes("green")) return { abbr: "G", cls: "party-i" };
  if (p.includes("nonpartisan")) return { abbr: "NP", cls: "" };
  return { abbr: party, cls: "" };
}

// Compact dollar amounts: $1.5M / $205k / $7 — keeps row layouts narrow.
export function fmtMoney(n: number): string {
  if (n >= 1_000_000)
    return `$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${n}`;
}

export const shortDate = (d: string) =>
  format(new Date(d + "T12:00:00"), "MMM yyyy");
export const longDate = (d: string) =>
  format(new Date(d + "T12:00:00"), "MMM d, yyyy");
export const yearOf = (d: string) =>
  new Date(d + "T12:00:00").getFullYear();

// Staggered chambers: ~half the seats are up each even year and we have no
// per-seat class, so we name both candidate cycles instead of a false-precise
// single date. Exact seats render the normal "Mon YYYY".
export function electionLabel(next?: string, estimated?: boolean): string {
  if (!next) return "—";
  if (estimated) return `${yearOf(next)} or ${yearOf(next) + 2}`;
  return shortDate(next);
}
