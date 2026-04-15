import Link from "next/link";

export function LandingFinalCta() {
  return (
    <section className="bg-bc-navy text-bc-offwhite">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-20 sm:py-24 text-center">
        <h2 className="font-serif text-3xl text-bc-offwhite">
          Be an early resident.
        </h2>
        <p className="mt-4 text-bc-lavender text-base max-w-md mx-auto leading-relaxed">
          No email. No tracking. No ads. Choose a pseudonym, pick your home
          district, and see what your elected officials have been up to.
        </p>
        <Link
          href="/signup"
          className="mt-8 inline-flex items-center justify-center bg-bc-blush text-bc-navy font-medium text-sm px-8 py-3 rounded hover:opacity-90 transition-opacity"
        >
          Sign up — takes 60 seconds.
        </Link>
      </div>
    </section>
  );
}
