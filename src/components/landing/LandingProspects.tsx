const covered_now = [
  "President and Vice President.",
  "US Senate and US House — sourced from the unitedstates/congress-legislators project.",
  "Governors and statewide executives — attorney general, secretary of state, treasurer, and more.",
  "State legislatures — every state senate and house seat, via Open States.",
];

const coming = [
  "Elected state judges and retention elections.",
  "Sheriffs, district attorneys, and county offices.",
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
              Coming, shown as honest empty rows
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
