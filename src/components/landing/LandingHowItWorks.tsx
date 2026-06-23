const cards = [
  {
    title: "Enter your address",
    body: "We send it to the US Census Geocoder to find your voting districts, then discard it. Nothing about you is stored or logged — your address never touches our database.",
  },
  {
    title: "See your full ballot",
    body: "Every office you vote for — federal, state, county, and municipal — stacked in ballot order on one page. Who holds each seat now, their party, and when the seat is next on the ballot.",
  },
  {
    title: "Honest about the gaps",
    body: "Where there's no data source yet for an office, the row is still shown — as an honest empty slot, not hidden. Your ballot is the complete one from the booth, not just the parts we've filled in.",
  },
  {
    title: "Permanent and shareable",
    body: "Every office and officeholder has a permalink you can bookmark, share, and find again. No feed, no ranking, no engagement metrics. A civic reference that stays put.",
  },
];

export function LandingHowItWorks() {
  return (
    <section className="bg-bc-light-lavender">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <h2 className="font-serif text-2xl text-bc-navy mb-10">How it works</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {cards.map((card) => (
            <div
              key={card.title}
              className="bg-bc-offwhite rounded p-6 border border-bc-light-lavender"
            >
              <h3 className="font-serif text-base text-bc-navy mb-2">
                {card.title}
              </h3>
              <p className="text-sm text-bc-navy leading-relaxed">{card.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
