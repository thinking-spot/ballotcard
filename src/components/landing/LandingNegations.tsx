const negations = [
  {
    label: "No algorithm.",
    body: "There is no feed, no ranking, no trending, no engagement optimization. Posts appear in the order they were written. The archive is navigated by district and office, not by what the platform decided you should see next.",
  },
  {
    label: "No ads.",
    body: "BallotCard is not monetized. Operating costs are covered by the maintainer. If donations are ever accepted, they are capped at costs. Nothing is for sale here.",
  },
  {
    label: "No email required.",
    body: "Sign up with a username and password. No real name, no email address, no phone number. Pseudonymous by design. The users who need protection have it; the content they produce is meant to be seen.",
  },
  {
    label: "No authority.",
    body: "Witnesses cannot compel anything. They cannot fine, subpoena, or legislate. What they can do is publish a sourced account of what their official did and make it permanently findable. That is the whole mechanism.",
  },
  {
    label: "No engagement optimization.",
    body: "No notifications, no streaks, no karma, no follower counts visible as status. The platform does not try to keep you here longer than your civic interest does. Come when something happens, leave when you have read it.",
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
