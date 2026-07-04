const covered_now = [
  "President and Vice President.",
  "US Senate and US House — every member, from public congressional rosters.",
  "Governors and statewide executives — attorney general, secretary of state, treasurer, and more.",
  "State legislatures — every state senate and house seat, via Open States.",
  "2026 candidates — declared candidates for federal and state legislative races in every state holding one, from FEC data, state election filings, and Ballotpedia.",
  "Election dates for every seat — including staggered state senate terms, resolved seat by seat.",
  "Every county — all 3,143 have a permanent page with the ballot as seen from there.",
];

const coming = [
  "Elected state judges and retention elections.",
  "Sheriffs, district attorneys, and county officeholders.",
  "Mayors, city councils, and school boards, beyond the largest cities.",
  "An activity record for each official — votes, floor statements, and hearings.",
];

export function LandingProspects() {
  return (
    <section className="bg-bc-light-lavender">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-10">
          <div>
            <h2 className="font-serif text-xl text-bc-navy mb-5">
              On your card today
            </h2>
            <ul className="flex flex-col gap-3">
              {covered_now.map((item, i) => (
                <li key={i} className="text-sm text-bc-navy leading-relaxed flex gap-3">
                  <span className="text-bc-lavender select-none mt-0.5">—</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="font-serif text-xl text-bc-navy mb-5">
              Next up — already on your card as honest empty rows
            </h2>
            <ul className="flex flex-col gap-3">
              {coming.map((item, i) => (
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
