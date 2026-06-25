import { format } from "date-fns";
import Image from "next/image";
import { AvatarPseudonym } from "@/components/ui/AvatarPseudonym";
import type { OfficialData } from "@/lib/office-data";

interface OfficeholderCardProps {
  official: OfficialData;
  nextElectionAt?: string;
  nextElectionEstimated?: boolean;
}

function fmt(date?: string): string | null {
  // Append T12:00:00 so date-only strings parse as local noon, not UTC midnight.
  if (!date) return null;
  return format(new Date(date + "T12:00:00"), "MMM yyyy");
}

export function OfficeholderCard({
  official,
  nextElectionAt,
  nextElectionEstimated,
}: OfficeholderCardProps) {
  const refs = official.externalRefs ?? {};
  const externalLinks: { label: string; href: string }[] = [
    refs.official_site ? { label: "Official site", href: refs.official_site } : null,
    refs.bioguide
      ? {
          label: "Congress.gov",
          href: `https://www.congress.gov/member/${refs.bioguide}`,
        }
      : null,
    refs.openstates
      ? { label: "OpenStates", href: `https://openstates.org/person/${refs.openstates}` }
      : null,
    refs.ballotpedia
      ? { label: "Ballotpedia", href: `https://ballotpedia.org/${refs.ballotpedia}` }
      : null,
    refs.fec
      ? { label: "FEC", href: `https://www.fec.gov/data/candidate/${refs.fec}` }
      : null,
    refs.wikipedia
      ? { label: "Wikipedia", href: `https://en.wikipedia.org/wiki/${refs.wikipedia}` }
      : null,
  ].filter(Boolean) as { label: string; href: string }[];

  const sinceLabel = fmt(official.firstTookOffice) ?? fmt(official.termStart);
  const termEndLabel = fmt(official.termEnd);
  const nextElectionLabel = nextElectionAt
    ? nextElectionEstimated
      ? (() => {
          const y = new Date(nextElectionAt + "T12:00:00").getFullYear();
          return `${y} or ${y + 2}`;
        })()
      : format(new Date(nextElectionAt + "T12:00:00"), "MMM d, yyyy")
    : null;

  const meta = [
    official.party,
    sinceLabel ? `In office since ${sinceLabel}` : null,
    termEndLabel ? `Term ends ${termEndLabel}` : null,
    nextElectionLabel ? `Next election ${nextElectionLabel}` : null,
  ].filter(Boolean);

  return (
    <div className="rounded-lg border border-bc-light-lavender bg-white p-4 mb-3">
      <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground mb-3">
        Current officeholder
      </p>

      <div className="flex items-start gap-3">
        {official.photoUrl ? (
          <Image
            src={official.photoUrl}
            alt={official.name}
            width={56}
            height={56}
            className="rounded-full object-cover w-14 h-14 flex-shrink-0 bg-bc-light-lavender"
            unoptimized
          />
        ) : (
          <AvatarPseudonym username={official.name} size="lg" />
        )}

        <div className="min-w-0">
          <p className="font-serif text-base font-bold text-bc-navy leading-tight">
            {official.name}
          </p>
          <p className="text-sm text-muted-foreground mt-0.5">
            {meta.join(" · ")}
          </p>
        </div>
      </div>

      {externalLinks.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs">
          {externalLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-bc-navy underline underline-offset-2 hover:opacity-70 transition-opacity"
            >
              {link.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
