import { notFound } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow, format } from "date-fns";
import { auth } from "@/auth";
import { getProfilePageData } from "@/lib/profile-data";
import { WitnessBadge } from "@/components/ui/WitnessBadge";

type Params = { username: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}) {
  const { username } = await params;
  const data = await getProfilePageData(username);
  if (!data) return {};
  return {
    title: `@${data.user.username} — BallotCard`,
  };
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { username } = await params;
  const data = await getProfilePageData(username);
  if (!data) notFound();

  const session = await auth();
  const isOwnProfile = session?.user.id === data.user.id;

  const joinedDate = format(new Date(data.user.createdAt), "MMM yyyy");
  const currentWitnessTerms = data.witnessTerms.filter((t) => t.isCurrent);
  const pastWitnessTerms = data.witnessTerms.filter((t) => !t.isCurrent);

  return (
    <div className="min-h-screen bg-bc-light-lavender/30">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        {/* Profile header */}
        <div className="rounded-lg border border-bc-light-lavender bg-white p-4 sm:p-6 mb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-serif text-xl sm:text-2xl text-bc-navy font-bold">
                @{data.user.username}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Joined {joinedDate}
                {data.user.homeDistrict && (
                  <>
                    {" · "}
                    <Link
                      href={`/${data.user.homeDistrict.geoSlug}`}
                      className="hover:underline"
                    >
                      {data.user.homeDistrict.name}
                    </Link>
                  </>
                )}
              </p>
            </div>
            {isOwnProfile && (
              <Link
                href="/settings"
                className="text-xs text-muted-foreground hover:text-bc-navy border border-bc-light-lavender rounded px-2.5 py-1"
              >
                Settings
              </Link>
            )}
          </div>

          {/* Stats row */}
          <div className="flex gap-6 mt-4 pt-4 border-t border-bc-light-lavender">
            <div>
              <p className="text-lg font-semibold text-bc-navy">
                {data.stats.postCount}
              </p>
              <p className="text-xs text-muted-foreground">
                {data.stats.postCount === 1 ? "post" : "posts"}
              </p>
            </div>
            <div>
              <p className="text-lg font-semibold text-bc-navy">
                {data.stats.witnessTermCount}
              </p>
              <p className="text-xs text-muted-foreground">
                {data.stats.witnessTermCount === 1
                  ? "Witness term"
                  : "Witness terms"}
              </p>
            </div>
            <div>
              <p className="text-lg font-semibold text-bc-navy">
                {data.stats.officesWatched}
              </p>
              <p className="text-xs text-muted-foreground">
                {data.stats.officesWatched === 1
                  ? "office watched"
                  : "offices watched"}
              </p>
            </div>
          </div>
        </div>

        {/* Current Witness roles */}
        {currentWitnessTerms.length > 0 && (
          <div className="rounded-lg border border-bc-light-lavender bg-white mb-4">
            <div className="px-4 pt-4 pb-2 border-b border-bc-light-lavender">
              <h2 className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
                Current Witness
              </h2>
            </div>
            <div className="divide-y divide-bc-light-lavender">
              {currentWitnessTerms.map((term) => {
                const officeHref = `/${term.office.districtGeoSlug}/${term.office.slug}`;
                return (
                  <div key={term.id} className="px-4 py-3">
                    <div className="flex items-center gap-2 mb-1">
                      <WitnessBadge />
                      <Link
                        href={officeHref}
                        className="text-sm font-medium text-bc-navy hover:underline"
                      >
                        {term.office.title}
                      </Link>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Term {format(new Date(term.termStart + "T00:00:00"), "MMM yyyy")}
                      {" – "}
                      {format(new Date(term.termEnd + "T00:00:00"), "MMM yyyy")}
                    </p>
                    {term.statement && (
                      <p className="text-sm text-bc-navy/70 mt-2 leading-relaxed">
                        {term.statement}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Active candidacies */}
        {data.activeCandidacies.length > 0 && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 mb-4">
            <div className="px-4 pt-4 pb-2 border-b border-blue-200">
              <h2 className="text-[10px] font-semibold tracking-widest uppercase text-blue-600">
                Running for Witness
              </h2>
            </div>
            <div className="divide-y divide-blue-200">
              {data.activeCandidacies.map((c) => {
                const officeHref = `/${c.office.districtGeoSlug}/${c.office.slug}`;
                return (
                  <div key={c.id} className="px-4 py-3">
                    <Link
                      href={`${officeHref}/election`}
                      className="text-sm font-medium text-bc-navy hover:underline"
                    >
                      {c.office.title}
                    </Link>
                    <p className="text-sm text-bc-navy/70 mt-1">
                      {c.statementShort}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Filed{" "}
                      {formatDistanceToNow(new Date(c.filedAt), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Post history */}
        <div className="rounded-lg border border-bc-light-lavender bg-white mb-4">
          <div className="px-4 pt-4 pb-2 border-b border-bc-light-lavender">
            <h2 className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
              {data.posts.length === 0
                ? "No posts yet"
                : "Recent activity"}
            </h2>
          </div>

          {data.posts.length > 0 ? (
            <div className="divide-y divide-bc-light-lavender">
              {data.posts.map((post) => {
                const officeHref = `/${post.office.districtGeoSlug}/${post.office.slug}`;
                const postHref = `${officeHref}/post/${post.id}`;
                const bodyPreview =
                  post.body.length > 280
                    ? post.body.slice(0, 280).trimEnd() + "…"
                    : post.body;
                const timeAgo = formatDistanceToNow(
                  new Date(post.createdAt),
                  { addSuffix: true }
                );

                return (
                  <article key={post.id} className="px-4 py-3">
                    <div className="flex items-start gap-2 mb-1">
                      {post.isWitnessPost && <WitnessBadge />}
                      {post.isPinned && (
                        <span className="text-[10px] font-semibold tracking-wider uppercase text-muted-foreground border border-bc-light-lavender px-1.5 py-0.5 rounded">
                          Pinned
                        </span>
                      )}
                    </div>

                    {post.title && (
                      <Link
                        href={postHref}
                        className="block font-serif text-base font-bold text-bc-navy hover:underline leading-snug mb-1"
                      >
                        {post.title}
                      </Link>
                    )}

                    <p className="text-xs text-muted-foreground mb-2">
                      <Link
                        href={officeHref}
                        className="hover:underline"
                      >
                        {post.office.title}
                      </Link>
                      {" · "}
                      {timeAgo}
                      {post.replyCount > 0 && (
                        <>
                          {" · "}
                          <Link href={postHref} className="hover:underline">
                            {post.replyCount}{" "}
                            {post.replyCount === 1 ? "reply" : "replies"}
                          </Link>
                        </>
                      )}
                    </p>

                    <p className="text-sm text-bc-navy/80 leading-relaxed line-clamp-3">
                      {bodyPreview}
                    </p>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="px-4 py-6 text-center">
              <p className="text-sm text-muted-foreground">
                {isOwnProfile
                  ? "You haven't posted yet. Find an office and start watching."
                  : `@${data.user.username} hasn't posted yet.`}
              </p>
            </div>
          )}
        </div>

        {/* Past Witness terms */}
        {pastWitnessTerms.length > 0 && (
          <div className="rounded-lg border border-bc-light-lavender bg-white mb-4">
            <div className="px-4 pt-4 pb-2 border-b border-bc-light-lavender">
              <h2 className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
                Past Witness terms
              </h2>
            </div>
            <div className="divide-y divide-bc-light-lavender">
              {pastWitnessTerms.map((term) => {
                const officeHref = `/${term.office.districtGeoSlug}/${term.office.slug}`;
                return (
                  <div key={term.id} className="px-4 py-3">
                    <Link
                      href={officeHref}
                      className="text-sm font-medium text-bc-navy hover:underline"
                    >
                      {term.office.title}
                    </Link>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {format(new Date(term.termStart + "T00:00:00"), "MMM yyyy")}
                      {" – "}
                      {format(new Date(term.termEnd + "T00:00:00"), "MMM yyyy")}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Watched offices */}
        {data.watchedOffices.length > 0 && (
          <div className="rounded-lg border border-bc-light-lavender bg-white mb-4">
            <div className="px-4 pt-4 pb-2 border-b border-bc-light-lavender">
              <h2 className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
                Watching {data.watchedOffices.length}{" "}
                {data.watchedOffices.length === 1 ? "office" : "offices"}
              </h2>
            </div>
            <div className="divide-y divide-bc-light-lavender">
              {data.watchedOffices.map((office) => (
                <div key={office.id} className="px-4 py-2.5">
                  <Link
                    href={`/${office.districtGeoSlug}/${office.slug}`}
                    className="text-sm text-bc-navy hover:underline"
                  >
                    {office.title}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
