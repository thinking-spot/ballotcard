"use client";

import { useTransition, useOptimistic } from "react";
import { castVoteAction } from "@/lib/election-actions";

interface VoteButtonProps {
  electionId: string;
  candidacyId: string;
  isCurrentVote: boolean;
  isLoggedIn: boolean;
  canVote: boolean;
}

export function VoteButton({
  electionId,
  candidacyId,
  isCurrentVote,
  isLoggedIn,
  canVote,
}: VoteButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [optimisticVoted, setOptimisticVoted] = useOptimistic(isCurrentVote);

  if (!isLoggedIn || !canVote) return null;

  function handleVote() {
    startTransition(async () => {
      setOptimisticVoted(true);
      await castVoteAction({ electionId, candidacyId });
    });
  }

  if (optimisticVoted) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-medium">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        Your vote
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={handleVote}
      disabled={isPending}
      className="inline-flex items-center justify-center border border-bc-navy text-bc-navy text-xs font-medium px-3 py-1 rounded hover:bg-bc-navy hover:text-white transition-colors disabled:opacity-50"
    >
      {isPending ? "Voting…" : "Vote"}
    </button>
  );
}
