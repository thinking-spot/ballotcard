import { db } from "@/lib/supabase";
import { LAYER_ORDER, LAYER_LABELS } from "@/lib/district-data";
import { COUNTY_TEMPLATES, MUNICIPAL_TEMPLATES } from "@/lib/ballot-templates";

// The set of district identifiers a ballot card is built from. These are facts
// about *places*, never about a person — safe to put in a URL and localStorage.
export type CardGeographies = {
  state: string; // two-letter code, lowercased for slugs (e.g. "nc")
  cd?: string; // congressional district number, zero-padded (e.g. "07")
  su?: string; // state legislative upper district number
  sl?: string; // state legislative lower district number
  county?: string; // county geo_slug tail or fips (best-effort)
  place?: string; // municipality geo_slug tail (best-effort)
  countyName?: string; // human-readable county name from the geocoder
  placeName?: string; // human-readable place name from the geocoder
};

export type CardOffice = {
  id: string;
  title: string;
  slug: string;
  href?: string; // absent for template-only rows (no permalink yet)
  branch: string;
  level: string;
  selectionMethod: string;
  nextElectionAt?: string;
  officialName?: string;
  officialParty?: string;
  officialPhotoUrl?: string;
  /** When true, this is a synthesized template row — no DB record exists. */
  placeholder?: boolean;
};

export type CardSection = {
  level: string;
  label: string;
  offices: CardOffice[];
};

export type BallotCard = {
  geographies: CardGeographies;
  stateName?: string;
  sections: CardSection[];
  dataAsOf?: string;
};

// State legislative district slug convention — shared with ingestion.
export function sldUpperSlug(state: string, num: string): string {
  return `${state.toLowerCase()}/sldu-${num}`;
}
export function sldLowerSlug(state: string, num: string): string {
  return `${state.toLowerCase()}/sldl-${num}`;
}

/**
 * Build the ballot card for a set of resolved geographies. Collects every office
 * in the resident's districts (federal → municipal), each with its current
 * officeholder, grouped into ballot-order sections.
 */
export async function getBallotCard(
  geo: CardGeographies
): Promise<BallotCard | null> {
  const state = geo.state.toLowerCase();

  // District geo_slugs that make up this resident's ballot.
  const slugs: string[] = ["us", state];
  if (geo.cd) slugs.push(`${state}/${geo.cd}`);
  if (geo.su) slugs.push(sldUpperSlug(state, geo.su));
  if (geo.sl) slugs.push(sldLowerSlug(state, geo.sl));
  if (geo.county) slugs.push(geo.county.includes("/") ? geo.county : `${state}/${geo.county}`);
  if (geo.place) slugs.push(geo.place.includes("/") ? geo.place : `${state}/${geo.place}`);

  // 1. Resolve districts
  const { data: districts } = await db
    .from("Districts")
    .select("id, name, geo_slug, kind, state")
    .in("geo_slug", slugs);

  if (!districts || districts.length === 0) return null;

  const districtById = new Map(
    districts.map((d) => [d.id as string, d as Record<string, unknown>])
  );
  const districtIds = districts.map((d) => d.id as string);

  const stateRow = districts.find((d) => d.geo_slug === state);

  // 2. Offices in those districts that render on a ballot card
  //    (elected_* and retention; appointed offices are excluded here).
  const { data: officesRaw } = await db
    .from("Offices")
    .select(
      "id, title, slug, branch, level, selection_method, next_election_at, district_id"
    )
    .in("district_id", districtIds)
    .not("slug", "is", null)
    .neq("selection_method", "appointed")
    .order("title");

  const offices = officesRaw ?? [];
  const officeIds = offices.map((o) => o.id as string);

  // 3. Current officials + latest ingestion stamp (parallel)
  const [officialsResult, ingestionResult] = await Promise.all([
    officeIds.length > 0
      ? db
          .from("Officials")
          .select("office_id, name, party, photo_url")
          .in("office_id", officeIds)
          .eq("is_current", true)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    db
      .from("IngestionRuns")
      .select("finished_at")
      .eq("status", "succeeded")
      .order("finished_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const officialByOffice = new Map<string, Record<string, unknown>>();
  for (const o of (officialsResult.data ?? []) as Record<string, unknown>[]) {
    officialByOffice.set(o.office_id as string, o);
  }

  // 4. Assemble offices with their district hrefs
  const cardOffices: CardOffice[] = offices.map((o) => {
    const district = districtById.get(o.district_id as string);
    const geoSlug = district?.geo_slug as string;
    const official = officialByOffice.get(o.id as string);
    return {
      id: o.id as string,
      title: o.title as string,
      slug: o.slug as string,
      href: `/${geoSlug}/${o.slug}`,
      branch: o.branch as string,
      level: o.level as string,
      selectionMethod: o.selection_method as string,
      nextElectionAt: (o.next_election_at as string) || undefined,
      officialName: (official?.name as string) || undefined,
      officialParty: (official?.party as string) || undefined,
      officialPhotoUrl: (official?.photo_url as string) || undefined,
    };
  });

  // 5. Group into ballot-order sections
  const byLevel = new Map<string, CardOffice[]>();
  for (const office of cardOffices) {
    const level = office.level ?? "special";
    if (!byLevel.has(level)) byLevel.set(level, []);
    byLevel.get(level)!.push(office);
  }

  // 6. Synthesize honest empty rows from templates. The Census Geocoder gives
  //    us the county/place name even when we have no district row — using that,
  //    we render Sheriff/DA/Mayor as placeholder rows so the user sees their
  //    complete ballot rather than silently truncated sections.
  const existingSlugs = (level: string) =>
    new Set((byLevel.get(level) ?? []).map((o) => o.slug));

  if (geo.countyName) {
    const countySlugs = existingSlugs("county");
    for (const t of COUNTY_TEMPLATES) {
      if (countySlugs.has(t.slug)) continue;
      if (!byLevel.has("county")) byLevel.set("county", []);
      byLevel.get("county")!.push({
        id: `tmpl-county-${t.slug}`,
        title: t.title(geo.countyName),
        slug: t.slug,
        branch: t.branch,
        level: t.level,
        selectionMethod: t.selectionMethod,
        placeholder: true,
      });
    }
  }

  if (geo.placeName) {
    const muniSlugs = existingSlugs("municipal");
    for (const t of MUNICIPAL_TEMPLATES) {
      if (muniSlugs.has(t.slug)) continue;
      if (!byLevel.has("municipal")) byLevel.set("municipal", []);
      byLevel.get("municipal")!.push({
        id: `tmpl-muni-${t.slug}`,
        title: t.title(geo.placeName),
        slug: t.slug,
        branch: t.branch,
        level: t.level,
        selectionMethod: t.selectionMethod,
        placeholder: true,
      });
    }
  }

  const sections: CardSection[] = LAYER_ORDER.filter((l) => byLevel.has(l)).map(
    (level) => ({
      level,
      label: LAYER_LABELS[level] ?? level,
      offices: byLevel.get(level)!,
    })
  );

  return {
    geographies: geo,
    stateName: (stateRow?.name as string) || undefined,
    sections,
    dataAsOf:
      (ingestionResult.data?.finished_at as string | undefined) || undefined,
  };
}
