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

  // Frosted glass pill — lives in the chrome/digital world (Inter, blur).
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={saved}
      style={{
        background: "var(--pill-bg)",
        borderColor: "var(--pill-border)",
        color: "var(--pill-text)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-[9px] border px-[0.9375rem] py-2 text-[0.8125rem] font-medium tracking-[-0.01em] cursor-pointer transition-colors font-[family-name:var(--font-sans-ui)] hover:[background:var(--pill-bg-hover)] hover:[border-color:var(--pill-border-hover)] hover:[color:var(--pill-text-hover)]"
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
