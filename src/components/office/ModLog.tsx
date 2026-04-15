import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import type { ModActionEntry } from "@/lib/office-data";

const actionLabels: Record<string, string> = {
  pin: "pinned",
  unpin: "unpinned",
  soft_delete: "removed",
  restore: "restored",
};

interface ModLogProps {
  actions: ModActionEntry[];
  officeHref: string;
}

export function ModLog({ actions, officeHref }: ModLogProps) {
  if (actions.length === 0) return null;

  return (
    <details className="rounded-lg border border-bc-light-lavender bg-white">
      <summary className="px-4 py-3 text-[10px] font-semibold tracking-widest uppercase text-muted-foreground cursor-pointer hover:bg-bc-light-lavender/30">
        Moderation log ({actions.length})
      </summary>
      <div className="divide-y divide-bc-light-lavender border-t border-bc-light-lavender">
        {actions.map((action) => {
          const label = actionLabels[action.action] ?? action.action;
          const timeAgo = formatDistanceToNow(new Date(action.createdAt), {
            addSuffix: true,
          });

          return (
            <div key={action.id} className="px-4 py-2.5 text-xs">
              <p className="text-bc-navy/80">
                <Link
                  href={`/u/${action.actorUsername}`}
                  className="font-medium text-bc-navy hover:underline"
                >
                  @{action.actorUsername}
                </Link>{" "}
                {label}{" "}
                {action.targetType === "post" && (
                  <>
                    a post
                    {action.postAuthorUsername && (
                      <>
                        {" "}by{" "}
                        <Link
                          href={`/u/${action.postAuthorUsername}`}
                          className="text-bc-navy hover:underline"
                        >
                          @{action.postAuthorUsername}
                        </Link>
                      </>
                    )}
                    {action.postTitle && (
                      <>
                        {": "}
                        <Link
                          href={`${officeHref}/post/${action.targetId}`}
                          className="text-bc-navy hover:underline"
                        >
                          {action.postTitle}
                        </Link>
                      </>
                    )}
                  </>
                )}
              </p>
              {action.reason && (
                <p className="text-muted-foreground mt-0.5">
                  Reason: {action.reason}
                </p>
              )}
              <p className="text-muted-foreground mt-0.5">{timeAgo}</p>
            </div>
          );
        })}
      </div>
    </details>
  );
}
