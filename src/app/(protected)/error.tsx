"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function ProtectedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-bc-light-lavender/30 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="rounded-lg border border-bc-light-lavender bg-white p-8">
          <h1 className="font-serif text-2xl text-bc-navy font-bold mb-2">
            BallotCard is temporarily unavailable
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            We&apos;re having trouble connecting to our database. This is usually
            brief — please try again in a moment.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={reset}
              className="inline-flex items-center justify-center bg-bc-navy text-bc-offwhite text-sm font-medium px-4 py-2 rounded hover:bg-bc-deep-navy transition-colors"
            >
              Try again
            </button>
            <Link
              href="/ballot"
              className="text-sm text-muted-foreground hover:text-bc-navy transition-colors"
            >
              Go to ballot
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
