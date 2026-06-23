import { db } from "@/lib/supabase";
import type { BreadcrumbItem } from "@/lib/office-data";

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

  // 2. Offices directly in this district + child districts (parallel)
  const [{ data: officesRaw }, { data: childrenRaw }] = await Promise.all([
    db
      .from("Offices")
      .select("id, title, slug, branch, level, selection_method, next_election_at")
      .eq("district_id", districtRaw.id)
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
  const [officialsResult, childOfficesResult] = await Promise.all([
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

  // 4. Assemble offices
  const offices: DistrictOffice[] = (officesRaw ?? []).map((o) => {
    const oid = o.id as string;
    const official = officialsByOffice.get(oid);
    return {
      id: oid,
      title: o.title as string,
      slug: o.slug as string,
      branch: o.branch as string,
      level: o.level as string,
      selectionMethod: o.selection_method as string,
      districtGeoSlug: geoSlug,
      officialName: official?.name,
      officialParty: official?.party,
      nextElectionAt: (o.next_election_at as string) || undefined,
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
  };
}
