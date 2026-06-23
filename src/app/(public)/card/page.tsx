import Link from "next/link";
import { format } from "date-fns";
import { getBallotCard } from "@/lib/ballot-card";
import type { CardGeographies, CardOffice } from "@/lib/ballot-card";
import { AddressEntry } from "@/components/AddressEntry";
import { SaveBallotButton } from "@/components/SaveBallotButton";

export const metadata = {
  title: "Your ballot — BallotCard",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function partyAbbrev(party?: string): string | null {
  if (!party) return null;
  const p = party.toLowerCase();
  if (p.startsWith("republican")) return "R";
  if (p.startsWith("democratic-farmer")) return "DFL";
  if (p.startsWith("democrat")) return "D";
  if (p.startsWith("independent")) return "I";
  if (p.startsWith("libertarian")) return "L";
  if (p.startsWith("green")) return "G";
  return party;
}

function OfficeRow({ office }: { office: CardOffice }) {
  const party = partyAbbrev(office.officialParty);
  const nextElection = office.nextElectionAt
    ? format(new Date(office.nextElectionAt + "T12:00:00"), "MMM yyyy")
    : null;

  const body = (
    <>
      <div className="min-w-0">
        <p className="text-sm font-medium text-bc-navy truncate">{office.title}</p>
        {office.officialName ? (
          <p className="text-sm text-muted-foreground mt-0.5">
            {office.officialName}
            {party && <span className="ml-1 text-muted-foreground/70">({party})</span>}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground/60 italic mt-0.5">
            {office.placeholder
              ? "No data source for this office yet"
              : "Officeholder data coming"}
          </p>
        )}
      </div>
      {nextElection && (
        <span className="text-xs text-muted-foreground flex-shrink-0 text-right">
          Next election
          <br />
          {nextElection}
        </span>
      )}
    </>
  );

  const rowClass =
    "flex items-center justify-between gap-4 px-4 py-3 border-b border-bc-light-lavender last:border-b-0";

  // Placeholder rows have no permalink to link to; render them as dim, static
  // rows so they're visibly distinct from offices we have data for.
  if (office.placeholder || !office.href) {
    return <div className={`${rowClass} bg-bc-light-lavender/10`}>{body}</div>;
  }

  return (
    <Link
      href={office.href}
      className={`${rowClass} hover:bg-bc-light-lavender/30 transition-colors`}
    >
      {body}
    </Link>
  );
}

export default async function CardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const state = one(sp.s);

  if (!state) {
    return (
      <div className="min-h-screen bg-bc-light-lavender/30">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16">
          <h1 className="font-serif text-2xl text-bc-navy font-bold mb-2">
            Find your ballot
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            Enter your home address to see everyone who represents you.
          </p>
          <AddressEntry variant="plain" />
        </div>
      </div>
    );
  }

  const geo: CardGeographies = {
    state,
    cd: one(sp.cd),
    su: one(sp.su),
    sl: one(sp.sl),
    county: one(sp.county),
    place: one(sp.place),
    countyName: one(sp.cn),
    placeName: one(sp.pn),
  };

  const card = await getBallotCard(geo);

  // Rebuild the canonical district URL — facts about a place, nothing about the
  // user — so "Save my ballot" persists a link, not an identity.
  const cardParams = new URLSearchParams();
  cardParams.set("s", geo.state);
  if (geo.cd) cardParams.set("cd", geo.cd);
  if (geo.su) cardParams.set("su", geo.su);
  if (geo.sl) cardParams.set("sl", geo.sl);
  if (geo.county) cardParams.set("county", geo.county);
  if (geo.place) cardParams.set("place", geo.place);
  if (geo.countyName) cardParams.set("cn", geo.countyName);
  if (geo.placeName) cardParams.set("pn", geo.placeName);
  const cardPath = `/card?${cardParams.toString()}`;

  if (!card || card.sections.length === 0) {
    return (
      <div className="min-h-screen bg-bc-light-lavender/30">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16">
          <h1 className="font-serif text-2xl text-bc-navy font-bold mb-2">
            We don&rsquo;t have data for that ballot yet
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            Your districts resolved, but we haven&rsquo;t ingested their offices
            yet. Try another address, or check back soon.
          </p>
          <AddressEntry variant="plain" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bc-light-lavender/30">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="font-serif text-2xl sm:text-3xl text-bc-navy font-bold leading-tight">
              Your ballot
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Everyone who represents you
              {card.stateName ? ` in ${card.stateName}` : ""} — federal to local.
            </p>
          </div>
          <SaveBallotButton
            path={cardPath}
            label={card.stateName ? `${card.stateName} ballot` : "My ballot"}
          />
        </div>

        <div className="flex flex-col gap-6">
          {card.sections.map((section) => (
            <section key={section.level}>
              <h2 className="font-serif text-lg text-bc-navy font-semibold mb-3">
                {section.label}
              </h2>
              <div className="rounded-lg border border-bc-light-lavender bg-white overflow-hidden">
                {section.offices.map((office) => (
                  <OfficeRow key={office.id} office={office} />
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-8 pt-6 border-t border-bc-light-lavender flex flex-col gap-4">
          {card.dataAsOf && (
            <p className="text-xs text-muted-foreground">
              Data as of {format(new Date(card.dataAsOf), "MMMM d, yyyy")}.
              Offices we don&rsquo;t yet have a data source for appear as honest
              empty rows — your ballot is shown in full.
            </p>
          )}
          <details className="text-sm">
            <summary className="text-bc-navy cursor-pointer hover:underline">
              Look up a different address
            </summary>
            <div className="mt-3">
              <AddressEntry variant="plain" />
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
