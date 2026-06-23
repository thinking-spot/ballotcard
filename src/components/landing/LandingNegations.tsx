const negations = [
  {
    label: "No account.",
    body: "There is nothing to sign up for. You never create a profile, never set a password, never identify yourself. BallotCard is a reference you read, not a service you join.",
  },
  {
    label: "No stored addresses.",
    body: "Your address is resolved to voting districts by the US Census Geocoder and immediately discarded. It is never written to our database and never logged. localStorage holds district IDs only — facts about a place, never about you.",
  },
  {
    label: "No ads, ever.",
    body: "BallotCard is not monetized. Operating costs are covered by the maintainer. No ads, no lead-gen, no enterprise contracts, no selling your data. Nothing here is for sale.",
  },
  {
    label: "No algorithm.",
    body: "No feed, no ranking, no trending, no engagement optimization. Content is organized by district and office — by where you live and what you vote for — not by what a platform decided you should see next.",
  },
  {
    label: "No user-generated content.",
    body: "No posts, no comments, no forums. Every fact comes from a cited public data source — government rosters, the Census, official records — and links back to it. Wikipedia's epistemic honesty, not a comment section.",
  },
];

export function LandingNegations() {
  return (
    <section className="bg-bc-offwhite">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <h2 className="font-serif text-2xl text-bc-navy mb-10">
          What this isn&apos;t
        </h2>

        <div className="flex flex-col gap-6 max-w-2xl">
          {negations.map((item) => (
            <div key={item.label}>
              <p className="text-sm text-bc-navy leading-relaxed">
                <span className="font-serif font-bold">{item.label}</span>{" "}
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
