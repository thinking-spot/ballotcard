import { WordMark } from "@/components/brand/WordMark";
import { AddressEntry } from "@/components/AddressEntry";

export function LandingHero() {
  return (
    <section className="bg-bc-navy text-bc-offwhite">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-14 pb-20 sm:pt-20 sm:pb-28">
        <p className="font-serif text-lg text-bc-lavender">Find my ballot</p>

        <h1 className="font-serif text-3xl sm:text-4xl leading-snug text-bc-offwhite mt-8 max-w-2xl">
          Your ballot, your politicians, 24/7.
        </h1>

        <p className="mt-5 text-bc-lavender text-base sm:text-lg leading-relaxed max-w-xl">
          Create an online version of your local ballot in seconds. From the
          senate to city hall, stay up to date on your representatives and your
          elections.
        </p>

        <div className="mt-8">
          <AddressEntry variant="hero" />
        </div>
      </div>
    </section>
  );
}
