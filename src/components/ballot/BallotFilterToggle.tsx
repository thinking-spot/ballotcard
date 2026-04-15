"use client";

import { useRouter, useSearchParams } from "next/navigation";

interface BallotFilterToggleProps {
  currentFilter: "all" | "watched";
}

export function BallotFilterToggle({ currentFilter }: BallotFilterToggleProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleToggle() {
    const params = new URLSearchParams(searchParams.toString());
    if (currentFilter === "all") {
      params.set("filter", "watched");
    } else {
      params.delete("filter");
    }
    router.push(`/ballot${params.size > 0 ? `?${params}` : ""}`);
  }

  return (
    <button
      onClick={handleToggle}
      className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-full border transition-colors cursor-pointer border-bc-light-lavender text-muted-foreground hover:border-bc-navy hover:text-bc-navy"
    >
      <span
        className={`w-2 h-2 rounded-full transition-colors ${
          currentFilter === "watched" ? "bg-bc-navy" : "bg-bc-light-lavender"
        }`}
      />
      {currentFilter === "watched" ? "Watching only" : "All offices"}
    </button>
  );
}
