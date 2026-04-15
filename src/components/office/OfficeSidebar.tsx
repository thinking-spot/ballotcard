import Link from "next/link";
import { format, formatDistanceToNow, isFuture } from "date-fns";
import { TagPill } from "@/components/ui/TagPill";

interface OfficeSidebarProps {
  watcherCount: number;
  nextRealElectionAt?: string;
  issueTags: { id: string; label: string }[];
  relatedOffices: { id: string; title: string; slug: string; geoSlug: string }[];
}

function SidebarSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-bc-light-lavender bg-white p-4">
      <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground mb-3">
        {title}
      </p>
      {children}
    </div>
  );
}

export function OfficeSidebar({
  watcherCount,
  nextRealElectionAt,
  issueTags,
  relatedOffices,
}: OfficeSidebarProps) {
  const nextElectionFuture =
    nextRealElectionAt && isFuture(new Date(nextRealElectionAt));

  return (
    <aside className="flex flex-col gap-3 w-full">
      {/* Watchers */}
      <SidebarSection title="Watching">
        <p className="font-serif text-2xl text-bc-navy font-bold">
          {watcherCount.toLocaleString()}
        </p>
      </SidebarSection>

      {/* Upcoming */}
      {nextElectionFuture && (
        <SidebarSection title="Upcoming">
          <div className="flex flex-col gap-2 text-sm">
            <div>
              <p className="text-bc-navy font-medium">Real election</p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(nextRealElectionAt!), "MMM d, yyyy")}
                {" · "}
                {formatDistanceToNow(new Date(nextRealElectionAt!))}
              </p>
            </div>
          </div>
        </SidebarSection>
      )}

      {/* Related offices */}
      {relatedOffices.length > 0 && (
        <SidebarSection title="Related offices">
          <ul className="flex flex-col gap-1.5 text-sm">
            {relatedOffices.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/${o.geoSlug}`}
                  className="text-bc-navy hover:underline underline-offset-2"
                >
                  {o.title}
                </Link>
              </li>
            ))}
          </ul>
        </SidebarSection>
      )}

      {/* Issue tags */}
      {issueTags.length > 0 && (
        <SidebarSection title="Issue tags">
          <div className="flex flex-wrap gap-1.5">
            {issueTags.map((tag) => (
              <TagPill key={tag.id} label={tag.label} />
            ))}
          </div>
        </SidebarSection>
      )}
    </aside>
  );
}
