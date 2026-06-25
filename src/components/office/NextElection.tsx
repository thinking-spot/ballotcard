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
  // yet — but avoid duplicating them if FEC already lists them as a candidate.
  const hasIncumbentRow = candidates.some((c) => c.isIncumbent);
  const showIncumbentFallback =
    official && !hasIncumbentRow && candidates.length === 0;

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
            cycle, and our source doesn&rsquo;t identify which year this seat is on.
          </p>
        )}
        {office.primaryElectionAt && (() => {
          const pd = new Date(office.primaryElectionAt + "T12:00:00");
          const pUpcoming = isFuture(pd);
          return (
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[10px] font-medium tracking-wide uppercase text-muted-foreground/80">
                Primary
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
                Challenger filings for state and local races aren’t tracked here yet.
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            {isFederal
              ? "No candidate filings on record for this race yet."
              : "Candidate filings for this race aren’t published here yet."}
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
