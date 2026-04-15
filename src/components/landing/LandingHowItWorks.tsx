const cards = [
  {
    title: "Your ballot card",
    body: "Sign up and pick your home district. BallotCard shows you every office on your ballot — federal, state, county, and municipal — stacked in ballot order on one page. This is your organizing view.",
  },
  {
    title: "The Witness",
    body: "For each office, residents of that district can elect a Witness: a volunteer who watches the official, posts updates, and keeps a public record. Witnesses have zero governmental authority. Their job is attention.",
  },
  {
    title: "The thread",
    body: "Witnesses post sourced updates, residents reply and push back. Threads are threaded, permalinked, and permanent. No algorithmic ranking. Oldest-first by default, like a public record should be.",
  },
  {
    title: "The next election",
    body: "Witnesses serve a fixed term and face re-election from their own district's residents. Good Witnesses get re-elected. Bad ones don't. The same self-regulating mechanism applies at every level.",
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
