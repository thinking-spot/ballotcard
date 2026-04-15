"use client";

import { useState, useTransition } from "react";
import { withdrawCandidacyAction } from "@/lib/election-actions";

interface WithdrawButtonProps {
  candidacyId: string;
}

export function WithdrawButton({ candidacyId }: WithdrawButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [withdrawn, setWithdrawn] = useState(false);

  function handleWithdraw() {
    startTransition(async () => {
      const result = await withdrawCandidacyAction(candidacyId);
      if ("success" in result) {
        setWithdrawn(true);
      }
      setConfirming(false);
    });
  }

  if (withdrawn) {
    return (
      <span className="text-xs text-muted-foreground italic">Withdrawn</span>
    );
  }

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Withdraw?</span>
        <button
          type="button"
          onClick={handleWithdraw}
          disabled={isPending}
          className="text-xs text-red-600 hover:underline disabled:opacity-50"
        >
          {isPending ? "…" : "Yes"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="text-xs text-muted-foreground hover:underline"
        >
          No
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="text-xs text-muted-foreground hover:text-red-600 hover:underline"
    >
      Withdraw candidacy
    </button>
  );
}
