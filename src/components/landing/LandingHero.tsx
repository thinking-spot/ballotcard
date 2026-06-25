import { WordMark } from "@/components/brand/WordMark";
import { AddressEntry } from "@/components/AddressEntry";

export function LandingHero() {
  return (
    <section className="bg-bc-navy text-bc-offwhite">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-20 sm:py-28">
        <p className="font-serif text-lg text-bc-offwhite">Find My Ballot</p>

        <h1 className="font-serif text-3xl sm:text-4xl leading-snug text-bc-offwhite mt-8 max-w-2xl">
          Your ballot, your politicians.<br />Live tracking &amp; real-time updates.
        </h1>

        <p className="mt-5 text-bc-lavender text-base sm:text-lg leading-relaxed max-w-xl">
          Enter an address for a real-time recreation of your actual ballot.
          From president to city hall: who holds each seat, and who&rsquo;s on
          the ballot in the next election. No account, no ads, no tracking.
        </p>

        <div className="mt-8">
          <AddressEntry variant="hero" />
        </div>
      </div>
    </section>
  );
}
