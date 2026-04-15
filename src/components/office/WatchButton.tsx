"use client";

import { useOptimistic, useTransition } from "react";
import { watchOfficeAction, unwatchOfficeAction } from "@/lib/office-actions";

interface WatchButtonProps {
  officeId: string;
  initialIsWatching: boolean;
  initialCount: number;
  isLoggedIn: boolean;
}

export function WatchButton({
  officeId,
  initialIsWatching,
  initialCount,
  isLoggedIn,
}: WatchButtonProps) {
  const [isPending, startTransition] = useTransition();

  const [optimistic, setOptimistic] = useOptimistic(
    { isWatching: initialIsWatching, count: initialCount },
    (_current, next: { isWatching: boolean; count: number }) => next
  );

  function handleClick() {
    if (!isLoggedIn) {
      window.location.href = "/login";
      return;
    }

    const willWatch = !optimistic.isWatching;
    const currentCount = optimistic.count;

    startTransition(async () => {
      setOptimistic({
        isWatching: willWatch,
        count: currentCount + (willWatch ? 1 : -1),
      });

      const result = willWatch
        ? await watchOfficeAction(officeId)
        : await unwatchOfficeAction(officeId);

      if ("error" in result) {
        // Revert on error — the page will revalidate with server state
        setOptimistic({
          isWatching: !willWatch,
          count: currentCount,
        });
      }
    });
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleClick}
        disabled={isPending}
        className={`px-3 py-1.5 text-sm font-medium rounded border transition-colors ${
          optimistic.isWatching
            ? "bg-bc-navy text-bc-offwhite border-bc-navy hover:bg-bc-deep-navy"
            : "border-bc-navy text-bc-navy hover:bg-bc-light-lavender/50"
        } ${isPending ? "opacity-70" : ""}`}
      >
        {optimistic.isWatching ? "Watching" : "Watch"}
      </button>
      <span className="text-xs text-muted-foreground">
        {optimistic.count} watching
      </span>
    </div>
  );
}
