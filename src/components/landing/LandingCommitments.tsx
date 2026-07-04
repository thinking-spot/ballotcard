const commitments = [
  {
    label: "Your government, on one page.",
    body: "Most of us can name the president. Very few of us can name our state representative, our county sheriff, and everyone in between — yet we vote for all of them. BallotCard puts the whole roster in one place, so the government that belongs to all of us is one you can actually see.",
  },
  {
    label: "Built to get out the vote.",
    body: "Turnout falls the further down the ballot you go, mostly because it's hard to find out what's even on it. When you can see every race you vote in, who's running, and when each election happens, showing up gets a lot easier. That's the whole goal.",
  },
  {
    label: "Well informed, from public data.",
    body: "Everything here is assembled from sources the public already owns — the US Census, congressional rosters, the Federal Election Commission, state election filings. We turn what's public into something readable, and every fact links back to where it came from.",
  },
  {
    label: "Free to use, for everyone, always.",
    body: "No account, no ads, no charge — free the way a public library is free. Operating costs are covered by the maintainer. Nothing here is for sale, and nothing ever will be.",
  },
  {
    label: "Private by design.",
    body: "Your address becomes your districts and is immediately discarded — never stored, never logged. The site is built to have nothing to know about you, and it's open source, so you can check.",
  },
];

export function LandingCommitments() {
  return (
    <section className="bg-bc-offwhite">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <h2 className="font-serif text-2xl text-bc-navy mb-10">
          A civic utility
        </h2>

        <div className="flex flex-col gap-6 max-w-2xl">
          {commitments.map((item) => (
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
