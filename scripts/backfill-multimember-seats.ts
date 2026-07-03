// One-time backfill: relabel the existing single Office row for districts
// that assignLegislativeSeats now recognizes as genuinely multi-member
// (migration 0011: AZ/MD/NH/NJ/ND/SD/VT/WA House, VT/WV Senate elect 2-3
// members at-large from one district). Before the fix, ingestion silently
// kept only one of those legislators; the office that DOES exist has
// seat_label = NULL. This backfill matches that office's current Official
// name against the correctly-sorted seat list and relabels it to the "Seat
// N" it actually represents — so the next `npm run ingest` creates only the
// *missing* seats instead of orphaning a duplicate under seat_label NULL.
//
// Idempotent: offices that already carry a seat_label are left alone.
// Dry-run by default.
//
//   npx tsx --env-file=.env.local scripts/backfill-multimember-seats.ts          # preview
//   npx tsx --env-file=.env.local scripts/backfill-multimember-seats.ts --apply  # write

import { db } from "./lib/supabase-client";
import { fetchOpenStatesPeople } from "./lib/openstates";
import { assignLegislativeSeats } from "./lib/multimember-seats";
import { US_STATES, sldUpperSlug, sldLowerSlug } from "./lib/us-states";

const APPLY = process.argv.includes("--apply");

async function selectAll<T = Record<string, unknown>>(
  table: string,
  columns: string,
  filters?: Array<[string, unknown]>
): Promise<T[]> {
  const PAGE = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    let query = db.from(table).select(columns);
    for (const [col, val] of filters ?? []) query = query.eq(col, val);
    const { data, error } = await query.order("id").range(from, from + PAGE - 1);
    if (error) throw new Error(`${table} select failed: ${error.message}`);
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

async function main() {
  console.log(`=== Multi-member seat backfill (${APPLY ? "APPLY" : "DRY RUN"}) ===\n`);

  const openStatesByState = new Map<string, Awaited<ReturnType<typeof fetchOpenStatesPeople>>>();
  for (const s of US_STATES) {
    openStatesByState.set(s.abbr, await fetchOpenStatesPeople(s.abbr));
  }

  const assignments = assignLegislativeSeats(US_STATES, openStatesByState);
  const multiMember = assignments.filter((a) => a.seatLabel !== null);
  console.log(`${multiMember.length} seats belong to genuinely multi-member districts.\n`);

  const districts = await selectAll<{ id: string; geo_slug: string }>(
    "Districts",
    "id, geo_slug"
  );
  const districtIdBySlug = new Map(districts.map((d) => [d.geo_slug, d.id]));

  const offices = await selectAll<{
    id: string;
    district_id: string;
    slug: string;
    seat_label: string | null;
  }>("Offices", "id, district_id, slug, seat_label");
  const officesByDistrictSlug = new Map<string, typeof offices>();
  for (const o of offices) {
    if (o.slug !== "state-house" && o.slug !== "state-senate") continue;
    const key = `${o.district_id}::${o.slug}`;
    if (!officesByDistrictSlug.has(key)) officesByDistrictSlug.set(key, []);
    officesByDistrictSlug.get(key)!.push(o);
  }

  const officials = await selectAll<{ office_id: string; name: string }>(
    "Officials",
    "office_id, name",
    [["is_current", true]]
  );
  const currentNameByOffice = new Map(officials.map((o) => [o.office_id, o.name]));

  // Group target seat assignments by (geoSlug, slug) so we process one real
  // district at a time.
  const byDistrict = new Map<string, typeof multiMember>();
  for (const a of multiMember) {
    const geoSlug =
      a.person.current_chamber === "upper"
        ? sldUpperSlug(a.state, a.person.current_district)
        : sldLowerSlug(a.state, a.person.current_district);
    const slug = a.person.current_chamber === "upper" ? "state-senate" : "state-house";
    const key = `${geoSlug}::${slug}`;
    if (!byDistrict.has(key)) byDistrict.set(key, []);
    byDistrict.get(key)!.push(a);
  }

  const updates: Array<{ officeId: string; label: string; districtSlug: string; name: string }> = [];
  const unresolved: string[] = [];

  for (const [key, seats] of byDistrict) {
    const [geoSlug, slug] = key.split("::");
    const districtId = districtIdBySlug.get(geoSlug);
    if (!districtId) {
      unresolved.push(`${key}: no district found`);
      continue;
    }
    const districtOffices = officesByDistrictSlug.get(`${districtId}::${slug}`) ?? [];
    const alreadyLabeled = new Set(
      districtOffices.filter((o) => o.seat_label).map((o) => o.seat_label)
    );
    const unlabeled = districtOffices.filter((o) => !o.seat_label);
    if (unlabeled.length === 0) continue; // fully migrated already, or never existed pre-fix

    for (const office of unlabeled) {
      const currentName = currentNameByOffice.get(office.id);
      if (!currentName) {
        unresolved.push(`${key}: office ${office.id} has no current official to match`);
        continue;
      }
      const match = seats.find(
        (s) => s.person.name === currentName && !alreadyLabeled.has(s.seatLabel!)
      );
      if (!match) {
        unresolved.push(`${key}: no seat match for existing official "${currentName}"`);
        continue;
      }
      updates.push({
        officeId: office.id,
        label: match.seatLabel!,
        districtSlug: key,
        name: currentName,
      });
    }
  }

  console.log(`${updates.length} offices to relabel:\n`);
  for (const u of updates) {
    console.log(`  ${u.districtSlug}: "${u.name}" → seat_label = ${u.label}`);
  }
  if (unresolved.length > 0) {
    console.log(`\n${unresolved.length} unresolved (left untouched, needs manual look):`);
    for (const m of unresolved) console.log(`  ${m}`);
  }

  if (!APPLY) {
    console.log(`\nDRY RUN — no writes. Re-run with --apply to write ${updates.length} updates.`);
    return;
  }

  for (const u of updates) {
    const { error } = await db
      .from("Offices")
      .update({ seat_label: u.label })
      .eq("id", u.officeId);
    if (error) throw new Error(`update ${u.officeId} failed: ${error.message}`);
  }
  console.log(`\nRelabeled ${updates.length} offices.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
