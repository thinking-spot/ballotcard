import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow, format } from "date-fns";
import { auth } from "@/auth";
import { resolveSlug } from "@/lib/slug-resolver";
import { getOfficePageData, getThreadData } from "@/lib/office-data";
import { getElectionPageData } from "@/lib/election-data";
import type { ThreadReply, ModDeletion } from "@/lib/office-data";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { WitnessBadge } from "@/components/ui/WitnessBadge";
import { TagPill } from "@/components/ui/TagPill";
import { StatusPill } from "@/components/ui/StatusPill";
import { FeaturedLinkCard } from "@/components/office/FeaturedLinkCard";
import { OfficeholderCard } from "@/components/office/OfficeholderCard";
import { WitnessCard } from "@/components/office/WitnessCard";
import { WitnessVacancyCard } from "@/components/office/WitnessVacancyCard";
import { OfficeActivityFeed } from "@/components/office/OfficeActivityFeed";
import { OfficeSidebar } from "@/components/office/OfficeSidebar";
import { WatchButton } from "@/components/office/WatchButton";
import { ModLog } from "@/components/office/ModLog";
import { PostComposer } from "@/components/office/PostComposer";
import { PostActions } from "@/components/office/PostActions";
import { ReplyComposer } from "@/components/office/ReplyComposer";
import { CandidacyForm } from "@/components/election/CandidacyForm";
import { VoteButton } from "@/components/election/VoteButton";
import { WithdrawButton } from "@/components/election/WithdrawButton";
import { ResolveButton } from "@/components/election/ResolveButton";

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

// ─── Timeline row for election page ──────────────────────────────────────

function TimelineRow({
  label,
  date,
  isActive,
  isPast,
}: {
  label: string;
  date: Date;
  isActive: boolean;
  isPast: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={`w-2 h-2 rounded-full flex-shrink-0 ${
          isActive
            ? "bg-blue-500"
            : isPast
              ? "bg-emerald-500"
              : "bg-gray-300"
        }`}
      />
      <span
        className={`flex-1 ${isActive ? "text-bc-navy font-medium" : "text-muted-foreground"}`}
      >
        {label}
      </span>
      <span className="text-xs text-muted-foreground flex-shrink-0">
        {format(date, "MMM d, yyyy")}
      </span>
    </div>
  );
}

/**
 * Detect /election suffix on the slug array.
 * Returns the base slug (without election) if matched, or null.
 */
function extractElectionSlug(slug: string[]): string[] | null {
  if (slug.length >= 2 && slug[slug.length - 1] === "election") {
    return slug.slice(0, -1);
  }
  return null;
}

// ─── Reply tree renderer ──────────────────────────────────────────────────

function ReplyNode({
  reply,
  depth,
  userId,
  isWitness,
}: {
  reply: ThreadReply;
  depth: number;
  userId?: string;
  isWitness?: boolean;
}) {
  const isDeleted = !!reply.deletedAt;
  const isModDeleted = isDeleted && !!reply.modDeletion;
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
          <div>
            {isModDeleted ? (
              <div className="rounded border border-amber-200 bg-amber-50/50 px-3 py-2">
                <p className="text-sm text-amber-800 italic">
                  [Removed by Witness @{reply.modDeletion!.actorUsername}]
                </p>
                <p className="text-xs text-amber-600 mt-0.5">
                  Reason: {reply.modDeletion!.reason}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                [deleted]
              </p>
            )}
            {/* Witness can restore deleted replies */}
            {isWitness && userId && (
              <PostActions
                postId={reply.id}
                isOwner={false}
                isTopLevel={false}
                body=""
                isWitness
                isDeleted
              />
            )}
          </div>
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
                isWitness={isWitness}
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
              isWitness={isWitness}
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

  // Handle /election metadata
  const electionBaseSlug = extractElectionSlug(slug);
  if (electionBaseSlug) {
    const resolved = await resolveSlug(state, electionBaseSlug);
    if (!resolved || resolved.kind !== "office") return {};
    const electionData = await getElectionPageData(
      resolved.districtGeoSlug,
      resolved.officeSlug
    );
    if (!electionData) return {};
    return {
      title: `Witness election — ${electionData.office.title} — BallotCard`,
    };
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

  // ─── Election page ───────────────────────────────────────────────────
  const electionSlug = extractElectionSlug(slug);
  if (electionSlug) {
    const resolved = await resolveSlug(state, electionSlug);
    if (!resolved || resolved.kind !== "office") notFound();

    const data = await getElectionPageData(
      resolved.districtGeoSlug,
      resolved.officeSlug
    );
    if (!data) notFound();

    const session = await auth();
    const isLoggedIn = !!session;
    const officeHref = `/${data.district.geoSlug}/${data.office.slug}`;

    const filingOpens = new Date(data.election.filingOpensAt);
    const votingOpens = new Date(data.election.votingOpensAt);
    const votingCloses = new Date(data.election.votingClosesAt);
    const termStart = new Date(data.election.termStart + "T00:00:00");
    const termEnd = new Date(data.election.termEnd + "T00:00:00");

    const activeCandidates = data.candidates.filter((c) => !c.isWithdrawn);
    const withdrawnCandidates = data.candidates.filter((c) => c.isWithdrawn);

    const canFile =
      isLoggedIn &&
      data.isResidentOfDistrict &&
      !data.userCandidacyId &&
      data.phase !== "closed";

    const canVote =
      isLoggedIn &&
      data.isResidentOfDistrict &&
      data.phase === "voting";

    return (
      <div className="min-h-screen bg-bc-light-lavender/30">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
          <Breadcrumb items={data.breadcrumbs} />

          {/* Header */}
          <div className="mt-4 mb-6">
            <div className="flex items-center gap-2 mb-2">
              <StatusPill
                variant="election"
                label={
                  data.phase === "filing"
                    ? "Filing open"
                    : data.phase === "voting"
                      ? "Voting open"
                      : "Election closed"
                }
              />
            </div>
            <h1 className="font-serif text-xl sm:text-2xl text-bc-navy font-bold">
              Witness election
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              <Link href={officeHref} className="hover:underline">
                {data.office.title}
              </Link>
              {" · "}
              Term {format(termStart, "MMM yyyy")} – {format(termEnd, "MMM yyyy")}
            </p>
          </div>

          {/* Timeline */}
          <div className="rounded-lg border border-bc-light-lavender bg-white p-4 mb-4">
            <h2 className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground mb-3">
              Timeline
            </h2>
            <div className="flex flex-col gap-2 text-sm">
              <TimelineRow
                label="Filing opens"
                date={filingOpens}
                isActive={data.phase === "filing"}
                isPast={data.phase !== "filing"}
              />
              <TimelineRow
                label="Voting opens"
                date={votingOpens}
                isActive={data.phase === "voting"}
                isPast={data.phase === "closed"}
              />
              <TimelineRow
                label="Voting closes"
                date={votingCloses}
                isActive={false}
                isPast={data.phase === "closed"}
              />
            </div>
            <div className="mt-3 pt-3 border-t border-bc-light-lavender text-xs text-muted-foreground">
              Quorum: {data.election.quorum} vote{data.election.quorum !== 1 ? "s" : ""} needed to seat a Witness
              {data.totalVotes > 0 && (
                <> · {data.totalVotes} vote{data.totalVotes !== 1 ? "s" : ""} cast so far</>
              )}
            </div>
          </div>

          {/* Current Witness */}
          {data.currentWitnessUsername && (
            <div className="rounded-lg border border-bc-light-lavender bg-white p-4 mb-4">
              <p className="text-xs text-muted-foreground">
                Current Witness:{" "}
                <Link
                  href={`/u/${data.currentWitnessUsername}`}
                  className="text-bc-navy hover:underline"
                >
                  @{data.currentWitnessUsername}
                </Link>
              </p>
            </div>
          )}

          {/* Candidates */}
          <div className="rounded-lg border border-bc-light-lavender bg-white mb-4">
            <div className="px-4 pt-4 pb-2 border-b border-bc-light-lavender">
              <h2 className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
                {activeCandidates.length === 0
                  ? "No candidates yet"
                  : `${activeCandidates.length} candidate${activeCandidates.length !== 1 ? "s" : ""}`}
              </h2>
            </div>

            {activeCandidates.length > 0 && (
              <div className="divide-y divide-bc-light-lavender">
                {activeCandidates.map((candidate) => (
                  <div key={candidate.candidacyId} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Link
                            href={`/u/${candidate.username}`}
                            className="text-sm font-medium text-bc-navy hover:underline"
                          >
                            @{candidate.username}
                          </Link>
                          {(data.phase === "voting" || data.phase === "closed") && (
                            <span className="text-xs text-muted-foreground">
                              {candidate.voteCount} vote{candidate.voteCount !== 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-bc-navy/80 leading-relaxed">
                          {candidate.statementShort}
                        </p>
                        {candidate.statementLong && (
                          <details className="mt-2">
                            <summary className="text-xs text-muted-foreground cursor-pointer hover:underline">
                              Read full statement
                            </summary>
                            <p className="mt-2 text-sm text-bc-navy/70 leading-relaxed whitespace-pre-line">
                              {candidate.statementLong}
                            </p>
                          </details>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          Filed {formatDistanceToNow(new Date(candidate.filedAt), { addSuffix: true })}
                        </p>
                        {/* Withdraw button for own candidacy */}
                        {data.userCandidacyId === candidate.candidacyId && data.phase !== "closed" && (
                          <div className="mt-2">
                            <WithdrawButton candidacyId={candidate.candidacyId} />
                          </div>
                        )}
                      </div>

                      {/* Vote button */}
                      {data.phase === "voting" && (
                        <VoteButton
                          electionId={data.election.id}
                          candidacyId={candidate.candidacyId}
                          isCurrentVote={data.userVotedCandidacyId === candidate.candidacyId}
                          isLoggedIn={isLoggedIn}
                          canVote={canVote}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeCandidates.length === 0 && (
              <div className="px-4 py-6 text-center">
                <p className="text-sm text-muted-foreground">
                  No one has filed yet. Be the first to run for Witness.
                </p>
              </div>
            )}
          </div>

          {/* Withdrawn candidates */}
          {withdrawnCandidates.length > 0 && (
            <details className="rounded-lg border border-bc-light-lavender bg-white mb-4">
              <summary className="px-4 py-3 text-xs text-muted-foreground cursor-pointer hover:bg-bc-light-lavender/30">
                {withdrawnCandidates.length} withdrawn candidate{withdrawnCandidates.length !== 1 ? "s" : ""}
              </summary>
              <div className="divide-y divide-bc-light-lavender border-t border-bc-light-lavender">
                {withdrawnCandidates.map((candidate) => (
                  <div key={candidate.candidacyId} className="px-4 py-3 opacity-60">
                    <p className="text-sm text-muted-foreground">
                      @{candidate.username} — withdrawn
                    </p>
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* File candidacy form */}
          {canFile && (
            <div className="mb-4">
              <CandidacyForm electionId={data.election.id} />
            </div>
          )}

          {/* Login / residency prompt */}
          {!isLoggedIn && data.phase !== "closed" && (
            <div className="rounded-lg border border-bc-light-lavender bg-white p-4 mb-4">
              <p className="text-sm text-muted-foreground">
                <Link href="/login" className="text-bc-navy hover:underline">
                  Log in
                </Link>{" "}
                to file a candidacy or vote.
              </p>
            </div>
          )}

          {isLoggedIn && !data.isResidentOfDistrict && data.phase !== "closed" && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 mb-4">
              <p className="text-sm text-amber-800">
                Your home district does not cover this office. Only residents of
                this district can file or vote.
              </p>
            </div>
          )}

          {/* Resolve button (shown when voting is closed and no winner seated) */}
          {data.phase === "closed" && isLoggedIn && (
            <div className="mb-4">
              <ResolveButton electionId={data.election.id} />
            </div>
          )}
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
    const isModDeleted = isDeleted && !!post.modDeletion;
    const isOwner = !!session && post.authorId === session.user.id;
    const isWitness = threadData.isWitnessForOffice;

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
              <div>
                {isModDeleted ? (
                  <div className="rounded border border-amber-200 bg-amber-50/50 px-4 py-3">
                    <p className="text-sm text-amber-800 italic">
                      [This post was removed by Witness @{post.modDeletion!.actorUsername}]
                    </p>
                    <p className="text-xs text-amber-600 mt-1">
                      Reason: {post.modDeletion!.reason}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    [This post has been deleted]
                  </p>
                )}
                {isWitness && session && (
                  <PostActions
                    postId={post.id}
                    isOwner={false}
                    isTopLevel={true}
                    body=""
                    isWitness
                    isDeleted
                  />
                )}
              </div>
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
                    isWitness={isWitness}
                    isPinned={post.isPinned}
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
                    isWitness={isWitness}
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

            {/* Moderation log */}
            <ModLog actions={data.modActions} officeHref={officeHref} />
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
