export const metadata = {
  title: "Terms",
  description:
    "The terms of use for BallotCard, a free civic information utility provided as-is with no account and no warranty.",
};

export default function TermsPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16">
      <h1 className="font-serif text-2xl text-bc-navy mb-6">Terms of service</h1>

      <div className="flex flex-col gap-5 text-sm text-bc-navy leading-relaxed">
        <p>
          BallotCard is a free civic information service. Using it costs
          nothing and requires no account. These terms are short because the
          service is simple.
        </p>

        <h2 className="font-serif text-lg mt-3">About the data</h2>
        <p>
          Everything on BallotCard is compiled from public sources — the US
          Census, congressional rosters, OpenStates, the Federal Election
          Commission, and state election filings — and each page links to its
          sources and shows when its data was last updated. We work to keep it
          accurate, but public data can lag or contain errors, and offices we
          have no source for yet are shown as honest empty rows.
        </p>
        <p>
          BallotCard is not official election material. Before you vote, confirm
          your registration, polling place, and ballot with your state or local
          election office.
        </p>

        <h2 className="font-serif text-lg mt-3">Independence</h2>
        <p>
          BallotCard is not affiliated with any government body, political
          party, campaign, or candidate, and it does not endorse anyone. It is
          maintained as a public service and is never monetized — no ads, no
          data sales, no paid placement.
        </p>

        <h2 className="font-serif text-lg mt-3">Use of the service</h2>
        <p>
          The service is provided as-is, without warranty of any kind. Every
          page is public and permanent — you are welcome to link, share, cite,
          and index anything here.
        </p>

        <h2 className="font-serif text-lg mt-3">Corrections</h2>
        <p>
          If you spot something wrong — a stale officeholder, a missing
          candidate, a district mix-up — please report it on{" "}
          <a
            href="https://github.com/thinking-spot/ballotcard/issues"
            className="underline underline-offset-2 hover:text-bc-lavender transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
          . Corrections are the one contribution we ask of our readers.
        </p>
      </div>
    </div>
  );
}
