import { db } from "@/lib/supabase";
import { auth } from "@/auth";

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
  externalRefs?: {
    ballotpedia?: string;
    openstates?: string;
    house_gov?: string;
    fec?: string;
    official_site?: string;
  };
};

export type WitnessData = {
  id: string;
  username: string;
  termStart: string;
  termEnd: string;
  statement?: string;
  postCount: number;
  watcherCount: number;
  electedAt: string;
};

export type PostTag = {
  id: string;
  kind: string;
  label: string;
  refId?: string;
};

export type FeaturedLink = {
  url: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  domain?: string;
  fetchStatus: string;
};

export type PostPreview = {
  id: string;
  title?: string;
  body: string;
  isWitnessPost: boolean;
  isPinned: boolean;
  createdAt: string;
  authorUsername?: string;
  replyCount: number;
  featuredLink?: FeaturedLink;
  tags: PostTag[];
};

export type OfficePageData = {
  breadcrumbs: BreadcrumbItem[];
  district: {
    id: string;
    name: string;
    geoSlug: string;
    kind: string;
  };
  office: {
    id: string;
    title: string;
    slug: string;
    description?: string;
    kind: string;
    termYears?: number;
    nextElectionAt?: string;
  };
  official: OfficialData | null;
  witness: WitnessData | null;
  posts: PostPreview[];
  watcherCount: number;
  isWatching: boolean;
  issueTags: { id: string; label: string }[];
  relatedOffices: { id: string; title: string; slug: string; geoSlug: string }[];
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
      `id, name, kind, geo_slug,
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
      "id, title, slug, description, kind, term_years, next_election_at, is_seeded"
    )
    .eq("district_id", districtRaw.id)
    .eq("slug", officeSlug)
    .maybeSingle();

  if (!officeRaw) return null;

  // 3. Current official
  const { data: officialRaw } = await db
    .from("Officials")
    .select("id, name, party, term_start, term_end, external_refs")
    .eq("office_id", officeRaw.id)
    .eq("is_current", true)
    .maybeSingle();

  // 4. Current witness + user info
  const { data: witnessRaw } = await db
    .from("Witnesses")
    .select("id, user_id, term_start, term_end, statement, created_at")
    .eq("office_id", officeRaw.id)
    .eq("is_current", true)
    .maybeSingle();

  let witnessData: WitnessData | null = null;
  if (witnessRaw) {
    const [{ data: witnessUser }, { count: witnessPostCount }] =
      await Promise.all([
        db
          .from("Users")
          .select("username")
          .eq("id", witnessRaw.user_id)
          .single(),
        db
          .from("Posts")
          .select("*", { count: "exact", head: true })
          .eq("office_id", officeRaw.id)
          .eq("author_id", witnessRaw.user_id)
          .is("deleted_at", null),
      ]);

    witnessData = {
      id: witnessRaw.id as string,
      username: (witnessUser?.username as string) ?? "unknown",
      termStart: witnessRaw.term_start as string,
      termEnd: witnessRaw.term_end as string,
      statement: witnessRaw.statement as string | undefined,
      postCount: witnessPostCount ?? 0,
      watcherCount: 0, // filled below
      electedAt: witnessRaw.created_at as string,
    };
  }

  // 5. Watcher count + is-watching check (parallel)
  const session = await auth();
  const [{ count: watcherCount }, watchCheck] = await Promise.all([
    db
      .from("OfficeWatches")
      .select("*", { count: "exact", head: true })
      .eq("office_id", officeRaw.id),
    session?.user.id
      ? db
          .from("OfficeWatches")
          .select("user_id")
          .eq("office_id", officeRaw.id)
          .eq("user_id", session.user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  if (witnessData) {
    witnessData.watcherCount = watcherCount ?? 0;
  }

  // 6. Posts (top-level, non-deleted, pinned first, oldest first — forum-style public record)
  const { data: postsRaw } = await db
    .from("Posts")
    .select(
      `id, title, body, is_witness_post, is_pinned, created_at, author_id,
       featured_link_url, featured_link_title, featured_link_description,
       featured_link_image_url, featured_link_domain, featured_link_fetch_status`
    )
    .eq("office_id", officeRaw.id)
    .is("parent_id", null)
    .is("deleted_at", null)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(10);

  const postIds = (postsRaw ?? []).map((p) => p.id as string);

  // 7. Author usernames + post tags + reply counts (parallel)
  const authorIds = [
    ...new Set((postsRaw ?? []).map((p) => p.author_id as string).filter(Boolean)),
  ];

  const [authorRows, postTagRows, replyCountRows] = await Promise.all([
    authorIds.length > 0
      ? db.from("Users").select("id, username").in("id", authorIds)
      : Promise.resolve({ data: [] }),
    postIds.length > 0
      ? db
          .from("PostTags")
          .select("post_id, tag_id, Tags(id, kind, label, ref_id)")
          .in("post_id", postIds)
      : Promise.resolve({ data: [] }),
    postIds.length > 0
      ? db
          .from("Posts")
          .select("parent_id")
          .in("parent_id", postIds)
          .is("deleted_at", null)
      : Promise.resolve({ data: [] }),
  ]);

  const authorMap = new Map(
    (authorRows.data ?? []).map((u) => [u.id as string, u.username as string])
  );

  // Count replies per parent
  const replyCountMap = new Map<string, number>();
  for (const reply of replyCountRows.data ?? []) {
    const pid = reply.parent_id as string;
    replyCountMap.set(pid, (replyCountMap.get(pid) ?? 0) + 1);
  }

  // Group tags by post
  const tagsByPost = new Map<string, PostTag[]>();
  for (const pt of postTagRows.data ?? []) {
    const postId = pt.post_id as string;
    const tag = (pt as Record<string, unknown>).Tags as
      | { id: string; kind: string; label: string; ref_id?: string }
      | null;
    if (!tag) continue;
    if (!tagsByPost.has(postId)) tagsByPost.set(postId, []);
    tagsByPost.get(postId)!.push({
      id: tag.id,
      kind: tag.kind,
      label: tag.label,
      refId: tag.ref_id ?? undefined,
    });
  }

  const posts: PostPreview[] = (postsRaw ?? []).map((p) => ({
    id: p.id as string,
    title: (p.title as string) || undefined,
    body: p.body as string,
    isWitnessPost: p.is_witness_post as boolean,
    isPinned: p.is_pinned as boolean,
    createdAt: p.created_at as string,
    authorUsername: p.author_id
      ? authorMap.get(p.author_id as string)
      : undefined,
    replyCount: replyCountMap.get(p.id as string) ?? 0,
    featuredLink:
      p.featured_link_url
        ? {
            url: p.featured_link_url as string,
            title: (p.featured_link_title as string) || undefined,
            description: (p.featured_link_description as string) || undefined,
            imageUrl: (p.featured_link_image_url as string) || undefined,
            domain: (p.featured_link_domain as string) || undefined,
            fetchStatus: (p.featured_link_fetch_status as string) ?? "failed",
          }
        : undefined,
    tags: tagsByPost.get(p.id as string) ?? [],
  }));

  // 8. Issue tags used in this office's posts
  const allTagIds = [...new Set((postTagRows.data ?? []).map((pt) => pt.tag_id as string))];
  const { data: issueTagsRaw } =
    allTagIds.length > 0
      ? await db
          .from("Tags")
          .select("id, label")
          .in("id", allTagIds)
          .eq("kind", "issue")
          .order("label")
      : { data: [] };

  // 9. Related offices (other offices in same district — empty in Phase 2)
  const { data: relatedRaw } = await db
    .from("Offices")
    .select("id, title, slug, district_id")
    .eq("district_id", districtRaw.id)
    .neq("id", officeRaw.id)
    .not("slug", "is", null)
    .limit(6);

  // 10. Build breadcrumbs from parent chain
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
    },
    office: {
      id: officeRaw.id as string,
      title: officeRaw.title as string,
      slug: officeRaw.slug as string,
      description: (officeRaw.description as string) || undefined,
      kind: officeRaw.kind as string,
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
          externalRefs:
            (officialRaw.external_refs as OfficialData["externalRefs"]) ??
            undefined,
        }
      : null,
    witness: witnessData,
    posts,
    watcherCount: watcherCount ?? 0,
    isWatching: !!(watchCheck as { data: unknown }).data,
    issueTags: (issueTagsRaw ?? []).map((t) => ({
      id: t.id as string,
      label: t.label as string,
    })),
    relatedOffices: (relatedRaw ?? []).map((o) => ({
      id: o.id as string,
      title: o.title as string,
      slug: o.slug as string,
      geoSlug: `${districtRaw.geo_slug}/${o.slug}`,
    })),
  };
}
