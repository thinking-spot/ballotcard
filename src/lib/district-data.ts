import { db } from "@/lib/supabase";
import { auth } from "@/auth";
import type { BreadcrumbItem } from "@/lib/office-data";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DistrictOffice = {
  id: string;
  title: string;
  slug: string;
  kind: string;
  districtGeoSlug: string;
  officialName?: string;
  officialParty?: string;
  witnessUsername?: string;
  watcherCount: number;
  postCount: number;
  hasOpenElection: boolean;
};

export type ChildDistrict = {
  id: string;
  name: string;
  kind: string;
  geoSlug: string;
  officeCount: number;
};

export type DistrictActivityPost = {
  id: string;
  title?: string;
  body: string;
  authorUsername: string;
  isWitnessPost: boolean;
  createdAt: string;
  officeTitle: string;
  officeHref: string;
};

export type DistrictPageData = {
  district: {
    id: string;
    name: string;
    kind: string;
    geoSlug: string;
  };
  breadcrumbs: BreadcrumbItem[];
  offices: DistrictOffice[];
  childDistricts: ChildDistrict[];
  recentActivity: DistrictActivityPost[];
  parentDistrict?: { name: string; geoSlug: string };
};

// ─── Layer classification (shared with ballot-data) ─────────────────────────

function classifyLayer(kind: string): string {
  switch (kind) {
    case "country":
    case "us_house":
    case "us_senate_state":
      return "Federal";
    case "state":
    case "governor_state":
    case "state_house":
    case "state_senate":
      return "State";
    case "county":
      return "County";
    case "municipality":
    case "school_board":
    case "judicial":
      return "Municipal";
    default:
      return "Other";
  }
}

export const LAYER_ORDER = ["Federal", "State", "County", "Municipal", "Other"];

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

  // Build ancestor chain for breadcrumbs
  const ancestors: Array<{ name: string; geo_slug: string }> = [];
  if (parent) {
    if (parent.parent) ancestors.push(parent.parent);
    ancestors.push(parent);
  }

  const breadcrumbs = buildDistrictBreadcrumbs(
    ancestors,
    districtRaw.name as string
  );

  // 2. Offices directly in this district
  const { data: officesRaw } = await db
    .from("Offices")
    .select("id, title, slug, kind, district_id")
    .eq("district_id", districtRaw.id)
    .not("slug", "is", null)
    .order("title");

  const officeIds = (officesRaw ?? []).map((o) => o.id as string);

  // 3. Child districts
  const { data: childrenRaw } = await db
    .from("Districts")
    .select("id, name, kind, geo_slug")
    .eq("parent_id", districtRaw.id)
    .order("name");

  // Get office counts per child district
  const childIds = (childrenRaw ?? []).map((c) => c.id as string);
  let childOfficeCounts = new Map<string, number>();
  if (childIds.length > 0) {
    const { data: childOffices } = await db
      .from("Offices")
      .select("district_id")
      .in("district_id", childIds)
      .not("slug", "is", null);

    for (const co of childOffices ?? []) {
      const did = co.district_id as string;
      childOfficeCounts.set(did, (childOfficeCounts.get(did) ?? 0) + 1);
    }
  }

  // 4. Batch-fetch office-related data
  const now = new Date().toISOString();

  const [officialsResult, witnessesResult, watchCountsResult, electionsResult, postCountsResult] =
    officeIds.length > 0
      ? await Promise.all([
          db
            .from("Officials")
            .select("office_id, name, party")
            .in("office_id", officeIds)
            .eq("is_current", true),
          db
            .from("Witnesses")
            .select("office_id, user_id, Users!inner(username)")
            .in("office_id", officeIds)
            .eq("is_current", true),
          db
            .from("OfficeWatches")
            .select("office_id")
            .in("office_id", officeIds),
          db
            .from("WitnessElections")
            .select("office_id")
            .in("office_id", officeIds)
            .lte("voting_opens_at", now)
            .gte("voting_closes_at", now),
          db
            .from("Posts")
            .select("office_id")
            .in("office_id", officeIds)
            .is("deleted_at", null)
            .is("parent_id", null),
        ])
      : [
          { data: [] },
          { data: [] },
          { data: [] },
          { data: [] },
          { data: [] },
        ];

  // Build lookup maps
  type Row = Record<string, unknown>;

  const officialsByOffice = new Map<string, { name: string; party?: string }>();
  for (const o of (officialsResult.data ?? []) as Row[]) {
    officialsByOffice.set(o.office_id as string, {
      name: o.name as string,
      party: (o.party as string) || undefined,
    });
  }

  const witnessByOffice = new Map<string, string>();
  for (const w of (witnessesResult.data ?? []) as Row[]) {
    const user = w.Users as { username: string } | null;
    witnessByOffice.set(w.office_id as string, user?.username ?? "unknown");
  }

  const watchCounts = new Map<string, number>();
  for (const w of (watchCountsResult.data ?? []) as Row[]) {
    const oid = w.office_id as string;
    watchCounts.set(oid, (watchCounts.get(oid) ?? 0) + 1);
  }

  const openElectionOffices = new Set<string>();
  for (const e of (electionsResult.data ?? []) as Row[]) {
    openElectionOffices.add(e.office_id as string);
  }

  const postCounts = new Map<string, number>();
  for (const p of (postCountsResult.data ?? []) as Row[]) {
    const oid = p.office_id as string;
    postCounts.set(oid, (postCounts.get(oid) ?? 0) + 1);
  }

  // Assemble offices
  const offices: DistrictOffice[] = (officesRaw ?? []).map((o) => {
    const oid = o.id as string;
    const official = officialsByOffice.get(oid);
    return {
      id: oid,
      title: o.title as string,
      slug: o.slug as string,
      kind: o.kind as string,
      districtGeoSlug: geoSlug,
      officialName: official?.name,
      officialParty: official?.party,
      witnessUsername: witnessByOffice.get(oid),
      watcherCount: watchCounts.get(oid) ?? 0,
      postCount: postCounts.get(oid) ?? 0,
      hasOpenElection: openElectionOffices.has(oid),
    };
  });

  // Assemble children
  const childDistricts: ChildDistrict[] = (childrenRaw ?? []).map((c) => ({
    id: c.id as string,
    name: c.name as string,
    kind: c.kind as string,
    geoSlug: c.geo_slug as string,
    officeCount: childOfficeCounts.get(c.id as string) ?? 0,
  }));

  // 5. Recent activity across the subtree (posts in this district's offices
  // + posts in child district offices, last 20)
  const allDistrictIds = [districtRaw.id as string, ...childIds];
  let recentActivity: DistrictActivityPost[] = [];

  if (allDistrictIds.length > 0) {
    // Get offices across the subtree for activity
    const { data: subtreeOffices } = await db
      .from("Offices")
      .select("id, title, slug, district_id, Districts!inner(geo_slug)")
      .in("district_id", allDistrictIds)
      .not("slug", "is", null);

    const subtreeOfficeIds = (subtreeOffices ?? []).map((o) => o.id as string);

    if (subtreeOfficeIds.length > 0) {
      const { data: recentPosts } = await db
        .from("Posts")
        .select(
          "id, title, body, is_witness_post, created_at, office_id, Users!inner(username)"
        )
        .in("office_id", subtreeOfficeIds)
        .is("deleted_at", null)
        .is("parent_id", null)
        .order("created_at", { ascending: false })
        .limit(20);

      // Build office lookup for href construction
      const officeMap = new Map<
        string,
        { title: string; slug: string; districtGeoSlug: string }
      >();
      for (const o of subtreeOffices ?? []) {
        const d = (o as Row).Districts as { geo_slug: string };
        officeMap.set(o.id as string, {
          title: o.title as string,
          slug: o.slug as string,
          districtGeoSlug: d.geo_slug as string,
        });
      }

      recentActivity = (recentPosts ?? []).map((p) => {
        const office = officeMap.get(p.office_id as string);
        const author = (p as Row).Users as { username: string };
        return {
          id: p.id as string,
          title: (p.title as string) || undefined,
          body: p.body as string,
          authorUsername: author.username,
          isWitnessPost: p.is_witness_post as boolean,
          createdAt: p.created_at as string,
          officeTitle: office?.title ?? "Unknown office",
          officeHref: office
            ? `/${office.districtGeoSlug}/${office.slug}`
            : "#",
        };
      });
    }
  }

  return {
    district: {
      id: districtRaw.id as string,
      name: districtRaw.name as string,
      kind: districtRaw.kind as string,
      geoSlug: districtRaw.geo_slug as string,
    },
    breadcrumbs,
    offices,
    childDistricts,
    recentActivity,
    parentDistrict: parent
      ? { name: parent.name, geoSlug: parent.geo_slug }
      : undefined,
  };
}
