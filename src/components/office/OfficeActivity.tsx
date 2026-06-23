import { format } from "date-fns";
import type { OfficialData } from "@/lib/office-data";
import { getOfficialActivity, hasFeedProviders } from "@/lib/feed";

interface OfficeActivityProps {
  official: OfficialData;
}

const KIND_LABELS: Record<string, string> = {
  vote: "Vote",
  floor_statement: "Floor statement",
  hearing: "Hearing",
  testimony: "Testimony",
  news_mention: "In the news",
  press_release: "Press release",
};

/**
 * The Activity section on an official's page. Built against the FeedItem
 * contract in src/lib/feed. When no provider is registered (the pre-articleOne
 * state) it renders an honest "coming" note plus whatever outbound links the
 * official's external refs afford.
 */
export async function OfficeActivity({ official }: OfficeActivityProps) {
  const externalRefs = official.externalRefs ?? {};
  const items = hasFeedProviders()
    ? await getOfficialActivity({ externalRefs, limit: 20 })
    : [];

  return (
    <section className="rounded-lg border border-bc-light-lavender bg-white">
      <div className="px-4 pt-4 pb-2 border-b border-bc-light-lavender">
        <h2 className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
          Activity
        </h2>
      </div>

      {items.length > 0 ? (
        <ul className="divide-y divide-bc-light-lavender">
          {items.map((item) => (
            <li key={item.id} className="px-4 py-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <span className="font-medium text-bc-navy">
                  {KIND_LABELS[item.kind] ?? item.kind}
                </span>
                <span>&middot;</span>
                <span>{format(new Date(item.occurredAt), "MMM d, yyyy")}</span>
                <span>&middot;</span>
                <span>{item.sourceName}</span>
              </div>
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-bc-navy hover:underline"
              >
                {item.title}
              </a>
              {item.summary && (
                <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                  {item.summary}
                </p>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="px-4 py-6">
          <p className="text-sm text-muted-foreground">
            A record of this official&rsquo;s votes, floor statements, hearings,
            and news mentions is coming. Until then, follow their work directly:
          </p>
          <ul className="mt-3 flex flex-col gap-1.5 text-sm">
            {externalRefs.bioguide && (
              <li>
                <a
                  href={`https://www.congress.gov/member/${externalRefs.bioguide}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-bc-navy underline underline-offset-2 hover:opacity-70"
                >
                  Congress.gov activity
                </a>
              </li>
            )}
            {externalRefs.openstates && (
              <li>
                <a
                  href={`https://openstates.org/person/${externalRefs.openstates}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-bc-navy underline underline-offset-2 hover:opacity-70"
                >
                  OpenStates legislative record
                </a>
              </li>
            )}
            {externalRefs.official_site && (
              <li>
                <a
                  href={externalRefs.official_site}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-bc-navy underline underline-offset-2 hover:opacity-70"
                >
                  Official website
                </a>
              </li>
            )}
          </ul>
        </div>
      )}
    </section>
  );
}
