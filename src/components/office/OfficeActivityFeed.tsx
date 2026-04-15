import Link from "next/link";
import { PostCard } from "@/components/office/PostCard";
import type { PostPreview } from "@/lib/office-data";

interface OfficeActivityFeedProps {
  posts: PostPreview[];
  officeHref: string;
  showNewPostLink?: boolean;
}

export function OfficeActivityFeed({
  posts,
  officeHref,
  showNewPostLink,
}: OfficeActivityFeedProps) {
  return (
    <div className="rounded-lg border border-bc-light-lavender bg-white">
      <div className="px-4 pt-4 pb-2 border-b border-bc-light-lavender flex items-center justify-between">
        <h2 className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
          Recent activity
        </h2>
        {showNewPostLink && (
          <Link
            href={`${officeHref}/post/new`}
            className="text-xs font-medium text-bc-navy hover:text-bc-deep-navy transition-colors"
          >
            New post
          </Link>
        )}
      </div>

      {posts.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">
          No posts yet. The Witness will post here when there is something worth
          reporting.
        </p>
      ) : (
        <div className="px-4 divide-y divide-bc-light-lavender">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} officeHref={officeHref} />
          ))}
        </div>
      )}
    </div>
  );
}
