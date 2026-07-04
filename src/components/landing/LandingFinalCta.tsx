import { AddressEntry } from "@/components/AddressEntry";

export function LandingFinalCta() {
  return (
    <section className="bg-bc-navy text-bc-offwhite">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-20 sm:py-24 text-center">
        <h2 className="font-serif text-3xl text-bc-offwhite">
          See your ballot.
        </h2>
        <p className="mt-4 text-bc-lavender text-base max-w-md mx-auto leading-relaxed">
          Ten seconds, free, no account. Know every race you vote in — and
          everyone running — before election day.
        </p>
        <div className="mt-8 flex justify-center">
          <AddressEntry variant="hero" />
        </div>
      </div>
    </section>
  );
}
