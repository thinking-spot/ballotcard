import Link from "next/link";
import type { RelatedOffice } from "@/lib/office-data";

interface OfficeSidebarProps {
  office: {
    branch: string;
    level: string;
    selectionMethod: string;
    termYears?: number;
  };
  relatedOffices: RelatedOffice[];
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

const BRANCH_LABELS: Record<string, string> = {
  executive: "Executive",
  legislative: "Legislative",
  judicial: "Judicial",
  law_enforcement: "Law enforcement",
  other: "Other",
};

const LEVEL_LABELS: Record<string, string> = {
  federal: "Federal",
  state: "State",
  county: "County",
  municipal: "Municipal",
  special: "Special",
};

const SELECTION_LABELS: Record<string, string> = {
  elected_partisan: "Elected (partisan)",
  elected_nonpartisan: "Elected (nonpartisan)",
  retention: "Retention election",
  appointed: "Appointed",
};

export function OfficeSidebar({ office, relatedOffices }: OfficeSidebarProps) {
  return (
    <aside className="flex flex-col gap-3 w-full">
      <SidebarSection title="About this seat">
        <dl className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Branch</dt>
            <dd className="text-bc-navy text-right">
              {BRANCH_LABELS[office.branch] ?? office.branch}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Level</dt>
            <dd className="text-bc-navy text-right">
              {LEVEL_LABELS[office.level] ?? office.level}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Selection</dt>
            <dd className="text-bc-navy text-right">
              {SELECTION_LABELS[office.selectionMethod] ?? office.selectionMethod}
            </dd>
          </div>
          {office.termYears ? (
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Term</dt>
              <dd className="text-bc-navy text-right">
                {office.termYears} years
              </dd>
            </div>
          ) : null}
        </dl>
      </SidebarSection>

      {relatedOffices.length > 0 && (
        <SidebarSection title="Other offices here">
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
    </aside>
  );
}
