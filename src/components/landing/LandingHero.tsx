import { WordMark } from "@/components/brand/WordMark";
import { AddressEntry } from "@/components/AddressEntry";

export function LandingHero() {
  return (
    <section className="bg-bc-navy text-bc-offwhite">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-20 sm:py-28">
        <WordMark color="offwhite" size="lg" asLink={false} />

        <h1 className="font-serif text-3xl sm:text-4xl leading-snug text-bc-offwhite mt-8 max-w-2xl">
          Everyone who represents you, on one permanent page.
        </h1>

        <p className="mt-5 text-bc-lavender text-base sm:text-lg leading-relaxed max-w-xl">
          Enter your address and see the faithful recreation of your actual
          ballot — president to city hall: who holds each seat, and when each
          seat is next up for a vote. No account, no ads, no tracking.
        </p>

        <div className="mt-8">
          <AddressEntry variant="hero" />
        </div>
      </div>
    </section>
  );
}
