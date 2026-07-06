import { db } from "@/lib/supabase";
import type { BreadcrumbItem } from "@/lib/office-data";
import { seatLabelToSlug } from "@/lib/seat-slug";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DistrictOffice = {
  id: string;
  title: string;
  slug: string;
  branch: string;
  level: string;
  selectionMethod: string;
  districtGeoSlug: string;
  officialName?: string;
  officialParty?: string;
  nextElectionAt?: string;
  // Set only in multi-member districts, where several offices share one slug
  // and this office's URL needs a trailing /seat-n segment — see seat-slug.ts.
  seatSlug?: string;
};

export type ChildDistrict = {
  id: string;
  name: string;
  kind: string;
  geoSlug: string;
  officeCount: number;
};

export type DistrictPageData = {
  district: {
    id: string;
    name: string;
    kind: string;
    geoSlug: string;
    state?: string;
  };
  breadcrumbs: BreadcrumbItem[];
  offices: DistrictOffice[];
  childDistricts: ChildDistrict[];
  parentDistrict?: { name: string; geoSlug: string };
  // When set, indicates these offices were pulled in from an ancestor district
  // (e.g. a county page showing federal + statewide offices). UI uses this to
  // render the "enter your address for your exact districts" CTA honestly.
  aggregatedFrom?: "state";
  // ISO timestamp of the most recent successful ingestion run — drives the
  // "Data as of …" provenance line (CLAUDE.md: every page shows "data as of").
  dataAsOf?: string;
};

// ─── Layer classification ─────────────────────────────────────────────────────
// Maps an office `level` to the ballot-card section it belongs in.

export const LAYER_ORDER = ["federal", "state", "county", "municipal", "special"];

export const LAYER_LABELS: Record<string, string> = {
  federal: "Federal",
  state: "State",
  county: "County",
  municipal: "Municipal",
  special: "Other",
};

// ─── Breadcrumb builder ─────────────────────────────────────────────────────

function buildDistrictBreadcrumbs(
  ancestors: Array<{ name: string; geo_slug: string }>,
  districtName: string
): BreadcrumbItem[] {
  const items: BreadcrumbItem[] = [];
  for (const anc of ancestors) {
    items.push({ label: anc.name, href: `/${anc.geo_slug}` });
  }
  items.push({ label: districtName, href: "" }); // current page
  return items;
}

// ─── Main data fetcher ──────────────────────────────────────────────────────

export async function getDistrictPageData(
  geoSlug: string
): Promise<DistrictPageData | null> {
  // 1. District with parent chain (3 levels for breadcrumbs)
  const { data: districtRaw } = await db
    .from("Districts")
    .select(
      `id, name, kind, geo_slug, state,
       parent:parent_id(
         id, name, geo_slug,
         parent:parent_id(id, name, geo_slug)
       )`
    )
    .eq("geo_slug", geoSlug)
    .single();

  if (!districtRaw) return null;

  type ParentRow = { id: string; name: string; geo_slug: string; parent?: ParentRow | null };
  const parent = districtRaw.parent as unknown as ParentRow | null;

  const ancestors: Array<{ name: string; geo_slug: string }> = [];
  if (parent) {
    if (parent.parent) ancestors.push(parent.parent);
    ancestors.push(parent);
  }

  const breadcrumbs = buildDistrictBreadcrumbs(
    ancestors,
    districtRaw.name as string
  );

  // 2. Offices directly in this district + child districts (parallel).
  //
  // County pages are a special case: they pull in federal + statewide offices
  // from their ancestors so the page is useful even though no county-level
  // offices are seeded yet. The country (`us`) row contributes the federal
  // executives (President/VP); the parent state contributes governor, US
  // senators, statewide execs. The page renders an "enter your address for
  // your exact districts" CTA because we deliberately omit the address-bound
  // layers (CD, SLDU, SLDL) from this view.
  const aggregateForCounty = districtRaw.kind === "county" && parent;
  const officeDistrictIds = aggregateForCounty
    ? [
        "00000000-0000-0000-0000-000000000001", // US country row
        parent.id,
        districtRaw.id,
      ]
    : [districtRaw.id];

  const [{ data: officesRaw }, { data: childrenRaw }] = await Promise.all([
    db
      .from("Offices")
      .select(
        "id, title, slug, branch, level, selection_method, next_election_at, district_id, seat_label"
      )
      .in("district_id", officeDistrictIds)
      .not("slug", "is", null)
      .order("title"),
    db
      .from("Districts")
      .select("id, name, kind, geo_slug")
      .eq("parent_id", districtRaw.id)
      .order("name"),
  ]);

  const officeIds = (officesRaw ?? []).map((o) => o.id as string);
  const childIds = (childrenRaw ?? []).map((c) => c.id as string);

  // 3. Current officials for these offices + office counts per child (parallel)
  type Row = Record<string, unknown>;
  const [officialsResult, childOfficesResult, lastRunResult] = await Promise.all([
    officeIds.length > 0
      ? db
          .from("Officials")
          .select("office_id, name, party")
          .in("office_id", officeIds)
          .eq("is_current", true)
      : Promise.resolve({ data: [] as Row[] }),
    childIds.length > 0
      ? db
          .from("Offices")
          .select("district_id")
          .in("district_id", childIds)
          .not("slug", "is", null)
      : Promise.resolve({ data: [] as Row[] }),
    // Provenance: timestamp of the latest successful ingestion run, sitewide.
    db
      .from("IngestionRuns")
      .select("finished_at")
      .eq("status", "succeeded")
      .order("finished_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const officialsByOffice = new Map<string, { name: string; party?: string }>();
  for (const o of (officialsResult.data ?? []) as Row[]) {
    officialsByOffice.set(o.office_id as string, {
      name: o.name as string,
      party: (o.party as string) || undefined,
    });
  }

  const childOfficeCounts = new Map<string, number>();
  for (const co of (childOfficesResult.data ?? []) as Row[]) {
    const did = co.district_id as string;
    childOfficeCounts.set(did, (childOfficeCounts.get(did) ?? 0) + 1);
  }

  // 4. Assemble offices. When aggregating for a county view, an office's
  //    permalink lives under its own district, not under the county.
  let districtGeoSlugById: Map<string, string> | null = null;
  if (aggregateForCounty) {
    const { data: rows } = await db
      .from("Districts")
      .select("id, geo_slug")
      .in("id", officeDistrictIds);
    districtGeoSlugById = new Map(
      (rows ?? []).map((r) => [r.id as string, r.geo_slug as string])
    );
    // The country row has geo_slug "us" — make sure it's there even if the
    // batch fetch didn't include it.
    if (!districtGeoSlugById.has("00000000-0000-0000-0000-000000000001")) {
      districtGeoSlugById.set("00000000-0000-0000-0000-000000000001", "us");
    }
  }

  // A multi-member district (migration 0011) has several offices sharing one
  // (district_id, slug) — that combo needs a trailing /seat-n segment to link
  // unambiguously (see seat-slug.ts). Keyed by district_id since a county's
  // aggregated view mixes offices from several distinct districts.
  const slugCounts = new Map<string, number>();
  for (const o of officesRaw ?? []) {
    const key = `${o.district_id}::${o.slug}`;
    slugCounts.set(key, (slugCounts.get(key) ?? 0) + 1);
  }

  const offices: DistrictOffice[] = (officesRaw ?? []).map((o) => {
    const oid = o.id as string;
    const official = officialsByOffice.get(oid);
    const officeDistrictId = o.district_id as string;
    const slugForOffice = districtGeoSlugById
      ? (districtGeoSlugById.get(officeDistrictId) ?? geoSlug)
      : geoSlug;
    const seatLabel = (o.seat_label as string) || null;
    const needsSeatSlug =
      (slugCounts.get(`${officeDistrictId}::${o.slug}`) ?? 1) > 1 && seatLabel;
    return {
      id: oid,
      title: o.title as string,
      slug: o.slug as string,
      branch: o.branch as string,
      level: o.level as string,
      selectionMethod: o.selection_method as string,
      districtGeoSlug: slugForOffice,
      officialName: official?.name,
      officialParty: official?.party,
      nextElectionAt: (o.next_election_at as string) || undefined,
      seatSlug: needsSeatSlug ? seatLabelToSlug(seatLabel as string) : undefined,
    };
  });

  // 5. Assemble children
  const childDistricts: ChildDistrict[] = (childrenRaw ?? []).map((c) => ({
    id: c.id as string,
    name: c.name as string,
    kind: c.kind as string,
    geoSlug: c.geo_slug as string,
    officeCount: childOfficeCounts.get(c.id as string) ?? 0,
  }));

  return {
    district: {
      id: districtRaw.id as string,
      name: districtRaw.name as string,
      kind: districtRaw.kind as string,
      geoSlug: districtRaw.geo_slug as string,
      state: (districtRaw.state as string) || undefined,
    },
    breadcrumbs,
    offices,
    childDistricts,
    parentDistrict: parent
      ? { name: parent.name, geoSlug: parent.geo_slug }
      : undefined,
    aggregatedFrom: aggregateForCounty ? "state" : undefined,
    dataAsOf:
      ((lastRunResult.data as { finished_at?: string } | null)?.finished_at) ||
      undefined,
  };
}
