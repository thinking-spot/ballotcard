import { format, formatDistanceToNow, isFuture } from "date-fns";
import type { CandidateData, OfficialData } from "@/lib/office-data";

interface NextElectionProps {
  office: {
    title: string;
    level: string;
    nextElectionAt?: string;
    nextElectionEstimated?: boolean;
    primaryElectionAt?: string;
    selectionMethod: string;
    hasCandidateSource: boolean;
  };
  official: OfficialData | null;
  candidates: CandidateData[];
  state?: string;
}

function fmtMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${n}`;
}

function partyAbbrev(party?: string): string | null {
  if (!party) return null;
  const p = party.toLowerCase();
  if (p.includes("republican")) return "R";
  if (p.includes("democratic-farmer")) return "DFL";
  if (p.includes("democrat")) return "D";
  if (p.includes("independent")) return "I";
  if (p.includes("libertarian")) return "L";
  if (p.includes("green")) return "G";
  return party;
}

/**
 * The "Next election" section on a seat page: when the seat is next on the
 * ballot, who's running (real for federal via FEC; honest "coming" for
 * state/local), and where to verify and register.
 */
export function NextElection({
  office,
  official,
  candidates,
  state,
}: NextElectionProps) {
  const date = office.nextElectionAt
    ? new Date(office.nextElectionAt + "T12:00:00")
    : null;
  const upcoming = date && isFuture(date);
  const isFederal = office.level === "federal";

  // Show the incumbent as a ballot entry even when no candidate filings exist
  // yet — but avoid duplicating them if FEC already lists them as a candidate,
  // and never for a staggered seat without filings: it may not be on the
  // upcoming ballot at all, and the incumbent may not be running.
  const hasIncumbentRow = candidates.some((c) => c.isIncumbent);
  const showIncumbentFallback =
    official &&
    !hasIncumbentRow &&
    candidates.length === 0 &&
    !office.nextElectionEstimated;

  const ballotpediaSearch = `https://ballotpedia.org/wiki/index.php?search=${encodeURIComponent(
    office.title
  )}`;
  const voteGov = state
    ? `https://vote.gov/register/${state.toLowerCase()}/`
    : "https://vote.gov/";

  return (
    <section className="rounded-lg border border-bc-light-lavender bg-white">
      <div className="px-4 pt-4 pb-2 border-b border-bc-light-lavender flex flex-col gap-1">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
            Next election
          </h2>
          {date && (
            <span className="text-xs text-muted-foreground">
              {office.nextElectionEstimated ? (
                `${date.getFullYear()} or ${date.getFullYear() + 2}`
              ) : (
                <>
                  {format(date, "MMMM d, yyyy")}
                  {upcoming && <> · in {formatDistanceToNow(date)}</>}
                </>
              )}
            </span>
          )}
        </div>
        {office.nextElectionEstimated && (
          <p className="text-xs text-muted-foreground/80">
            This chamber has staggered terms — about half its seats are up each
            cycle.
            {candidates.length === 0 &&
              date &&
              ` No qualifying ${date.getFullYear()} candidate filings are on record for this seat.`}
          </p>
        )}
        {/* Estimated seats never show a precise primary date — a "Primary
            March 3, 2026" line under a "2026 or 2028" header reads as if the
            year were known. */}
        {office.primaryElectionAt && !office.nextElectionEstimated && (() => {
          const pd = new Date(office.primaryElectionAt + "T12:00:00");
          const pUpcoming = isFuture(pd);
          // Past primaries get a "Primary held" label so voters don't read the
          // date as still actionable — a March primary should not be presented
          // the same in July as it was in February.
          return (
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[10px] font-medium tracking-wide uppercase text-muted-foreground/80">
                {pUpcoming ? "Primary" : "Primary held"}
              </span>
              <span className="text-xs text-muted-foreground/80">
                {format(pd, "MMMM d, yyyy")}
                {pUpcoming && <> · in {formatDistanceToNow(pd)}</>}
              </span>
            </div>
          );
        })()}
      </div>

      {/* On the ballot */}
      <div className="px-4 py-3">
        <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground mb-2">
          On the ballot
        </p>

        {candidates.length > 0 || showIncumbentFallback ? (
          <>
            <ul className="flex flex-col divide-y divide-bc-light-lavender/70">
              {showIncumbentFallback && official && (
                <li className="py-2 flex items-center justify-between gap-3">
                  <span className="text-sm text-bc-navy">
                    {official.name}
                    {partyAbbrev(official.party) && (
                      <span className="ml-1 text-muted-foreground/70">
                        ({partyAbbrev(official.party)})
                      </span>
                    )}
                  </span>
                  <span className="text-[10px] font-medium tracking-wide uppercase text-bc-navy/70 border border-bc-light-lavender rounded px-1.5 py-0.5">
                    Incumbent
                  </span>
                </li>
              )}
              {candidates.map((c) => (
                <li key={c.id} className="py-2 flex items-center justify-between gap-3">
                  <span className="text-sm text-bc-navy min-w-0">
                    {c.fecId ? (
                      <a
                        href={`https://www.fec.gov/data/candidate/${c.fecId}/`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline"
                      >
                        {c.name}
                      </a>
                    ) : (
                      c.name
                    )}
                    {partyAbbrev(c.party) && (
                      <span className="ml-1 text-muted-foreground/70">
                        ({partyAbbrev(c.party)})
                      </span>
                    )}
                    {c.fecTotals && c.fecTotals.receipts > 0 && (
                      <span className="ml-2 text-xs text-muted-foreground/70">
                        · Raised {fmtMoney(c.fecTotals.receipts)}
                      </span>
                    )}
                  </span>
                  {c.isIncumbent && (
                    <span className="text-[10px] font-medium tracking-wide uppercase text-bc-navy/70 border border-bc-light-lavender rounded px-1.5 py-0.5 flex-shrink-0">
                      Incumbent
                    </span>
                  )}
                </li>
              ))}
            </ul>
            {showIncumbentFallback && !isFederal && (
              <p className="text-xs text-muted-foreground mt-2">
                {office.hasCandidateSource
                  ? "No qualifying challenger filings on record for this race yet."
                  : "BallotCard doesn't have a candidate data source for this office yet."}
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            {office.hasCandidateSource
              ? "No qualifying candidate filings on record for this race yet."
              : "BallotCard doesn't have a candidate data source for this office yet."}
          </p>
        )}
      </div>

      {/* Verify / register */}
      <div className="px-4 py-3 border-t border-bc-light-lavender flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <a
          href={voteGov}
          target="_blank"
          rel="noopener noreferrer"
          className="text-bc-navy underline underline-offset-2 hover:opacity-70"
        >
          Register / check your registration
        </a>
        <a
          href={ballotpediaSearch}
          target="_blank"
          rel="noopener noreferrer"
          className="text-bc-navy underline underline-offset-2 hover:opacity-70"
        >
          This race on Ballotpedia
        </a>
        {isFederal && (
          <span className="text-muted-foreground">
            Candidate data from the FEC
          </span>
        )}
      </div>
    </section>
  );
}
