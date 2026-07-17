export const metadata = {
  title: "Privacy",
  description:
    "How BallotCard protects you: your address is resolved to districts and immediately discarded, never stored or logged. No accounts, no analytics that identify you, no tracking.",
};

export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16">
      <h1 className="font-serif text-2xl text-bc-navy mb-6">Privacy</h1>

      <div className="flex flex-col gap-5 text-sm text-bc-navy leading-relaxed">
        <p>
          BallotCard is built so that it has nothing to know about you. There
          are no accounts, no profiles, and no tracking. This page explains the
          whole arrangement — it is short because there is not much to explain.
        </p>

        <h2 className="font-serif text-lg mt-3">Your address</h2>
        <p>
          When you enter your address, our server passes it to the US Census
          Geocoder — a free public government service — which returns the
          voting districts that contain it. We keep the districts and discard
          the address. It is never written to our database and never logged.
        </p>

        <h2 className="font-serif text-lg mt-3">What stays on your device</h2>
        <p>
          Your browser&apos;s localStorage remembers your district IDs so that
          &ldquo;My ballot&rdquo; works on your next visit. District IDs are
          facts about places, not about people — the same IDs are shared by
          everyone in your district. Clearing your browser storage removes
          them, and nothing breaks; you can simply enter your address again.
        </p>

        <h2 className="font-serif text-lg mt-3">No accounts, no analytics</h2>
        <p>
          There is nothing to sign up for and no analytics that identify you.
          We use error monitoring (Sentry) in production to catch bugs; it is
          configured to scrub addresses and personal information, and we verify
          that scrubbing in our automated tests.
        </p>

        <h2 className="font-serif text-lg mt-3">Verify it yourself</h2>
        <p>
          BallotCard is open source. The code that does everything described
          above is public, so these claims can be checked rather than taken on
          faith.
        </p>
      </div>
    </div>
  );
}
