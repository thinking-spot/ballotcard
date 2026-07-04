import Link from "next/link";
import { BrandMark } from "@/components/brand/BrandMark";

// Site footer — mirrors the nav's frosted glass chrome (border-top instead of
// border-bottom). Inter throughout; part of the digital/chrome world.
const linkClass =
  "text-[var(--glass-text)] hover:text-[var(--glass-active)] transition-colors";

export function Footer() {
  return (
    <footer
      className="mt-12 px-5 sm:px-8 py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-t border-[var(--glass-border)] text-[0.8125rem] font-[family-name:var(--font-sans-ui)]"
      style={{
        background: "var(--glass-bg)",
        backdropFilter: "blur(24px) saturate(180%)",
        WebkitBackdropFilter: "blur(24px) saturate(180%)",
      }}
    >
      <div>
        <Link
          href="/"
          className="inline-flex items-center mb-1"
          aria-label="BallotCard home"
        >
          <BrandMark />
        </Link>
        <span className="block text-[0.75rem] text-[var(--glass-text)]">
          open source ·{" "}
          <a
            href="https://github.com/thinking-spot/ballotcard"
            className={linkClass}
            target="_blank"
            rel="noopener noreferrer"
          >
            github
          </a>
        </span>
      </div>

      <nav className="flex flex-wrap items-center gap-x-6 gap-y-1">
        <Link href="/privacy" className={linkClass}>
          Privacy
        </Link>
        <Link href="/terms" className={linkClass}>
          Terms
        </Link>
      </nav>
    </footer>
  );
}
