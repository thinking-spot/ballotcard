import Link from "next/link";
import { NavMobileMenu } from "@/components/layout/NavMobileMenu";
import { MyBallotLink } from "@/components/MyBallotLink";
import { BrandMark } from "@/components/brand/BrandMark";

// The nav lives in the chrome/digital world: a frosted glass bar that sticks
// to the top. Inter throughout, glass tokens, backdrop blur. The wordmark is
// part of the digital layer — no serif here.
const linkClass =
  "px-2.5 py-[0.3125rem] rounded-[7px] text-[0.8125rem] font-normal font-[family-name:var(--font-wordmark)] text-[var(--glass-active)] hover:bg-[var(--glass-hover-bg)] transition-colors";

export function PublicNav() {
  return (
    <nav
      className="sticky top-0 z-20 h-[52px] px-5 sm:px-8 flex items-center justify-between border-b border-[var(--glass-border)] font-[family-name:var(--font-sans-ui)]"
      style={{
        background: "var(--glass-bg)",
        backdropFilter: "blur(24px) saturate(180%)",
        WebkitBackdropFilter: "blur(24px) saturate(180%)",
      }}
    >
      <Link href="/" className="inline-flex items-center" aria-label="BallotCard home">
        <BrandMark />
      </Link>

      <div className="flex items-center gap-0.5">
        <Link href="/how-it-works" className={`${linkClass} hidden sm:block`}>
          How it works
        </Link>
        <Link href="/about" className={`${linkClass} hidden sm:block`}>
          About
        </Link>
        <Link href="/principles" className={`${linkClass} hidden sm:block`}>
          Principles
        </Link>
        <MyBallotLink
          className={`${linkClass} font-medium !text-[var(--glass-active)] bg-[var(--glass-active-bg)]`}
        />

        <NavMobileMenu />
      </div>
    </nav>
  );
}
