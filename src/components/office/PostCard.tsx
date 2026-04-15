import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { WitnessBadge } from "@/components/ui/WitnessBadge";
import { TagPill } from "@/components/ui/TagPill";
import { FeaturedLinkCard } from "@/components/office/FeaturedLinkCard";
import type { PostPreview } from "@/lib/office-data";

interface PostCardProps {
  post: PostPreview;
  officeHref: string;
}

export function PostCard({ post, officeHref }: PostCardProps) {
  const postHref = `${officeHref}/post/${post.id}`;

  const bodyPreview =
    post.body.length > 280 ? post.body.slice(0, 280).trimEnd() + "…" : post.body;

  const timeAgo = formatDistanceToNow(new Date(post.createdAt), {
    addSuffix: true,
  });

  const issueTags = post.tags.filter((t) => t.kind === "issue");

  return (
    <article className="py-4 border-b border-bc-light-lavender last:border-b-0">
      <div className="flex items-start gap-2 mb-1.5">
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
        {post.authorUsername && (
          <Link
            href={`/u/${post.authorUsername}`}
            className="text-bc-navy hover:underline"
          >
            @{post.authorUsername}
          </Link>
        )}{" "}
        · {timeAgo}
        {post.replyCount > 0 && (
          <>
            {" "}
            ·{" "}
            <Link href={postHref} className="hover:underline">
              {post.replyCount} {post.replyCount === 1 ? "reply" : "replies"}
            </Link>
          </>
        )}
      </p>

      {post.featuredLink && (
        <div className="mb-3">
          <FeaturedLinkCard link={post.featuredLink} />
        </div>
      )}

      {!post.title && (
        <p className="text-sm text-bc-navy/80 leading-relaxed mb-2 whitespace-pre-line">
          {bodyPreview}
        </p>
      )}

      {post.title && (
        <p className="text-sm text-muted-foreground leading-relaxed mb-2 line-clamp-3">
          {bodyPreview}
        </p>
      )}

      {issueTags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {issueTags.map((tag) => (
            <TagPill key={tag.id} label={tag.label} />
          ))}
        </div>
      )}
    </article>
  );
}
