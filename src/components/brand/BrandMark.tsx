// The chrome-layer brand mark: "BallotCard" in IBM Plex Sans 500 followed by a
// ballot-checkbox icon. Lives in the nav and footer.
//
// Split styling per docs/design-brief.md: the box outline is muted (inherits
// chrome color at 0.35 alpha) so it reads as a quiet glyph; the checkmark is
// the green accent (--wordmark-check, light/dark variants) — a small visual
// signal that the ballot is filled.
export function BrandMark() {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: "7px" }}>
      <span
        style={{
          fontFamily: "var(--font-wordmark)",
          fontWeight: 500,
          fontSize: "17px",
          letterSpacing: "-0.01em",
          color: "var(--glass-active)",
        }}
      >
        BallotCard
      </span>
      <svg
        width="15"
        height="15"
        viewBox="0 0 15 15"
        fill="none"
        aria-hidden="true"
        style={{ flexShrink: 0, color: "var(--glass-active)" }}
      >
        {/* Box outline — muted, inherits chrome color */}
        <rect
          x="1"
          y="1"
          width="13"
          height="13"
          rx="2.5"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeOpacity="0.35"
        />
        {/* Checkmark — green accent */}
        <path
          d="M4.5 7.5l2 2 4-4"
          stroke="var(--wordmark-check)"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
