import { notFound } from "next/navigation";
import Link from "next/link";
import { resolveSlug } from "@/lib/slug-resolver";
import { getOfficePageData } from "@/lib/office-data";
import { getDistrictPageData } from "@/lib/district-data";
import type { DistrictPageData, DistrictOffice } from "@/lib/district-data";
import { LAYER_ORDER, LAYER_LABELS } from "@/lib/district-data";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { OfficeholderCard } from "@/components/office/OfficeholderCard";
import { OfficeSidebar } from "@/components/office/OfficeSidebar";
import { OfficeActivity } from "@/components/office/OfficeActivity";
import { NextElection } from "@/components/office/NextElection";

type Params = { state: string; slug?: string[] };

// District & office permalinks are permanent and change only on ingestion.
// Serve them as ISR — generated on first request, then cached and revalidated
// in the background (CLAUDE.md: "office/official pages are static, revalidated
// on ingestion"). Six hours is a safe cadence between ingestion runs.
export const revalidate = 21600;

// Returning [] (with dynamicParams default true) prerenders nothing at build —
// avoiding a 15k-page build and DB access — but opts the route into the Full
// Route Cache, so each permalink is cached after its first render instead of
// re-querying Supabase on every visit and every crawler hit.
export async function generateStaticParams(): Promise<
  { state: string; slug?: string[] }[]
> {
  return [];
}

// ─── Metadata ─────────────────────────────────────────────────────────────────
// SEO templates: every per-page title sets the lead; the root layout's template
// appends " | Find Your Ballot". State and district pages take the "Sample
// Ballots & Election Info" lead; office pages take the "Ballot & Election Info"
// lead.

function formatElectionDate(d?: string): string | null {
  if (!d) return null;
  // Date-only string → render at local noon to avoid UTC drift.
  const date = new Date(d + "T12:00:00");
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}) {
  const { state, slug } = await params;

  // District view (state root /nc, sub-district /nc/07, /nc/sldu-8, etc.)
  if (!slug || slug.length === 0) {
    const data = await getDistrictPageData(state);
    if (!data) return {};
    const name = data.district.name;
    const code = (data.district.state || state).toUpperCase();
    return {
      title: `${name} Sample Ballots & Election Info`,
      description: `Stay up to date on your representatives and your elections in ${name}. Create an online version of your local ${code} ballot in seconds.`,
    };
  }

  const resolved = await resolveSlug(state, slug);
  if (!resolved) return {};

  if (resolved.kind === "district") {
    const data = await getDistrictPageData(resolved.geoSlug);
    if (!data) return {};
    const name = data.district.name;
    const code = (data.district.state || state).toUpperCase();
    return {
      title: `${name} Sample Ballots & Election Info`,
      description: `Stay up to date on your representatives and your elections in ${name}. Create an online version of your local ${code} ballot in seconds.`,
    };
  }

  const data = await getOfficePageData(
    resolved.districtGeoSlug,
    resolved.officeSlug
  );
  if (!data) return {};

  const officeTitle = data.office.title;
  const heldBy = data.official?.name
    ? `, currently held by ${data.official.name}`
    : "";

  // Election-date copy honors staggered chambers (rendered as a year range
  // rather than a false-precise single date).
  let electionCopy = "";
  if (data.office.nextElectionAt) {
    if (data.office.nextElectionEstimated) {
      const y = new Date(data.office.nextElectionAt + "T12:00:00").getFullYear();
      electionCopy = ` Next election ${y} or ${y + 2}.`;
    } else {
      const formatted = formatElectionDate(data.office.nextElectionAt);
      if (formatted) electionCopy = ` Next election ${formatted}.`;
    }
  }

  return {
    title: `${officeTitle} Ballot & Election Info`,
    description: `Stay up to date on your representatives and your elections for ${officeTitle}${heldBy}.${electionCopy}`.trim(),
  };
}

// ─── Labels ───────────────────────────────────────────────────────────────────

function kindLabel(kind: string): string {
  switch (kind) {
    case "country": return "Country";
    case "state": return "State";
    case "us_house": return "Congressional district";
    case "us_senate_state": return "U.S. Senate seat";
    case "governor_state": return "Governor";
    case "state_house": return "State house district";
    case "state_senate": return "State senate district";
    case "county": return "County";
    case "municipality": return "Municipality";
    case "school_board": return "School board";
    case "judicial": return "Judicial district";
    default: return "District";
  }
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

// ─── District page view ─────────────────────────────────────────────────────

function DistrictOfficeRow({ office }: { office: DistrictOffice }) {
  const href = `/${office.districtGeoSlug}/${office.slug}`;
  const party = partyAbbrev(office.officialParty);
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-4 px-4 py-2.5 border-b border-bc-light-lavender last:border-b-0 hover:bg-bc-light-lavender/30 transition-colors"
    >
      <span className="text-sm font-medium text-bc-navy min-w-0 truncate">
        {office.title}
      </span>
      <span className="text-sm text-muted-foreground flex-shrink-0 text-right">
        {office.officialName ? (
          <>
            {office.officialName}
            {party && (
              <span className="ml-1 text-muted-foreground/70">({party})</span>
            )}
          </>
        ) : (
          <span className="text-muted-foreground/60 italic">data coming</span>
        )}
      </span>
    </Link>
  );
}

function DistrictPageView({ data }: { data: DistrictPageData }) {
  const hasOffices = data.offices.length > 0;
  const hasChildren = data.childDistricts.length > 0;

  // Group offices by ballot layer (federal → state → …)
  const byLayer = new Map<string, DistrictOffice[]>();
  for (const office of data.offices) {
    const layer = office.level ?? "special";
    if (!byLayer.has(layer)) byLayer.set(layer, []);
    byLayer.get(layer)!.push(office);
  }
  const orderedLayers = LAYER_ORDER.filter((l) => byLayer.has(l));

  return (
    <div className="min-h-screen bg-bc-light-lavender/30">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <Breadcrumb items={data.breadcrumbs} />

        <div className="mt-4 mb-6">
          <h1 className="font-serif text-2xl sm:text-3xl text-bc-navy font-bold leading-tight">
            {data.district.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {kindLabel(data.district.kind)}
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1 min-w-0 flex flex-col gap-6">
            {/* Offices grouped by ballot layer */}
            {hasOffices &&
              orderedLayers.map((layer) => (
                <section key={layer}>
                  <h2 className="font-serif text-lg text-bc-navy font-semibold mb-3">
                    {LAYER_LABELS[layer] ?? layer}
                  </h2>
                  <div className="rounded-lg border border-bc-light-lavender bg-white overflow-hidden">
                    {byLayer.get(layer)!.map((office) => (
                      <DistrictOfficeRow key={office.id} office={office} />
                    ))}
                  </div>
                </section>
              ))}

            {/* Child districts */}
            {hasChildren && (
              <section>
                <h2 className="font-serif text-lg text-bc-navy font-semibold mb-3">
                  {data.district.kind === "state"
                    ? "Districts & counties"
                    : data.district.kind === "county"
                      ? "Municipalities"
                      : "Sub-districts"}
                </h2>
                <div className="rounded-lg border border-bc-light-lavender bg-white overflow-hidden">
                  {data.childDistricts.map((child) => (
                    <Link
                      key={child.id}
                      href={`/${child.geoSlug}`}
                      className="flex items-center justify-between gap-4 px-4 py-2.5 border-b border-bc-light-lavender last:border-b-0 hover:bg-bc-light-lavender/30 transition-colors"
                    >
                      <span className="text-sm font-medium text-bc-navy">
                        {child.name}
                        <span className="ml-2 text-xs text-muted-foreground font-normal">
                          {kindLabel(child.kind)}
                        </span>
                      </span>
                      {child.officeCount > 0 && (
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          {child.officeCount}{" "}
                          {child.officeCount === 1 ? "office" : "offices"}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {!hasOffices && !hasChildren && (
              <div className="rounded-lg border border-bc-light-lavender bg-white p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  No offices on record for this district yet.
                </p>
              </div>
            )}
          </div>

          {/* Navigation sidebar */}
          <div className="lg:w-64 xl:w-72 flex-shrink-0">
            <div className="rounded-lg border border-bc-light-lavender bg-white p-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Navigate
              </h3>
              <div className="flex flex-col gap-1.5">
                {data.parentDistrict && (
                  <Link
                    href={`/${data.parentDistrict.geoSlug}`}
                    className="text-sm text-bc-navy hover:underline flex items-center gap-1.5"
                  >
                    <span className="text-muted-foreground">&larr;</span>
                    {data.parentDistrict.name}
                  </Link>
                )}
                <span className="text-sm font-medium text-bc-navy pl-4">
                  {data.district.name}
                </span>
                {data.childDistricts.slice(0, 10).map((child) => (
                  <Link
                    key={child.id}
                    href={`/${child.geoSlug}`}
                    className="text-sm text-bc-navy hover:underline pl-8 flex items-center gap-1.5"
                  >
                    <span className="text-muted-foreground">&rarr;</span>
                    {child.name}
                  </Link>
                ))}
                {data.childDistricts.length > 10 && (
                  <span className="text-xs text-muted-foreground pl-8">
                    +{data.childDistricts.length - 10} more
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function CatchallPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { state, slug } = await params;

  // State-level district route (e.g. /nc with no slug)
  if (!slug || slug.length === 0) {
    const districtData = await getDistrictPageData(state);
    if (!districtData) notFound();
    return <DistrictPageView data={districtData} />;
  }

  const resolved = await resolveSlug(state, slug);
  if (!resolved) notFound();

  if (resolved.kind === "district") {
    const districtData = await getDistrictPageData(resolved.geoSlug);
    if (!districtData) notFound();
    return <DistrictPageView data={districtData} />;
  }

  // Office page
  const data = await getOfficePageData(
    resolved.districtGeoSlug,
    resolved.officeSlug
  );
  if (!data) notFound();

  return (
    <div className="min-h-screen bg-bc-light-lavender/30">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <Breadcrumb items={data.breadcrumbs} />

        <div className="mt-4 mb-6">
          <h1 className="font-serif text-2xl sm:text-3xl text-bc-navy font-bold leading-tight">
            {data.office.title}
          </h1>
          {data.office.description && (
            <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
              {data.office.description}
            </p>
          )}
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1 min-w-0 flex flex-col gap-3">
            {data.official ? (
              <OfficeholderCard
                official={data.official}
                nextElectionAt={data.office.nextElectionAt}
                nextElectionEstimated={data.office.nextElectionEstimated}
              />
            ) : (
              <div className="rounded-lg border border-bc-light-lavender bg-white p-4 text-sm text-muted-foreground">
                No current officeholder on record for this seat yet.
              </div>
            )}

            {/* Next election — date, who's running, where to verify/register */}
            <NextElection
              office={data.office}
              official={data.official}
              candidates={data.candidates}
              state={data.district.state}
            />

            {/* Activity — articleOne-ready section (see src/lib/feed) */}
            {data.official && (
              <OfficeActivity official={data.official} />
            )}
          </div>

          <div className="lg:w-64 xl:w-72 flex-shrink-0">
            <OfficeSidebar
              office={data.office}
              relatedOffices={data.relatedOffices}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
