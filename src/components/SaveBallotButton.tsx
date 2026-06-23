"use client";

import { useState, useEffect } from "react";

export const MY_BALLOT_KEY = "ballotcard.myballot";
export const MY_BALLOT_EVENT = "ballotcard:myballot";

/**
 * Saves the current ballot (a district URL — facts about a place, never the
 * user or their address) to localStorage so "My ballot" appears in the nav and
 * persists across visits. The saved value is just a path; nothing identifying.
 */
export function SaveBallotButton({
  path,
  label,
}: {
  path: string;
  label: string;
}) {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const sync = () => {
      try {
        const cur = JSON.parse(localStorage.getItem(MY_BALLOT_KEY) || "null");
        setSaved(cur?.path === path);
      } catch {
        setSaved(false);
      }
    };
    sync();
    // Keep in sync if the ballot is saved/cleared elsewhere (other tab or nav).
    window.addEventListener(MY_BALLOT_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(MY_BALLOT_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [path]);

  function toggle() {
    try {
      if (saved) {
        localStorage.removeItem(MY_BALLOT_KEY);
        setSaved(false);
      } else {
        localStorage.setItem(
          MY_BALLOT_KEY,
          JSON.stringify({ path, label, savedAt: new Date().toISOString() })
        );
        setSaved(true);
      }
      window.dispatchEvent(new CustomEvent(MY_BALLOT_EVENT));
    } catch {
      // localStorage unavailable (private mode) — the URL is still shareable.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={saved}
      className={
        saved
          ? "inline-flex items-center gap-1.5 rounded border border-bc-navy/20 bg-white text-bc-navy text-sm font-medium px-4 py-2 hover:bg-bc-light-lavender/40 transition-colors cursor-pointer"
          : "inline-flex items-center gap-1.5 rounded bg-bc-navy text-bc-offwhite text-sm font-medium px-4 py-2 hover:opacity-90 transition-opacity cursor-pointer"
      }
    >
      {saved ? (
        <>
          <span aria-hidden>★</span> Saved to My ballot
        </>
      ) : (
        <>
          <span aria-hidden>☆</span> Save my ballot
        </>
      )}
    </button>
  );
}
