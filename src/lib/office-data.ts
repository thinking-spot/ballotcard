import { db } from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

export type BreadcrumbItem = {
  label: string;
  href: string;
};

export type OfficialData = {
  id: string;
  name: string;
  party?: string;
  termStart?: string;
  termEnd?: string;
  firstTookOffice?: string;
  photoUrl?: string;
  externalRefs?: {
    bioguide?: string;
    ballotpedia?: string;
    openstates?: string;
    house_gov?: string;
    senate_gov?: string;
    fec?: string;
    official_site?: string;
    wikipedia?: string;
  };
};

export type RelatedOffice = {
  id: string;
  title: string;
  slug: string;
  geoSlug: string;
};

export type OfficePageData = {
  breadcrumbs: BreadcrumbItem[];
  district: {
    id: string;
    name: string;
    geoSlug: string;
    kind: string;
    state?: string;
  };
  office: {
    id: string;
    title: string;
    slug: string;
    description?: string;
    branch: string;
    level: string;
    selectionMethod: string;
    termYears?: number;
    nextElectionAt?: string;
  };
  official: OfficialData | null;
  relatedOffices: RelatedOffice[];
};

// ─── Breadcrumb builder ───────────────────────────────────────────────────────

function buildBreadcrumbs(
  ancestors: Array<{ name: string; geo_slug: string }>,
  district: { name: string; geo_slug: string },
  officeTitle: string
): BreadcrumbItem[] {
  const items: BreadcrumbItem[] = [];
  for (const anc of ancestors) {
    items.push({ label: anc.name, href: `/${anc.geo_slug}` });
  }
  items.push({ label: district.name, href: `/${district.geo_slug}` });
  items.push({ label: officeTitle, href: "" }); // current page — no link
  return items;
}

// ─── Main data fetcher ────────────────────────────────────────────────────────

export async function getOfficePageData(
  districtGeoSlug: string,
  officeSlug: string
): Promise<OfficePageData | null> {
  // 1. District (3 levels deep for breadcrumbs: grandparent > parent > district)
  const { data: districtRaw } = await db
    .from("Districts")
    .select(
      `id, name, kind, geo_slug, state,
       parent:parent_id(
         id, name, geo_slug,
         parent:parent_id(id, name, geo_slug)
       )`
    )
    .eq("geo_slug", districtGeoSlug)
    .single();

  if (!districtRaw) return null;

  // 2. Office
  const { data: officeRaw } = await db
    .from("Offices")
    .select(
      "id, title, slug, description, branch, level, selection_method, term_years, next_election_at"
    )
    .eq("district_id", districtRaw.id)
    .eq("slug", officeSlug)
    .maybeSingle();

  if (!officeRaw) return null;

  // 3. Current official + related offices in the same district (parallel)
  const [{ data: officialRaw }, { data: relatedRaw }] = await Promise.all([
    db
      .from("Officials")
      .select(
        "id, name, party, term_start, term_end, first_took_office, photo_url, external_refs"
      )
      .eq("office_id", officeRaw.id)
      .eq("is_current", true)
      .maybeSingle(),
    db
      .from("Offices")
      .select("id, title, slug")
      .eq("district_id", districtRaw.id)
      .neq("id", officeRaw.id)
      .not("slug", "is", null)
      .order("title")
      .limit(6),
  ]);

  // 4. Build breadcrumbs from parent chain
  type ParentRow = { name: string; geo_slug: string };
  const ancestors: ParentRow[] = [];
  const parent = (districtRaw as Record<string, unknown>).parent as
    | (ParentRow & { parent?: ParentRow })
    | null;
  if (parent) {
    if (parent.parent) ancestors.push(parent.parent);
    ancestors.push({ name: parent.name, geo_slug: parent.geo_slug });
  }

  const breadcrumbs = buildBreadcrumbs(
    ancestors,
    { name: districtRaw.name as string, geo_slug: districtRaw.geo_slug as string },
    officeRaw.title as string
  );

  return {
    breadcrumbs,
    district: {
      id: districtRaw.id as string,
      name: districtRaw.name as string,
      geoSlug: districtRaw.geo_slug as string,
      kind: districtRaw.kind as string,
      state: (districtRaw.state as string) || undefined,
    },
    office: {
      id: officeRaw.id as string,
      title: officeRaw.title as string,
      slug: officeRaw.slug as string,
      description: (officeRaw.description as string) || undefined,
      branch: officeRaw.branch as string,
      level: officeRaw.level as string,
      selectionMethod: officeRaw.selection_method as string,
      termYears: (officeRaw.term_years as number) || undefined,
      nextElectionAt: (officeRaw.next_election_at as string) || undefined,
    },
    official: officialRaw
      ? {
          id: officialRaw.id as string,
          name: officialRaw.name as string,
          party: (officialRaw.party as string) || undefined,
          termStart: (officialRaw.term_start as string) || undefined,
          termEnd: (officialRaw.term_end as string) || undefined,
          firstTookOffice: (officialRaw.first_took_office as string) || undefined,
          photoUrl: (officialRaw.photo_url as string) || undefined,
          externalRefs:
            (officialRaw.external_refs as OfficialData["externalRefs"]) ??
            undefined,
        }
      : null,
    relatedOffices: (relatedRaw ?? []).map((o) => ({
      id: o.id as string,
      title: o.title as string,
      slug: o.slug as string,
      geoSlug: `${districtRaw.geo_slug}/${o.slug}`,
    })),
  };
}
