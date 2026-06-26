"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format, isPast } from "date-fns";
import type { CardOffice } from "@/lib/ballot-card";

// Party → display abbreviation + the paper-world color class.
function partyMeta(party?: string): { abbr: string; cls: string } | null {
  if (!party) return null;
  const p = party.toLowerCase();
  if (p.includes("republican")) return { abbr: "R", cls: "party-r" };
  if (p.includes("democratic-farmer")) return { abbr: "DFL", cls: "party-d" };
  if (p.includes("democrat")) return { abbr: "D", cls: "party-d" };
  if (p.includes("libertarian")) return { abbr: "L", cls: "party-i" };
  if (p.includes("independent")) return { abbr: "I", cls: "party-i" };
  if (p.includes("green")) return { abbr: "G", cls: "party-i" };
  if (p.includes("nonpartisan")) return { abbr: "NP", cls: "" };
  return { abbr: party, cls: "" };
}

function fmtMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${n}`;
}

const shortDate = (d: string) => format(new Date(d + "T12:00:00"), "MMM yyyy");
const longDate = (d: string) => format(new Date(d + "T12:00:00"), "MMM d, yyyy");
const yearOf = (d: string) => new Date(d + "T12:00:00").getFullYear();

// Staggered chambers: ~half the seats are up each even year and we have no
// per-seat class, so we name both candidate cycles instead of a false-precise
// single date. Exact seats render the normal "Mon YYYY".
function electionLabel(next?: string, estimated?: boolean): string {
  if (!next) return "—";
  if (estimated) return `${yearOf(next)} or ${yearOf(next) + 2}`;
  return shortDate(next);
}

// Outbound "follow their work" links built from the officeholder's external
// refs — the honest pre-articleOne state of the Activity panel.
function outboundLinks(refs?: Record<string, string>) {
  if (!refs) return [];
  const out: { label: string; href: string }[] = [];
  if (refs.official_site) out.push({ label: "Official site", href: refs.official_site });
  if (refs.bioguide)
    out.push({ label: "Congress.gov", href: `https://www.congress.gov/member/${refs.bioguide}` });
  if (refs.openstates)
    out.push({ label: "OpenStates", href: `https://openstates.org/person/${refs.openstates}` });
  if (refs.ballotpedia)
    out.push({ label: "Ballotpedia", href: `https://ballotpedia.org/${refs.ballotpedia}` });
  if (refs.wikipedia)
    out.push({ label: "Wikipedia", href: `https://en.wikipedia.org/wiki/${refs.wikipedia}` });
  return out;
}

function PartyTag({ party }: { party?: string }) {
  const m = partyMeta(party);
  if (!m) return null;
  return <span className={m.cls}> ({m.abbr})</span>;
}

/**
 * One ballot row — two independently clickable zones. The left zone expands the
 * Activity panel (the officeholder's recent work); the right zone expands the
 * Challengers panel (who's running next). Opening one closes the other.
 *
 * Placeholder rows (offices we have no data source for yet) and rows with no
 * current officeholder render as static, honest empty rows — no accordions.
 */
export function BallotCardRow({ office }: { office: CardOffice }) {
  const [open, setOpen] = useState<null | "act" | "chal">(null);

  const next = office.nextElectionAt;
  const leftExpandable = !office.placeholder && !!office.officialName;
  const rightExpandable = !office.placeholder && !!next;
  // Hide the right zone entirely when there's no date to show — a dangling
  // "NEXT ELECTION —" on placeholder rows reads as broken, not honest.
  const showRight = !!next;
  // Past-primary check via date-fns (stable for the row's lifetime under
  // memo; lets us re-label "Primary" → "Primary held" once the date has passed).
  const primaryPast = useMemo(
    () =>
      office.primaryElectionAt
        ? isPast(new Date(office.primaryElectionAt + "T12:00:00"))
        : false,
    [office.primaryElectionAt]
  );

  const toggle = (which: "act" | "chal") =>
    setOpen((cur) => (cur === which ? null : which));

  const links = outboundLinks(office.officialRefs);
  const candidates = office.candidates ?? [];

  return (
    <div className={`ballot-row${office.placeholder ? " row-empty" : ""}`} role="listitem">
      <div className={`row-main${showRight ? "" : " row-main-solo"}`}>
        {/* LEFT ZONE — activity */}
        <button
          type="button"
          className={`row-left${leftExpandable ? "" : " static"}${open === "act" ? " open" : ""}`}
          onClick={leftExpandable ? () => toggle("act") : undefined}
          aria-expanded={leftExpandable ? open === "act" : undefined}
          aria-label={
            leftExpandable
              ? `${office.title}, ${office.officialName} — show recent activity`
              : undefined
          }
          disabled={!leftExpandable}
        >
          <span className="row-left-content">
            <span className="office-name" style={{ display: "block" }}>
              {office.title}
            </span>
            <span className="officeholder-name" style={{ display: "block" }}>
              {office.placeholder ? (
                "No data source yet — checking back"
              ) : office.officialName ? (
                <>
                  {office.officialName}
                  <PartyTag party={office.officialParty} />
                </>
              ) : (
                "No officeholder on record yet"
              )}
            </span>
          </span>
          {leftExpandable && (
            <span className="left-expand" aria-hidden="true">
              ▶
            </span>
          )}
        </button>

        {/* RIGHT ZONE — next election / challengers. Suppressed when there's
            no date so placeholder rows don't show a dangling em-dash. */}
        {showRight && (
          <button
            type="button"
            className={`row-right${rightExpandable ? "" : " static"}${
              office.placeholder ? " dim" : ""
            }${open === "chal" ? " open" : ""}`}
            onClick={rightExpandable ? () => toggle("chal") : undefined}
            aria-expanded={rightExpandable ? open === "chal" : undefined}
            aria-label={
              rightExpandable && next
                ? `${office.title} — show candidates for the ${electionLabel(
                    next,
                    office.nextElectionEstimated
                  )} election`
                : undefined
            }
            disabled={!rightExpandable}
          >
            <span className="election-label">Next election</span>
            <span className="election-date">
              {electionLabel(next, office.nextElectionEstimated)}
            </span>
            {rightExpandable && (
              <span className="right-expand" aria-hidden="true">
                ▼
              </span>
            )}
          </button>
        )}
      </div>

      {/* ACTIVITY PANEL */}
      {open === "act" && (
        <div className="panel">
          <div className="panel-header">
            <span>Recent activity — {office.officialName}</span>
            {office.href && (
              <Link className="panel-meta" href={office.href}>
                View all →
              </Link>
            )}
          </div>
          <div className="activity-empty">
            Activity for this officeholder is coming — votes, floor statements,
            hearings, and news mentions, each linked to its source.
            {links.length > 0 && (
              <>
                {" "}
                Until then, follow their work:{" "}
                {links.map((l, i) => (
                  <span key={l.label}>
                    <a href={l.href} target="_blank" rel="noopener noreferrer">
                      {l.label}
                    </a>
                    {i < links.length - 1 ? " · " : ""}
                  </span>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {/* CHALLENGERS PANEL */}
      {open === "chal" && (
        <div className="panel challenger">
          <div className="panel-header">
            <span>
              Candidates
              {next ? ` — ${electionLabel(next, office.nextElectionEstimated)}` : ""}
            </span>
            <span className="panel-meta">
              {office.nextElectionEstimated
                ? "Staggered — exact year varies by seat"
                : office.primaryElectionAt
                  ? `${primaryPast ? "Primary held" : "Primary"} ${longDate(office.primaryElectionAt)}`
                  : "General election"}
            </span>
          </div>

          {candidates.length > 0 ? (
            candidates.map((c) => (
              <div className="challenger-item" key={c.id}>
                <div>
                  <div className="challenger-name">
                    {c.fecId ? (
                      <a
                        href={`https://www.fec.gov/data/candidate/${c.fecId}/`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "inherit", textDecoration: "none" }}
                      >
                        {c.name}
                      </a>
                    ) : (
                      c.name
                    )}
                    <PartyTag party={c.party} />
                  </div>
                  <div className="challenger-meta">
                    {c.isIncumbent ? "Incumbent · running for re-election" : "Challenger"}
                    {c.raised ? ` · raised ${fmtMoney(c.raised)}` : ""}
                  </div>
                </div>
                <span
                  className={`challenger-badge ${
                    c.isIncumbent ? "badge-incumbent" : "badge-challenger"
                  }`}
                >
                  {c.isIncumbent ? "Incumbent" : "Challenger"}
                </span>
              </div>
            ))
          ) : (
            <div className="challenger-item">
              <div>
                <div className="challenger-name" style={{ fontStyle: "italic", fontWeight: 400 }}>
                  {office.level === "federal"
                    ? "No declared candidates on record yet"
                    : "Candidate filings aren’t published here yet"}
                </div>
                <div className="challenger-meta">
                  {office.level === "federal"
                    ? "Check back as the cycle develops"
                    : "State & local candidate data is coming"}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
