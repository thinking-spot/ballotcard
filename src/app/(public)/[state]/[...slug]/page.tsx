import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { resolveSlug } from "@/lib/slug-resolver";
import { getOfficePageData } from "@/lib/office-data";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { OfficeholderCard } from "@/components/office/OfficeholderCard";
import { WitnessCard } from "@/components/office/WitnessCard";
import { WitnessVacancyCard } from "@/components/office/WitnessVacancyCard";
import { OfficeActivityFeed } from "@/components/office/OfficeActivityFeed";
import { OfficeSidebar } from "@/components/office/OfficeSidebar";
import { WatchButton } from "@/components/office/WatchButton";
import { PostComposer } from "@/components/office/PostComposer";

type Params = { state: string; slug: string[] };

/**
 * Detect /post/new suffix on the slug array.
 * Returns the base slug (without post/new) if matched, or null.
 */
function extractNewPostSlug(slug: string[]): string[] | null {
  if (
    slug.length >= 3 &&
    slug[slug.length - 2] === "post" &&
    slug[slug.length - 1] === "new"
  ) {
    return slug.slice(0, -2);
  }
  return null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}) {
  const { state, slug } = await params;

  // Handle /post/new metadata
  const baseSlug = extractNewPostSlug(slug);
  if (baseSlug) {
    const resolved = await resolveSlug(state, baseSlug);
    if (!resolved || resolved.kind !== "office") return {};
    const data = await getOfficePageData(
      resolved.districtGeoSlug,
      resolved.officeSlug
    );
    if (!data) return {};
    return { title: `New post — ${data.office.title} — BallotCard` };
  }

  const resolved = await resolveSlug(state, slug);
  if (!resolved || resolved.kind !== "office") return {};

  const data = await getOfficePageData(
    resolved.districtGeoSlug,
    resolved.officeSlug
  );
  if (!data) return {};

  return {
    title: `${data.office.title} — BallotCard`,
    description: data.office.description,
  };
}

export default async function CatchallPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { state, slug } = await params;

  // ─── New post page ───────────────────────────────────────────────────
  const baseSlug = extractNewPostSlug(slug);
  if (baseSlug) {
    const session = await auth();
    if (!session) {
      redirect(`/login?next=/${state}/${slug.join("/")}`);
    }

    const resolved = await resolveSlug(state, baseSlug);
    if (!resolved || resolved.kind !== "office") notFound();

    const data = await getOfficePageData(
      resolved.districtGeoSlug,
      resolved.officeSlug
    );
    if (!data) notFound();

    const officeHref = `/${resolved.districtGeoSlug}/${resolved.officeSlug}`;
    const breadcrumbs = [...data.breadcrumbs, { label: "New post", href: "" }];

    return (
      <div className="min-h-screen bg-bc-light-lavender/30">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
          <Breadcrumb items={breadcrumbs} />
          <div className="mt-4 mb-6">
            <h1 className="font-serif text-2xl text-bc-navy font-bold">
              New post
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Posting to {data.office.title}
            </p>
          </div>
          <div className="rounded-lg border border-bc-light-lavender bg-white p-4 sm:p-6">
            <PostComposer officeId={data.office.id} officeHref={officeHref} />
          </div>
        </div>
      </div>
    );
  }

  // ─── Standard routing ────────────────────────────────────────────────
  const resolved = await resolveSlug(state, slug);

  if (!resolved) notFound();

  if (resolved.kind === "district") {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
        <p className="text-sm text-muted-foreground">
          District page coming in Phase 7.
        </p>
      </div>
    );
  }

  // Office page
  const [data, session] = await Promise.all([
    getOfficePageData(resolved.districtGeoSlug, resolved.officeSlug),
    auth(),
  ]);
  if (!data) notFound();

  const officeHref = `/${resolved.districtGeoSlug}/${resolved.officeSlug}`;

  return (
    <div className="min-h-screen bg-bc-light-lavender/30">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Breadcrumb */}
        <Breadcrumb items={data.breadcrumbs} />

        {/* Office header */}
        <div className="mt-4 mb-6">
          <h1 className="font-serif text-2xl sm:text-3xl text-bc-navy font-bold leading-tight">
            {data.office.title}
          </h1>
          {data.office.description && (
            <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
              {data.office.description}
            </p>
          )}
          <div className="mt-3">
            <WatchButton
              officeId={data.office.id}
              initialIsWatching={data.isWatching}
              initialCount={data.watcherCount}
              isLoggedIn={!!session}
            />
          </div>
        </div>

        {/* Two-column layout */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Main column */}
          <div className="flex-1 min-w-0 flex flex-col gap-3">
            {/* Officeholder */}
            {data.official ? (
              <OfficeholderCard
                official={data.official}
                nextElectionAt={data.office.nextElectionAt}
              />
            ) : (
              <div className="rounded-lg border border-bc-light-lavender bg-white p-4 text-sm text-muted-foreground">
                No current officeholder on record.
              </div>
            )}

            {/* Witness */}
            {data.witness ? (
              <WitnessCard witness={data.witness} />
            ) : (
              <WitnessVacancyCard officeHref={officeHref} />
            )}

            {/* Activity feed */}
            <OfficeActivityFeed
              posts={data.posts}
              officeHref={officeHref}
              showNewPostLink={!!session}
            />
          </div>

          {/* Sidebar */}
          <div className="lg:w-64 xl:w-72 flex-shrink-0">
            <OfficeSidebar
              watcherCount={data.watcherCount}
              nextRealElectionAt={data.office.nextElectionAt}
              issueTags={data.issueTags}
              relatedOffices={data.relatedOffices}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
