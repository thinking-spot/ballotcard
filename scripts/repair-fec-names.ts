// One-time backfill: repair already-ingested FEC candidate display names.
//
// Rows inserted before the normalizeName rewrite (scripts/lib/fec.ts) carry the
// old formatter's damage: undotted initials ("William P Abel"), generational
// suffixes stranded mid-string and miscased ("Steven Clay Jr Dowell", "Rushern L
// Iii Baker"), and honorifics the old stripper missed ("John R Rep. Carter",
// "Sen. John Boozman"). This rewrites them in place to match what fec.ts now
// emits: "First M. Last Suffix".
//
// It is a *display-string* repair, not a re-normalize — we no longer have the raw
// "LAST, FIRST" FEC strings, so we reconstruct from the stored form using the
// old formatter's one reliable invariant: the surname is the final token. The
// next real `npm run ingest` re-normalizes from source and will agree with these
// values (a couple of nobiliary-particle surnames may re-case, e.g. "De La" →
// "De la"; harmless one-row churn).
//
// Idempotent: re-running finds nothing to change. Dry-run by default.
//
//   npx tsx --env-file=.env.local scripts/repair-fec-names.ts          # preview
//   npx tsx --env-file=.env.local scripts/repair-fec-names.ts --apply  # write

import { db } from "./lib/supabase-client";

const APPLY = process.argv.includes("--apply");

const HONORIFICS = new Set(["DR", "MR", "MRS", "MS", "MISS", "HON", "REP", "SEN", "REV"]);
const SUFFIXES: Record<string, string> = {
  JR: "Jr.", SR: "Sr.", II: "II", III: "III", IV: "IV", V: "V",
};
const bare = (t: string) => t.replace(/[.,]/g, "").toUpperCase();

/**
 * Repair one stored display name. The surname is the last token (old-formatter
 * invariant); honorifics are dropped, generational suffixes are moved to the end
 * with canonical casing, and single-letter initials gain a period.
 */
export function repairDisplayName(stored: string): string {
  // Names never legitimately contain commas in display form; old data sometimes
  // left one in ("Jerry Lee, Jr Carl"). Treat as a separator.
  const tokens = stored.replace(/,/g, " ").trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return stored;

  const suffixes: string[] = [];
  // Peel trailing suffixes first (handles "Emanuel Cleaver Ii" → suffix II).
  while (tokens.length > 1 && SUFFIXES[bare(tokens[tokens.length - 1])]) {
    suffixes.unshift(SUFFIXES[bare(tokens.pop()!)]);
  }
  const surname = tokens.pop()!; // last remaining token is the surname

  const given: string[] = [];
  tokens.forEach((t, i) => {
    const b = bare(t);
    if (HONORIFICS.has(b)) return; // drop honorific
    // Multi-letter suffixes (JR/SR/II/III/IV) relocate from any interior slot.
    if (SUFFIXES[b] && b.length >= 2) {
      suffixes.push(SUFFIXES[b]);
      return;
    }
    // A lone trailing "V" (no period) is a suffix — fec.ts peels it the same way.
    // A lone "I" is NOT a suffix (there is no "Smith I"); it is a middle initial,
    // and a dotted "V." is an initial too. Both fall through to dotting below.
    if (SUFFIXES[b] && b.length === 1 && i === tokens.length - 1 && !t.includes(".")) {
      suffixes.push(SUFFIXES[b]);
      return;
    }
    given.push(/^[A-Za-z]$/.test(t) ? `${t}.` : t);
  });

  return [given.join(" "), surname, ...suffixes].filter(Boolean).join(" ").trim();
}

type Row = { id: string; office_id: string; cycle: number; name: string };

async function main() {
  console.log(`=== FEC name repair (${APPLY ? "APPLY" : "DRY RUN"}) ===\n`);

  const rows: Row[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await db
      .from("Candidates")
      .select("id, office_id, cycle, name")
      .eq("source", "fec")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    rows.push(...(data as Row[]));
    if (data.length < 1000) break;
    from += 1000;
  }
  console.log(`Loaded ${rows.length} fec rows.`);

  // Names already in use per (office_id, cycle) — to dodge the UNIQUE(office_id,
  // cycle, name) constraint when a repair would collide with a sibling row.
  const takenByGroup = new Map<string, Set<string>>();
  for (const r of rows) {
    const g = `${r.office_id}::${r.cycle}`;
    if (!takenByGroup.has(g)) takenByGroup.set(g, new Set());
    takenByGroup.get(g)!.add(r.name);
  }

  const updates: Array<{ id: string; from: string; to: string }> = [];
  let skipped = 0;
  for (const r of rows) {
    const repaired = repairDisplayName(r.name);
    if (repaired === r.name) continue;
    const taken = takenByGroup.get(`${r.office_id}::${r.cycle}`)!;
    if (taken.has(repaired)) {
      skipped++;
      console.log(`  SKIP (collision) "${r.name}" → "${repaired}"`);
      continue;
    }
    taken.delete(r.name);
    taken.add(repaired);
    updates.push({ id: r.id, from: r.name, to: repaired });
  }

  console.log(`\n${updates.length} to repair, ${skipped} skipped (UNIQUE collision).\n`);
  for (const u of updates.slice(0, 80)) console.log(`  "${u.from}" → "${u.to}"`);
  if (updates.length > 80) console.log(`  …and ${updates.length - 80} more`);

  if (!APPLY || updates.length === 0) {
    console.log(
      APPLY ? "\nNothing to repair." : `\nDRY RUN — no writes. Re-run with --apply to repair ${updates.length} rows.`
    );
    return;
  }

  let n = 0;
  for (const u of updates) {
    const { error } = await db.from("Candidates").update({ name: u.to }).eq("id", u.id);
    if (error) throw new Error(`update ${u.id} failed: ${error.message}`);
    n++;
  }
  console.log(`\nRepaired ${n} rows.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
