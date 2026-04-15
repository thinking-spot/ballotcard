import Link from "next/link";
import { WordMark } from "@/components/brand/WordMark";

export function LandingHero() {
  return (
    <section className="bg-bc-navy text-bc-offwhite">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-20 sm:py-28">
        <WordMark color="offwhite" size="lg" asLink={false} />

        <h1 className="font-serif text-3xl sm:text-4xl leading-snug text-bc-offwhite mt-8 max-w-2xl">
          A parallel government, with no power and nothing to sell.
        </h1>

        <p className="mt-5 text-bc-lavender text-base sm:text-lg leading-relaxed max-w-xl">
          For every elected official, residents of that district can elect a
          Witness — a volunteer whose job is to watch, report on, and publicly
          discuss what that official is doing. Witnesses have no authority. Their
          only currency is attention.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row gap-3">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center bg-bc-blush text-bc-navy font-medium text-sm px-6 py-3 rounded hover:opacity-90 transition-opacity"
          >
            Find your ballot
          </Link>
          <Link
            href="/nc/07/us-house"
            className="inline-flex items-center justify-center border border-bc-lavender text-bc-lavender font-medium text-sm px-6 py-3 rounded hover:border-bc-offwhite hover:text-bc-offwhite transition-colors"
          >
            See an example
          </Link>
        </div>
      </div>
    </section>
  );
}
