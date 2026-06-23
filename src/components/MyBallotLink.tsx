"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { MY_BALLOT_KEY, MY_BALLOT_EVENT } from "@/components/SaveBallotButton";

/**
 * Nav link to the visitor's saved ballot. Renders nothing until a ballot has
 * been saved (read from localStorage on mount, kept in sync via the save event
 * and cross-tab storage events). The stored value is a district URL only.
 */
export function MyBallotLink({ className }: { className?: string }) {
  const [path, setPath] = useState<string | null>(null);

  useEffect(() => {
    const read = () => {
      try {
        const v = JSON.parse(localStorage.getItem(MY_BALLOT_KEY) || "null");
        setPath(typeof v?.path === "string" ? v.path : null);
      } catch {
        setPath(null);
      }
    };
    read();
    window.addEventListener(MY_BALLOT_EVENT, read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener(MY_BALLOT_EVENT, read);
      window.removeEventListener("storage", read);
    };
  }, []);

  if (!path) return null;

  return (
    <Link href={path} className={className}>
      My ballot
    </Link>
  );
}
