"use client";

import { useOptimistic, useTransition } from "react";
import { watchOfficeAction, unwatchOfficeAction } from "@/lib/office-actions";

interface BallotWatchButtonProps {
  officeId: string;
  initialIsWatching: boolean;
  isLoggedIn: boolean;
}

export function BallotWatchButton({
  officeId,
  initialIsWatching,
  isLoggedIn,
}: BallotWatchButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [isWatching, setOptimistic] = useOptimistic(initialIsWatching);

  function handleClick() {
    if (!isLoggedIn) {
      window.location.href = "/login";
      return;
    }

    const willWatch = !isWatching;

    startTransition(async () => {
      setOptimistic(willWatch);
      const result = willWatch
        ? await watchOfficeAction(officeId)
        : await unwatchOfficeAction(officeId);

      if ("error" in result) {
        setOptimistic(!willWatch);
      }
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className={`px-2.5 py-1 text-xs font-medium rounded border transition-colors cursor-pointer ${
        isWatching
          ? "bg-bc-navy text-bc-offwhite border-bc-navy hover:bg-bc-deep-navy"
          : "border-bc-light-lavender text-muted-foreground hover:border-bc-navy hover:text-bc-navy"
      } ${isPending ? "opacity-70" : ""}`}
    >
      {isWatching ? "Watching" : "Watch"}
    </button>
  );
}
