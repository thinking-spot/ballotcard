"use client";

import { useState, useTransition } from "react";
import { resolveElectionAction } from "@/lib/election-actions";

interface ResolveButtonProps {
  electionId: string;
}

export function ResolveButton({ electionId }: ResolveButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  function handleResolve() {
    startTransition(async () => {
      const res = await resolveElectionAction(electionId);
      if ("error" in res) {
        setResult(res.error);
      } else {
        setResult(res.data.reason);
      }
    });
  }

  if (result) {
    return (
      <div className="rounded-lg border border-bc-light-lavender bg-white p-4">
        <p className="text-sm text-bc-navy">{result}</p>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleResolve}
      disabled={isPending}
      className="inline-flex items-center justify-center bg-bc-navy text-white text-sm font-medium px-4 py-2 rounded hover:opacity-90 transition-opacity disabled:opacity-50"
    >
      {isPending ? "Resolving…" : "Resolve election"}
    </button>
  );
}
