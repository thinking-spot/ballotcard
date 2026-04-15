import Link from "next/link";
import { WordMark } from "@/components/brand/WordMark";

export function Footer() {
  return (
    <footer className="bg-bc-navy border-t border-bc-deep-navy mt-auto">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <WordMark color="offwhite" size="sm" asLink={false} />
          <a
            href="https://github.com/thinking-spot/ballotcard"
            className="text-xs text-bc-lavender hover:text-bc-offwhite transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            open source · github
          </a>
        </div>

        <nav className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-bc-lavender">
          <Link href="/principles" className="hover:text-bc-offwhite transition-colors">
            Principles
          </Link>
          <Link href="/privacy" className="hover:text-bc-offwhite transition-colors">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-bc-offwhite transition-colors">
            Terms
          </Link>
          <Link href="/support" className="hover:text-bc-offwhite transition-colors">
            Support
          </Link>
        </nav>
      </div>
    </footer>
  );
}
