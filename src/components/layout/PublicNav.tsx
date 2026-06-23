import Link from "next/link";
import { WordMark } from "@/components/brand/WordMark";
import { NavMobileMenu } from "@/components/layout/NavMobileMenu";
import { MyBallotLink } from "@/components/MyBallotLink";

export function PublicNav() {
  return (
    <nav className="bg-bc-navy border-b border-bc-deep-navy">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <WordMark color="offwhite" size="md" />

        <div className="flex items-center gap-4 sm:gap-6 text-sm">
          <Link
            href="/how-it-works"
            className="text-bc-lavender hover:text-bc-offwhite transition-colors hidden sm:block"
          >
            How it works
          </Link>
          <Link
            href="/about"
            className="text-bc-lavender hover:text-bc-offwhite transition-colors hidden sm:block"
          >
            About
          </Link>
          <Link
            href="/principles"
            className="text-bc-lavender hover:text-bc-offwhite transition-colors hidden sm:block"
          >
            Principles
          </Link>
          <MyBallotLink className="text-bc-blush font-medium hover:text-bc-offwhite transition-colors" />

          <NavMobileMenu />
        </div>
      </div>
    </nav>
  );
}
