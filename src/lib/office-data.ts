import { db } from "@/lib/supabase";
import { isOnUpcomingBallot, hasCandidateSource } from "@/lib/candidate-filters";
import { seatLabelToSlug } from "@/lib/seat-slug";

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

export type CandidateData = {
  id: string;
  name: string;
  party?: string;
  isIncumbent: boolean;
  cycle: number;
  fecId?: string;
  fecTotals?: {
    receipts: number;
    disbursements: number;
    coverage_end_date?: string;
  };
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
    nextElectionEstimated?: boolean;
    primaryElectionAt?: string;
    hasCandidateSource: boolean;
    // Set only in multi-member districts, where several offices share one
    // slug ("Seat 1", "Seat 2", ...) — see seat-slug.ts.
    seatLabel?: string;
  };
  official: OfficialData | null;
  candidates: CandidateData[];
  relatedOffices: RelatedOffice[];
  // ISO timestamp of the most recent successful ingestion run — drives the
  // "Data as of …" provenance line (CLAUDE.md: every page shows "data as of").
  dataAsOf?: string;
};

// ─── Breadcrumb builder ───────────────────────────────────────────────────────

function buildBreadcrumbs(
  ancestors: Array<{ name: string; geo_slug: string }>,
  district: { name: string; geo_slug: string },
  officeTitle: string,
  // True when this office is the district's only office and the district has
  // no sub-districts — i.e. the district page would show nothing beyond this
  // one row. That page redirects here (see getDistrictPageData's caller), so
  // it isn't a real intermediate stop and shouldn't get its own crumb.
  skipDistrictCrumb: boolean
): BreadcrumbItem[] {
  const items: BreadcrumbItem[] = [];
  for (const anc of ancestors) {
    items.push({ label: anc.name, href: `/${anc.geo_slug}` });
  }
  if (!skipDistrictCrumb) {
    items.push({ label: district.name, href: `/${district.geo_slug}` });
  }
  items.push({ label: officeTitle, href: "" }); // current page — no link
  return items;
}

// ─── Main data fetcher ────────────────────────────────────────────────────────

export async function getOfficePageData(
  districtGeoSlug: string,
  officeSlug: string,
  seatSlug?: string
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

  // 2. Office. A multi-member district (migration 0011) has several rows for
  // this (district_id, slug) — the caller's seatSlug (from resolveSlug) picks
  // the right one via seat_label; the ordinary case is exactly one row.
  const { data: officesForSlug } = await db
    .from("Offices")
    .select(
      "id, title, slug, description, branch, level, selection_method, term_years, next_election_at, next_election_estimated, primary_election_at, seat_label"
    )
    .eq("district_id", districtRaw.id)
    .eq("slug", officeSlug);

  if (!officesForSlug || officesForSlug.length === 0) return null;

  const officeRaw =
    officesForSlug.length === 1
      ? officesForSlug[0]
      : officesForSlug.find(
          (o) =>
            seatSlug &&
            o.seat_label &&
            seatLabelToSlug(o.seat_label as string) === seatSlug
        );

  if (!officeRaw) return null;

  // Candidates for the upcoming election (year of next_election_at).
  const nextElectionYear = officeRaw.next_election_at
    ? Number((officeRaw.next_election_at as string).slice(0, 4))
    : null;

  // 3. Current official + related offices + upcoming candidates (parallel)
  const [
    { data: officialRaw },
    { data: relatedRaw },
    { data: candidatesRaw },
    { data: lastRunRaw },
    { count: childDistrictCount },
  ] = await Promise.all([
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
        .select("id, title, slug, seat_label")
        .eq("district_id", districtRaw.id)
        .neq("id", officeRaw.id)
        .not("slug", "is", null)
        .order("title")
        .limit(6),
      nextElectionYear
        ? db
            .from("Candidates")
            .select("id, name, party, is_incumbent, cycle, external_refs, fec_totals, status")
            .eq("office_id", officeRaw.id)
            .eq("cycle", nextElectionYear)
            .order("is_incumbent", { ascending: false })
            .order("name")
        : Promise.resolve({ data: [] as Record<string, unknown>[] }),
      // Provenance: timestamp of the latest successful ingestion run, sitewide.
      db
        .from("IngestionRuns")
        .select("finished_at")
        .eq("status", "succeeded")
        .order("finished_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      db
        .from("Districts")
        .select("*", { count: "exact", head: true })
        .eq("parent_id", districtRaw.id),
    ]);

  // A district that holds exactly this one office and has no sub-districts
  // (a single congressional/state-legislative seat, a single-mayor town) is a
  // pure pass-through — its own page would be a near-duplicate of this one.
  // getDistrictPageData's caller redirects that page here; drop its
  // breadcrumb crumb too so the trail doesn't reference a page that no
  // longer resolves to itself.
  const isPassthroughDistrict =
    (relatedRaw?.length ?? 0) === 0 && (childDistrictCount ?? 0) === 0;

  // How many offices in this district share each slug — >1 means the slug
  // alone is ambiguous and needs a /seat-n segment (see seat-slug.ts). This
  // office's own slug count comes straight from officesForSlug; sibling slugs
  // are counted from the (capped) related-offices fetch below.
  const slugCounts = new Map<string, number>([
    [officeRaw.slug as string, officesForSlug.length],
  ]);
  for (const o of relatedRaw ?? []) {
    if (o.slug === officeRaw.slug) continue;
    slugCounts.set(o.slug as string, (slugCounts.get(o.slug as string) ?? 0) + 1);
  }
  const districtGeoSlugStr = districtRaw.geo_slug as string;
  function officePath(o: { slug: string; seat_label?: string | null }): string {
    const needsSeat = (slugCounts.get(o.slug) ?? 1) > 1 && o.seat_label;
    return needsSeat
      ? `${districtGeoSlugStr}/${o.slug}/${seatLabelToSlug(o.seat_label as string)}`
      : `${districtGeoSlugStr}/${o.slug}`;
  }

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
    officeRaw.title as string,
    isPassthroughDistrict
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
      nextElectionEstimated:
        (officeRaw.next_election_estimated as boolean) || undefined,
      primaryElectionAt: (officeRaw.primary_election_at as string) || undefined,
      hasCandidateSource: hasCandidateSource({
        slug: officeRaw.slug as string,
        level: officeRaw.level as string,
      }),
      seatLabel: (officeRaw.seat_label as string) || undefined,
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
    // Surface only candidates who will actually appear on the ballot — exclude
    // dropouts (Withdrew), unqualified filers (Did Not Qualify), defeated /
    // disqualified entries, and rows transferred to local races. We keep these
    // in the database for historical accuracy but they don't belong on a
    // forward-looking ballot card.
    candidates: (candidatesRaw ?? []).filter(isOnUpcomingBallot).map((c) => {
      const refs = (c.external_refs ?? {}) as Record<string, string>;
      const totals = c.fec_totals as CandidateData["fecTotals"] | null;
      return {
        id: c.id as string,
        name: c.name as string,
        party: (c.party as string) || undefined,
        isIncumbent: !!c.is_incumbent,
        cycle: c.cycle as number,
        fecId: refs.fec_candidate_id || undefined,
        fecTotals: totals ?? undefined,
      };
    }),
    relatedOffices: (relatedRaw ?? []).map((o) => ({
      id: o.id as string,
      title: o.title as string,
      slug: o.slug as string,
      geoSlug: officePath({
        slug: o.slug as string,
        seat_label: (o.seat_label as string) || null,
      }),
    })),
    dataAsOf:
      ((lastRunRaw as { finished_at?: string } | null)?.finished_at) ||
      undefined,
  };
}
