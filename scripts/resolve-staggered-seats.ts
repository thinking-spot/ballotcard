// CLI wrapper around resolveStaggeredSeats — the same derivation the pipeline
// runs after every full ingest and candidate scrape, exposed for one-off runs
// and backfills. Dry-run by default; --apply to write.
//
//   npx tsx --env-file=.env.local scripts/resolve-staggered-seats.ts          # preview
//   npx tsx --env-file=.env.local scripts/resolve-staggered-seats.ts --apply  # write

import { resolveStaggeredSeats } from "./lib/resolve-staggered";

const APPLY = process.argv.includes("--apply");

resolveStaggeredSeats({ dryRun: !APPLY })
  .then((r) => {
    console.log(
      `\n${APPLY ? "Applied" : "DRY RUN — re-run with --apply to write"}: ` +
        `${r.staggeredSeats} staggered seats, ${r.seatsWithFilings} with qualifying filings, ` +
        `${r.resolved} resolved to exact, ${r.reverted} reverted to estimated` +
        (r.lockstepMismatches > 0 ? `, ${r.lockstepMismatches} skipped (date/schedule mismatch)` : "") +
        "."
    );
    process.exit(r.guardTripped ? 1 : 0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
