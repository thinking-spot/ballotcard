"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

// Hamburger for the links that are hidden on xs screens (< sm).
// Uses div+onClick, not <form>, per the (public) page pattern.
export function NavMobileMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  return (
    <div ref={ref} className="relative sm:hidden font-[family-name:var(--font-sans-ui)]">
      <div
        role="button"
        aria-label="Open menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((o) => !o)}
        className="flex items-center justify-center w-8 h-8 text-[var(--glass-text)] hover:text-[var(--glass-active)] transition-colors cursor-pointer select-none"
      >
        {isOpen ? (
          // ✕
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
            <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        ) : (
          // ☰
          <svg width="16" height="12" viewBox="0 0 16 12" fill="none" aria-hidden>
            <path d="M0 1h16M0 6h16M0 11h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        )}
      </div>

      {isOpen && (
        <div
          className="absolute right-0 top-full mt-1.5 w-44 rounded-[10px] border border-[var(--glass-border)] shadow-lg py-1 z-50"
          style={{
            background: "var(--glass-bg)",
            backdropFilter: "blur(24px) saturate(180%)",
            WebkitBackdropFilter: "blur(24px) saturate(180%)",
          }}
        >
          <Link
            href="/how-it-works"
            className="block px-4 py-2.5 text-[0.8125rem] text-[var(--glass-text)] hover:text-[var(--glass-active)] hover:bg-[var(--glass-hover-bg)] transition-colors"
            onClick={() => setIsOpen(false)}
          >
            How it works
          </Link>
          <Link
            href="/about"
            className="block px-4 py-2.5 text-[0.8125rem] text-[var(--glass-text)] hover:text-[var(--glass-active)] hover:bg-[var(--glass-hover-bg)] transition-colors"
            onClick={() => setIsOpen(false)}
          >
            About
          </Link>
          <Link
            href="/principles"
            className="block px-4 py-2.5 text-[0.8125rem] text-[var(--glass-text)] hover:text-[var(--glass-active)] hover:bg-[var(--glass-hover-bg)] transition-colors"
            onClick={() => setIsOpen(false)}
          >
            Principles
          </Link>
        </div>
      )}
    </div>
  );
}
