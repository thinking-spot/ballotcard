const cards = [
  {
    title: "Enter your address",
    body: "The US Census Geocoder — a free public service — turns it into your voting districts, and then we discard it. Where you live is the only thing we ask, because it's the only thing your ballot depends on.",
  },
  {
    title: "See your full ballot",
    body: "Every office you vote for — federal, state, county, and municipal — stacked in ballot order on one page. Who holds each seat now, their party, and when the seat is next on the ballot.",
  },
  {
    title: "Know your next election",
    body: "Election dates for every seat, with the declared candidates as they file — party, incumbent or challenger, and for federal races, campaign fundraising from the FEC. Refreshed weekly through election season.",
  },
  {
    title: "Keep it, share it",
    body: "Your card and every office on it have permanent links you can bookmark, text to a neighbor, and find again next cycle. A civic reference that stays put.",
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
