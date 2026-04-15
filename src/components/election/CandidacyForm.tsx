"use client";

import { useState, useTransition } from "react";
import { declareCandidacyAction } from "@/lib/election-actions";

interface CandidacyFormProps {
  electionId: string;
}

export function CandidacyForm({ electionId }: CandidacyFormProps) {
  const [statementShort, setStatementShort] = useState("");
  const [statementLong, setStatementLong] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await declareCandidacyAction({
        electionId,
        statementShort,
        statementLong: statementLong || undefined,
      });

      if ("error" in result) {
        setError(result.error);
      } else {
        setSubmitted(true);
      }
    });
  }

  if (submitted) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
        <p className="text-sm text-emerald-800 font-medium">
          Your candidacy has been filed.
        </p>
        <p className="text-xs text-emerald-700 mt-1">
          Your statement will be visible to voters on this page.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-bc-light-lavender bg-white p-4">
      <h3 className="text-sm font-medium text-bc-navy mb-3">
        File your candidacy
      </h3>

      <div className="space-y-3">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">
            Short statement (shown on the ballot)
          </label>
          <textarea
            value={statementShort}
            onChange={(e) => setStatementShort(e.target.value)}
            className="w-full rounded border border-bc-light-lavender px-3 py-2 text-sm text-bc-navy placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-bc-navy/30"
            rows={2}
            maxLength={280}
            placeholder="Why should residents elect you as Witness for this office? (10–280 characters)"
          />
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {statementShort.length}/280
          </p>
        </div>

        <div>
          <label className="block text-xs text-muted-foreground mb-1">
            Full statement (optional)
          </label>
          <textarea
            value={statementLong}
            onChange={(e) => setStatementLong(e.target.value)}
            className="w-full rounded border border-bc-light-lavender px-3 py-2 text-sm text-bc-navy placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-bc-navy/30"
            rows={4}
            maxLength={5000}
            placeholder="Expand on your qualifications, what you plan to focus on, etc."
          />
        </div>

        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending || statementShort.length < 10}
          className="inline-flex items-center justify-center bg-bc-navy text-white text-sm font-medium px-4 py-2 rounded hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? "Filing…" : "File candidacy"}
        </button>
      </div>
    </div>
  );
}
