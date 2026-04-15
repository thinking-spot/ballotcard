import Link from "next/link";
import { auth } from "@/auth";
import { getBallotData } from "@/lib/ballot-data";
import type {
  BallotOffice,
  BallotLayer,
  BallotElectionAlert,
  BallotPostPreview,
} from "@/lib/ballot-data";
import { StatusPill } from "@/components/ui/StatusPill";
import { WitnessBadge } from "@/components/ui/WitnessBadge";
import { BallotWatchButton } from "@/components/ballot/BallotWatchButton";
import { BallotFilterToggle } from "@/components/ballot/BallotFilterToggle";
import { formatDistanceToNow } from "date-fns";

export const metadata = { title: "Your ballot" };

// ─── Election alert banner ─────────────────────────────────────────────────

function ElectionAlert({ alert }: { alert: BallotElectionAlert }) {
  const closesDate = new Date(alert.votingClosesAt);
  const closesFormatted = closesDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-blue-900">
            {alert.officeTitle} · Witness election closes {closesFormatted}
          </p>
          <p className="text-xs text-blue-700 mt-0.5">
            {alert.candidateCount} candidate{alert.candidateCount !== 1 ? "s" : ""} filed
            {alert.userHasVoted ? "" : " · you haven\u2019t voted yet"}
          </p>
        </div>
        <Link
          href={`${alert.officeHref}/election`}
          className="inline-flex items-center justify-center bg-blue-600 text-white text-xs font-medium px-3 py-1.5 rounded hover:bg-blue-700 transition-colors flex-shrink-0"
        >
          Review candidates
        </Link>
      </div>
    </div>
  );
}

// ─── Post snippet (inline under office row) ────────────────────────────────

function PostSnippet({
  post,
  officeHref,
}: {
  post: BallotPostPreview;
  officeHref: string;
}) {
  const bodyPreview =
    post.body.length > 140 ? post.body.slice(0, 140).trimEnd() + "\u2026" : post.body;
  const timeAgo = formatDistanceToNow(new Date(post.createdAt), {
    addSuffix: true,
  });

  return (
    <div className="py-1.5 text-xs text-muted-foreground">
      <Link
        href={`${officeHref}/post/${post.id}`}
        className="hover:underline underline-offset-2"
      >
        {post.isWitnessPost && (
          <span className="text-emerald-700 font-medium">WITNESS </span>
        )}
        {post.title ? (
          <span className="text-bc-navy font-medium">{post.title}</span>
        ) : (
          <span className="text-bc-navy/70">{bodyPreview}</span>
        )}
      </Link>
      <span className="ml-2 text-muted-foreground/60">
        {post.authorUsername && <>@{post.authorUsername} · </>}
        {timeAgo}
        {post.replyCount > 0 && (
          <> · {post.replyCount} {post.replyCount === 1 ? "reply" : "replies"}</>
        )}
      </span>
    </div>
  );
}

// ─── Office row ─────────────────────────────────────────────────────────────

function OfficeRow({
  office,
  isLoggedIn,
}: {
  office: BallotOffice;
  isLoggedIn: boolean;
}) {
  const href = `/${office.districtGeoSlug}/${office.slug}`;
  const showPosts = office.isWatched && office.recentPosts.length > 0;

  return (
    <div className="py-2.5 border-b border-bc-light-lavender/60 last:border-b-0">
      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
        {/* Office + official */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Link
              href={href}
              className="text-sm font-medium text-bc-navy hover:underline underline-offset-2"
            >
              {office.title}
            </Link>
            {office.newPostCount > 0 && (
              <span className="text-[11px] text-muted-foreground">
                · {office.newPostCount} new post{office.newPostCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          {office.officialName && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {office.officialName}
              {office.officialParty && (
                <span className="text-muted-foreground/60">
                  {" "}({office.officialParty})
                </span>
              )}
            </p>
          )}
        </div>

        {/* Status + watch button */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <WitnessStatus office={office} />
          <BallotWatchButton
            officeId={office.id}
            initialIsWatching={office.isWatched}
            isLoggedIn={isLoggedIn}
          />
        </div>
      </div>

      {/* Inline post snippets for watched offices */}
      {showPosts && (
        <div className="ml-0 sm:ml-3 mt-1 border-l-2 border-bc-light-lavender/80 pl-3">
          {office.recentPosts.map((post) => (
            <PostSnippet key={post.id} post={post} officeHref={href} />
          ))}
          {office.newPostCount > office.recentPosts.length && (
            <Link
              href={href}
              className="text-xs text-bc-navy hover:underline underline-offset-2 py-1 inline-block"
            >
              See {office.newPostCount - office.recentPosts.length} more post{office.newPostCount - office.recentPosts.length !== 1 ? "s" : ""} · go to office
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Witness status indicator ───────────────────────────────────────────────

function WitnessStatus({ office }: { office: BallotOffice }) {
  if (office.hasOpenElection) {
    return <StatusPill variant="election" label="Election open" />;
  }

  if (office.witnessUsername) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            office.witnessIsActive ? "bg-emerald-500" : "bg-gray-300"
          }`}
        />
        @{office.witnessUsername}
      </span>
    );
  }

  return <StatusPill variant="vacant" />;
}

// ─── Layer card ─────────────────────────────────────────────────────────────

function LayerCard({
  layer,
  isLoggedIn,
  watchedOnly,
}: {
  layer: BallotLayer;
  isLoggedIn: boolean;
  watchedOnly: boolean;
}) {
  const watchedOffices = layer.offices.filter((o) => o.isWatched);
  const unwatchedOffices = layer.offices.filter((o) => !o.isWatched);
  const displayedOffices = watchedOnly ? watchedOffices : layer.offices;
  const newPostCount = layer.offices.reduce((sum, o) => sum + o.newPostCount, 0);
  const watchedCount = watchedOffices.length;

  if (watchedOnly && watchedOffices.length === 0) return null;

  return (
    <div className="rounded-lg border border-bc-light-lavender bg-white">
      {/* Layer header */}
      <div className="px-4 py-3 border-b border-bc-light-lavender/60">
        <div className="flex items-baseline gap-2 flex-wrap">
          <h2 className="font-serif text-base text-bc-navy font-bold">
            {layer.label}
          </h2>
          <span className="text-xs text-muted-foreground">
            {layer.offices.length} office{layer.offices.length !== 1 ? "s" : ""}
            {watchedCount > 0 && <> · {watchedCount} watched</>}
            {newPostCount > 0 && <> · {newPostCount} new post{newPostCount !== 1 ? "s" : ""}</>}
          </span>
        </div>
      </div>

      {/* Office list */}
      <div className="px-4">
        {displayedOffices.map((office) => (
          <OfficeRow key={office.id} office={office} isLoggedIn={isLoggedIn} />
        ))}
      </div>

      {/* Collapsed unfollowed summary */}
      {!watchedOnly && unwatchedOffices.length > 0 && watchedOffices.length > 0 && unwatchedOffices.every((o) => !o.isWatched) && (
        <div className="px-4 py-2 border-t border-bc-light-lavender/40">
          <p className="text-xs text-muted-foreground">
            {unwatchedOffices.length} more office{unwatchedOffices.length !== 1 ? "s" : ""} not watched
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Cold-start card ────────────────────────────────────────────────────────

function ColdStartCard({ homeDistrictName }: { homeDistrictName: string }) {
  return (
    <div className="rounded-lg bg-bc-navy text-bc-offwhite p-6">
      <h2 className="font-serif text-lg mb-3">Start here</h2>
      <p className="text-sm text-bc-lavender mb-4">
        Welcome to BallotCard. Your home district is {homeDistrictName}. Here
        are three things you can do:
      </p>
      <ol className="flex flex-col gap-3 text-sm text-bc-lavender">
        <li className="flex gap-2">
          <span className="text-bc-blush font-bold">1.</span>
          <span>
            <span className="text-bc-offwhite font-medium">Watch an office</span>{" "}
            — pick any office on your ballot below and click Watch to see
            activity from that seat.
          </span>
        </li>
        <li className="flex gap-2">
          <span className="text-bc-blush font-bold">2.</span>
          <span>
            <span className="text-bc-offwhite font-medium">Post something</span>{" "}
            — if you have information about what an official is doing, go to
            their office page and post it.
          </span>
        </li>
        <li className="flex gap-2">
          <span className="text-bc-blush font-bold">3.</span>
          <span>
            <span className="text-bc-offwhite font-medium">
              Run for Witness
            </span>{" "}
            — if no one is watching an office, you can file a candidacy and
            become the Witness for that seat.
          </span>
        </li>
      </ol>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default async function BallotPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const session = await auth();
  if (!session) return null;

  const params = await searchParams;
  const watchedOnly = params.filter === "watched";
  const homeDistrictId = session.user.homeDistrictId;

  // No home district set
  if (!homeDistrictId) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <h1 className="font-serif text-2xl text-bc-navy mb-2">
          Your ballot card
        </h1>
        <p className="text-sm text-muted-foreground mb-4">
          Set your home district to see your ballot.
        </p>
        <Link
          href="/settings/district"
          className="inline-flex items-center justify-center bg-bc-blush text-bc-navy font-medium text-sm px-4 py-2 rounded hover:opacity-90 transition-opacity"
        >
          Set home district
        </Link>
      </div>
    );
  }

  const data = await getBallotData(homeDistrictId, session.user.id);

  if (!data) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <h1 className="font-serif text-2xl text-bc-navy mb-2">
          Your ballot card
        </h1>
        <p className="text-sm text-muted-foreground">
          Could not load your ballot. Your home district may not be activated
          yet.
        </p>
      </div>
    );
  }

  const isColdStart = data.watchedCount === 0 && data.activeWitnesses === 0;

  // Build location line: "Wilmington, New Hanover County, NC"
  const locationParts: string[] = [data.homeDistrictName];
  if (data.homeDistrictCounty && data.homeDistrictCounty !== data.homeDistrictName) {
    locationParts.push(data.homeDistrictCounty);
  }
  if (data.homeDistrictState) {
    locationParts.push(data.homeDistrictState);
  }
  const locationLine = locationParts.join(", ");

  // Stats line
  const statsSegments: string[] = [];
  if (data.watchedCount > 0) {
    statsSegments.push(`Watching ${data.watchedCount} office${data.watchedCount !== 1 ? "s" : ""}`);
  }
  if (data.newPostsThisWeek > 0) {
    statsSegments.push(`${data.newPostsThisWeek} new post${data.newPostsThisWeek !== 1 ? "s" : ""} this week`);
  }
  if (data.electionAlerts.length > 0) {
    statsSegments.push(`${data.electionAlerts.length} Witness election${data.electionAlerts.length !== 1 ? "s" : ""} open`);
  }

  return (
    <div className="min-h-screen bg-bc-light-lavender/30">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground mb-1">
                Your ballot
              </p>
              <h1 className="font-serif text-xl sm:text-2xl text-bc-navy font-bold">
                {locationLine}
              </h1>
              {statsSegments.length > 0 && (
                <p className="text-sm text-muted-foreground mt-1">
                  {statsSegments.join(" · ")}
                </p>
              )}
            </div>
            {data.watchedCount > 0 && (
              <BallotFilterToggle currentFilter={watchedOnly ? "watched" : "all"} />
            )}
          </div>
        </div>

        {/* Election alerts */}
        {data.electionAlerts.length > 0 && (
          <div className="flex flex-col gap-3 mb-6">
            {data.electionAlerts.map((alert) => (
              <ElectionAlert key={alert.electionId} alert={alert} />
            ))}
          </div>
        )}

        {/* Cold-start onboarding */}
        {isColdStart && (
          <div className="mb-6">
            <ColdStartCard homeDistrictName={data.homeDistrictName} />
          </div>
        )}

        {/* Layer cards */}
        <div className="flex flex-col gap-4">
          {data.layers.map((layer) => (
            <LayerCard
              key={layer.label}
              layer={layer}
              isLoggedIn={true}
              watchedOnly={watchedOnly}
            />
          ))}
        </div>

        {/* Empty state */}
        {data.layers.length === 0 && (
          <div className="rounded-lg border border-bc-light-lavender bg-white p-6 text-center">
            <p className="text-sm text-muted-foreground">
              No offices on BallotCard yet for your district. Offices are added
              as residents activate them.
            </p>
          </div>
        )}

        {/* Watched-only empty state */}
        {watchedOnly && data.layers.every((l) => l.offices.every((o) => !o.isWatched)) && (
          <div className="rounded-lg border border-bc-light-lavender bg-white p-6 text-center">
            <p className="text-sm text-muted-foreground">
              You aren&apos;t watching any offices yet. Switch to the full view to explore your ballot.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
