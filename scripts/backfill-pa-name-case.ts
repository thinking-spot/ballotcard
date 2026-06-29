// One-time backfill: re-case already-ingested PA Secretary-of-State candidate
// names. PA publishes its roster in ALL CAPS ("JANE DOE"); the parser now runs
// names through toDisplayCase ("Jane Doe"), but rows inserted before that change
// are still upper-case. This rewrites them in place.
//
// Idempotent: toDisplayCase no-ops on names that already have mixed case, so a
// second run finds nothing to do. Dry-run by default; pass --apply to write.
//
//   npx tsx --env-file=.env.local scripts/backfill-pa-name-case.ts          # preview
//   npx tsx --env-file=.env.local scripts/backfill-pa-name-case.ts --apply  # write

import { db } from "./lib/supabase-client";
import { toDisplayCase } from "./lib/name-case";

const APPLY = process.argv.includes("--apply");

async function main() {
  console.log(`=== PA name-case backfill (${APPLY ? "APPLY" : "DRY RUN"}) ===\n`);

  const rows: Array<{ id: string; name: string }> = [];
  let from = 0;
  for (;;) {
    const { data, error } = await db
      .from("Candidates")
      .select("id, name")
      .eq("source", "pa_sos")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    rows.push(...(data as Array<{ id: string; name: string }>));
    if (data.length < 1000) break;
    from += 1000;
  }
  console.log(`Loaded ${rows.length} pa_sos rows.`);

  const updates = rows
    .map((r) => ({ id: r.id, from: r.name, to: toDisplayCase(r.name) }))
    .filter((u) => u.to !== u.from);

  console.log(`${updates.length} need re-casing.\n`);
  for (const u of updates.slice(0, 60)) console.log(`  "${u.from}" → "${u.to}"`);
  if (updates.length > 60) console.log(`  …and ${updates.length - 60} more`);

  if (!APPLY || updates.length === 0) {
    console.log(
      APPLY ? "\nNothing to update." : `\nDRY RUN — no writes. Re-run with --apply to update ${updates.length} rows.`
    );
    return;
  }

  let n = 0;
  for (const u of updates) {
    const { error } = await db.from("Candidates").update({ name: u.to }).eq("id", u.id);
    if (error) throw new Error(`update ${u.id} failed: ${error.message}`);
    n++;
  }
  console.log(`\nUpdated ${n} rows.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
