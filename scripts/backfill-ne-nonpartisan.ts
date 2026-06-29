// One-time backfill: Nebraska's Legislature is unicameral and officially
// NONPARTISAN — senators run without party labels on the general-election
// ballot. Offices ingested before the ingest.ts fix were classified
// "elected_partisan" like every other state's upper chamber. This flips the 49
// NE state-senate offices to "elected_nonpartisan".
//
// PostgREST can't do a join-filtered UPDATE, so we resolve the office ids via an
// embedded join on Districts.state = 'NE', then update by id. Idempotent: rows
// already nonpartisan are skipped. Dry-run by default.
//
//   npx tsx --env-file=.env.local scripts/backfill-ne-nonpartisan.ts          # preview
//   npx tsx --env-file=.env.local scripts/backfill-ne-nonpartisan.ts --apply  # write

import { db } from "./lib/supabase-client";

const APPLY = process.argv.includes("--apply");

async function main() {
  console.log(`=== NE nonpartisan backfill (${APPLY ? "APPLY" : "DRY RUN"}) ===\n`);

  const { data, error } = await db
    .from("Offices")
    .select("id, title, selection_method, Districts!inner(state)")
    .eq("slug", "state-senate")
    .eq("Districts.state", "NE");
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Array<{ id: string; title: string; selection_method: string }>;
  console.log(`Found ${rows.length} NE state-senate offices.`);

  const toFix = rows.filter((r) => r.selection_method !== "elected_nonpartisan");
  console.log(`${toFix.length} need fixing (→ elected_nonpartisan).\n`);
  for (const r of toFix) console.log(`  ${r.title}  [${r.selection_method} → elected_nonpartisan]`);

  if (!APPLY || toFix.length === 0) {
    console.log(
      APPLY ? "\nNothing to fix." : `\nDRY RUN — no writes. Re-run with --apply to update ${toFix.length} rows.`
    );
    return;
  }

  let n = 0;
  for (const r of toFix) {
    const { error: uerr } = await db
      .from("Offices")
      .update({ selection_method: "elected_nonpartisan" })
      .eq("id", r.id);
    if (uerr) throw new Error(`update ${r.id} failed: ${uerr.message}`);
    n++;
  }
  console.log(`\nUpdated ${n} offices.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
