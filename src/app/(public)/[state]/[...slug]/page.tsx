import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { auth } from "@/auth";
import { resolveSlug } from "@/lib/slug-resolver";
import { getOfficePageData, getThreadData } from "@/lib/office-data";
import type { ThreadReply } from "@/lib/office-data";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { WitnessBadge } from "@/components/ui/WitnessBadge";
import { TagPill } from "@/components/ui/TagPill";
import { FeaturedLinkCard } from "@/components/office/FeaturedLinkCard";
import { OfficeholderCard } from "@/components/office/OfficeholderCard";
import { WitnessCard } from "@/components/office/WitnessCard";
import { WitnessVacancyCard } from "@/components/office/WitnessVacancyCard";
import { OfficeActivityFeed } from "@/components/office/OfficeActivityFeed";
import { OfficeSidebar } from "@/components/office/OfficeSidebar";
import { WatchButton } from "@/components/office/WatchButton";
import { PostComposer } from "@/components/office/PostComposer";
import { PostActions } from "@/components/office/PostActions";
import { ReplyComposer } from "@/components/office/ReplyComposer";

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

/**
 * Detect /post/{uuid} suffix on the slug array.
 * Returns { baseSlug, postId } if matched, or null.
 */
function extractPostSlug(
  slug: string[]
): { baseSlug: string[]; postId: string } | null {
  if (
    slug.length >= 3 &&
    slug[slug.length - 2] === "post" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      slug[slug.length - 1]
    )
  ) {
    return {
      baseSlug: slug.slice(0, -2),
      postId: slug[slug.length - 1],
    };
  }
  return null;
}

// ─── Reply tree renderer ──────────────────────────────────────────────────

function ReplyNode({
  reply,
  depth,
  userId,
}: {
  reply: ThreadReply;
  depth: number;
  userId?: string;
}) {
  const isDeleted = !!reply.deletedAt;
  const isOwner = !!userId && reply.authorId === userId;
  const timeAgo = formatDistanceToNow(new Date(reply.createdAt), {
    addSuffix: true,
  });

  return (
    <div
      className={depth > 0 ? "ml-4 sm:ml-6 border-l-2 border-bc-light-lavender pl-4" : ""}
    >
      <div className="py-3">
        {isDeleted ? (
          <p className="text-sm text-muted-foreground italic">
            [deleted]
          </p>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-1">
              {reply.isWitnessPost && <WitnessBadge />}
              <p className="text-xs text-muted-foreground">
                {reply.authorUsername && (
                  <Link
                    href={`/u/${reply.authorUsername}`}
                    className="text-bc-navy hover:underline"
                  >
                    @{reply.authorUsername}
                  </Link>
                )}{" "}
                · {timeAgo}
                {reply.revisionCount > 0 && (
                  <span className="text-muted-foreground">
                    {" "}
                    · edited ({reply.revisionCount}{" "}
                    {reply.revisionCount === 1 ? "revision" : "revisions"})
                  </span>
                )}
              </p>
            </div>
            <p className="text-sm text-bc-navy/80 leading-relaxed whitespace-pre-line">
              {reply.body}
            </p>
            {userId && (
              <PostActions
                postId={reply.id}
                isOwner={isOwner}
                isTopLevel={false}
                body={reply.body}
              />
            )}
          </>
        )}
      </div>

      {/* Nested replies */}
      {reply.replies.length > 0 && (
        <div>
          {reply.replies.map((child) => (
            <ReplyNode
              key={child.id}
              reply={child}
              depth={depth + 1}
              userId={userId}
            />
          ))}
        </div>
      )}
    </div>
  );
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

  // Handle /post/{id} metadata
  const postSlug = extractPostSlug(slug);
  if (postSlug) {
    const threadData = await getThreadData(postSlug.postId);
    if (!threadData) return {};
    const postTitle = threadData.post.title ?? "Thread";
    return {
      title: `${postTitle} — ${threadData.office.title} — BallotCard`,
    };
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

  // ─── Thread view ─────────────────────────────────────────────────────
  const postSlug = extractPostSlug(slug);
  if (postSlug) {
    const [threadData, session] = await Promise.all([
      getThreadData(postSlug.postId),
      auth(),
    ]);
    if (!threadData) notFound();

    const officeHref = `/${threadData.district.geoSlug}/${threadData.office.slug}`;
    const post = threadData.post;
    const isDeleted = !!post.deletedAt;
    const isOwner = !!session && post.authorId === session.user.id;

    const timeAgo = formatDistanceToNow(new Date(post.createdAt), {
      addSuffix: true,
    });

    const issueTags = post.tags.filter((t) => t.kind === "issue");

    return (
      <div className="min-h-screen bg-bc-light-lavender/30">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
          <Breadcrumb items={threadData.breadcrumbs} />

          {/* Root post — full view */}
          <article className="mt-4 rounded-lg border border-bc-light-lavender bg-white p-4 sm:p-6">
            {isDeleted ? (
              <p className="text-sm text-muted-foreground italic">
                [This post has been deleted]
              </p>
            ) : (
              <>
                <div className="flex items-start gap-2 mb-2">
                  {post.isWitnessPost && <WitnessBadge />}
                  {post.isPinned && (
                    <span className="text-[10px] font-semibold tracking-wider uppercase text-muted-foreground border border-bc-light-lavender px-1.5 py-0.5 rounded">
                      Pinned
                    </span>
                  )}
                </div>

                {post.title && (
                  <h1 className="font-serif text-xl sm:text-2xl font-bold text-bc-navy leading-snug mb-2">
                    {post.title}
                  </h1>
                )}

                <p className="text-xs text-muted-foreground mb-4">
                  {post.authorUsername && (
                    <Link
                      href={`/u/${post.authorUsername}`}
                      className="text-bc-navy hover:underline"
                    >
                      @{post.authorUsername}
                    </Link>
                  )}{" "}
                  · {timeAgo}
                  {post.revisionCount > 0 && (
                    <span>
                      {" "}
                      · edited ({post.revisionCount}{" "}
                      {post.revisionCount === 1 ? "revision" : "revisions"})
                    </span>
                  )}
                  {" · "}
                  <Link
                    href={officeHref}
                    className="hover:underline"
                  >
                    {threadData.office.title}
                  </Link>
                </p>

                {post.featuredLink && (
                  <div className="mb-4">
                    <FeaturedLinkCard link={post.featuredLink} />
                  </div>
                )}

                <div className="text-sm text-bc-navy/90 leading-relaxed whitespace-pre-line">
                  {post.body}
                </div>

                {issueTags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-4">
                    {issueTags.map((tag) => (
                      <TagPill key={tag.id} label={tag.label} />
                    ))}
                  </div>
                )}

                {session && (
                  <PostActions
                    postId={post.id}
                    isOwner={isOwner}
                    isTopLevel={true}
                    title={post.title}
                    body={post.body}
                  />
                )}
              </>
            )}
          </article>

          {/* Replies section */}
          <div className="mt-4 rounded-lg border border-bc-light-lavender bg-white">
            <div className="px-4 pt-4 pb-2 border-b border-bc-light-lavender">
              <h2 className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
                {threadData.replies.length === 0
                  ? "No replies yet"
                  : `${threadData.replies.length} ${threadData.replies.length === 1 ? "reply" : "replies"}`}
              </h2>
            </div>

            {threadData.replies.length > 0 && (
              <div className="px-4 divide-y divide-bc-light-lavender">
                {threadData.replies.map((reply) => (
                  <ReplyNode
                    key={reply.id}
                    reply={reply}
                    depth={0}
                    userId={session?.user.id}
                  />
                ))}
              </div>
            )}

            {/* Reply composer at the bottom */}
            {session && !isDeleted && (
              <div className="px-4 py-4 border-t border-bc-light-lavender">
                <ReplyComposer parentPostId={post.id} />
              </div>
            )}

            {!session && (
              <div className="px-4 py-4 border-t border-bc-light-lavender">
                <p className="text-sm text-muted-foreground">
                  <Link href="/login" className="text-bc-navy hover:underline">
                    Log in
                  </Link>{" "}
                  to reply.
                </p>
              </div>
            )}
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
