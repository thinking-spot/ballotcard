import { format } from "date-fns";
import { AvatarPseudonym } from "@/components/ui/AvatarPseudonym";
import type { OfficialData } from "@/lib/office-data";

interface OfficeholderCardProps {
  official: OfficialData;
  nextElectionAt?: string;
}

export function OfficeholderCard({
  official,
  nextElectionAt,
}: OfficeholderCardProps) {
  const refs = official.externalRefs ?? {};
  const externalLinks: { label: string; href: string }[] = [
    refs.ballotpedia
      ? {
          label: "Ballotpedia",
          href: `https://ballotpedia.org/${refs.ballotpedia}`,
        }
      : null,
    refs.openstates
      ? { label: "OpenStates", href: `https://openstates.org/person/${refs.openstates}` }
      : null,
    refs.house_gov
      ? { label: "house.gov", href: `https://${refs.house_gov}` }
      : null,
    refs.fec
      ? { label: "FEC", href: `https://www.fec.gov/data/candidate/${refs.fec}` }
      : null,
    refs.official_site
      ? { label: "Official site", href: refs.official_site }
      : null,
  ].filter(Boolean) as { label: string; href: string }[];

  // Append T12:00:00 so date-only strings parse as local noon, not UTC midnight.
  const termLabel = [
    official.termStart
      ? format(new Date(official.termStart + "T12:00:00"), "MMM yyyy")
      : null,
    official.termEnd
      ? format(new Date(official.termEnd + "T12:00:00"), "MMM yyyy")
      : null,
  ]
    .filter(Boolean)
    .join(" – ");

  const nextElectionLabel = nextElectionAt
    ? format(new Date(nextElectionAt + "T12:00:00"), "MMM d, yyyy")
    : null;

  return (
    <div className="rounded-lg border border-bc-light-lavender bg-white p-4 mb-3">
      <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground mb-3">
        Incumbent
      </p>

      <div className="flex items-start gap-3">
        <AvatarPseudonym username={official.name} size="lg" />

        <div className="min-w-0">
          <p className="font-serif text-base font-bold text-bc-navy leading-tight">
            {official.name}
          </p>
          <p className="text-sm text-muted-foreground mt-0.5">
            {[
              official.party,
              termLabel ? `Term: ${termLabel}` : null,
              nextElectionLabel ? `Next election: ${nextElectionLabel}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
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
