// The chrome-layer brand mark: "BallotCard" in IBM Plex Sans 500 followed by a
// ballot-checkbox icon. Lives in the nav and footer. Spec is the drop-in
// component from docs/design-brief.md — the checkbox sits 7px to the right at
// 0.85 opacity so it reads as a mark, not a competing glyph.
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
        style={{ flexShrink: 0, opacity: 0.85, color: "var(--glass-active)" }}
      >
        <rect
          x="1"
          y="1"
          width="13"
          height="13"
          rx="2.5"
          stroke="currentColor"
          strokeWidth="1.4"
        />
        <path
          d="M4.5 7.5l2 2 4-4"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
