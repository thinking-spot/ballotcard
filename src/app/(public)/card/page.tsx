import { format } from "date-fns";
import { getBallotCard } from "@/lib/ballot-card";
import type { CardGeographies } from "@/lib/ballot-card";
import { AddressEntry } from "@/components/AddressEntry";
import { SaveBallotButton } from "@/components/SaveBallotButton";
import { BallotCardRow } from "@/components/card/BallotCardRow";

export const metadata = {
  title: "Your ballot — BallotCard",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

// Chrome-world wrapper for the address-entry fallback states. Transparent so
// the iPad page gradient shows through.
function ChromeShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="max-w-[760px] mx-auto px-5 pt-12 pb-20 font-[family-name:var(--font-sans-ui)]">
      <h1 className="font-serif text-[2rem] font-bold leading-[1.15] text-[var(--chrome-title)] mb-2">
        {title}
      </h1>
      {children}
    </div>
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
      <ChromeShell title="Find your ballot">
        <p className="text-[0.9375rem] text-[var(--chrome-subtitle)] mb-6">
          Enter your home address to see everyone who represents you.
        </p>
        <AddressEntry variant="plain" />
      </ChromeShell>
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
      <ChromeShell title="We don't have data for that ballot yet">
        <p className="text-[0.9375rem] text-[var(--chrome-subtitle)] mb-6">
          Your districts resolved, but we haven&rsquo;t ingested their offices
          yet. Try another address, or check back soon.
        </p>
        <AddressEntry variant="plain" />
      </ChromeShell>
    );
  }

  const eyebrow = [card.stateName, format(new Date(), "MMMM d, yyyy")]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="max-w-[760px] mx-auto px-5 pt-12 pb-20 font-[family-name:var(--font-sans-ui)]">
      {/* BALLOT HEADER — chrome world: dark text on the lit screen */}
      <div className="flex items-start justify-between gap-4 mb-7">
        <div>
          <p className="text-[0.6875rem] font-medium tracking-[0.08em] uppercase text-[var(--chrome-eyebrow)] mb-1.5">
            {eyebrow}
          </p>
          {/* Serif title bridges the two worlds */}
          <h1 className="font-serif text-[2rem] font-bold leading-[1.15] text-[var(--chrome-title)]">
            My ballot
          </h1>
          <p className="mt-1.5 text-[0.9375rem] text-[var(--chrome-subtitle)]">
            Everyone who represents you — federal to local.
          </p>
        </div>
        <div className="mt-1.5">
          <SaveBallotButton
            path={cardPath}
            label={card.stateName ? `${card.stateName} ballot` : "My ballot"}
          />
        </div>
      </div>

      {/* LEGEND */}
      <div className="flex flex-wrap gap-x-6 gap-y-1.5 mb-5 text-[0.8125rem] text-[var(--chrome-muted)]">
        <span className="flex items-center gap-1.5">
          <span
            className="w-[9px] h-[9px] rounded-[2px] opacity-75 flex-shrink-0"
            style={{
              background: "var(--activity-tint)",
              border: "1px solid var(--activity-border)",
            }}
          />
          Click an office to see recent activity
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="w-[9px] h-[9px] rounded-[2px] opacity-75 flex-shrink-0"
            style={{
              background: "var(--challenger-tint)",
              border: "1px solid var(--challenger-border)",
            }}
          />
          Click a date to see who&rsquo;s running
        </span>
      </div>

      {/* BALLOT CARD — the paper document */}
      <div className="ballot-card" role="list">
        {card.sections.map((section) => (
          <div key={section.level}>
            <div className="section-header">
              <span className="section-label">{section.label}</span>
              <span className="section-rule" />
              <span className="section-count">
                {section.offices.length}{" "}
                {section.offices.length === 1 ? "office" : "offices"}
              </span>
            </div>
            {section.offices.map((office) => (
              <BallotCardRow key={office.id} office={office} />
            ))}
          </div>
        ))}

        {/* BALLOT FOOTER — inside the card (paper world) */}
        <div className="ballot-footer-inner">
          {card.dataAsOf && (
            <p>
              Data as of {format(new Date(card.dataAsOf), "MMMM d, yyyy")}.
              Offices we don&rsquo;t yet have a data source for appear as honest
              empty rows — your ballot is shown in full.
            </p>
          )}
          <details className="mt-2">
            <summary className="cursor-pointer">
              <a>▶ Look up a different address</a>
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
