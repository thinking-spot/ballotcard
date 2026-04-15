const might_work = [
  "The mechanism is simple enough to explain in one paragraph and doesn't require anyone to trust a company.",
  "It gives civic-minded people a structured outlet that isn't party organizing, punditry, or social media performance.",
  "The public, permanent record has value even if a Witness seat goes unfilled. An empty page is still findable.",
  "Self-regulation through elections means bad actors can be removed without a moderation team making editorial calls.",
];

const might_not = [
  "Most districts won't have enough engaged residents to fill Witness seats, especially at the municipal level.",
  "The format requires people to write sourced, structured posts. That's a higher bar than a retweet or a comment.",
  "Without virality, it's hard to reach the critical mass where an office page feels alive rather than abandoned.",
  "A motivated political actor could run for Witness and use the seat to push a slanted account. Elections constrain this, but don't eliminate it.",
];

export function LandingProspects() {
  return (
    <section className="bg-bc-light-lavender">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-10">
          <div>
            <h2 className="font-serif text-xl text-bc-navy mb-5">
              Why it might work
            </h2>
            <ul className="flex flex-col gap-3">
              {might_work.map((item, i) => (
                <li key={i} className="text-sm text-bc-navy leading-relaxed flex gap-3">
                  <span className="text-bc-lavender select-none mt-0.5">—</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="font-serif text-xl text-bc-navy mb-5">
              Why it might not
            </h2>
            <ul className="flex flex-col gap-3">
              {might_not.map((item, i) => (
                <li key={i} className="text-sm text-bc-navy leading-relaxed flex gap-3">
                  <span className="text-bc-lavender select-none mt-0.5">—</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
