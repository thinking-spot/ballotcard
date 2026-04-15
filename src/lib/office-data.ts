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

export type ModActionEntry = {
  id: string;
  actorUsername: string;
  targetType: string;
  targetId: string;
  action: string;
  reason?: string;
  createdAt: string;
  /** Post title for context, when target is a post */
  postTitle?: string;
  postAuthorUsername?: string;
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
  isWitnessForOffice: boolean;
  issueTags: { id: string; label: string }[];
  relatedOffices: { id: string; title: string; slug: string; geoSlug: string }[];
  modActions: ModActionEntry[];
};

// ─── Thread types ───────────────────────────────────────────────────────────

export type ModDeletion = {
  actorUsername: string;
  reason: string;
};

export type ThreadPost = {
  id: string;
  parentId: string | null;
  title?: string;
  body: string;
  isWitnessPost: boolean;
  isPinned: boolean;
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string;
  authorId?: string;
  authorUsername?: string;
  revisionCount: number;
  featuredLink?: FeaturedLink;
  tags: PostTag[];
  modDeletion?: ModDeletion;
};

export type ThreadReply = {
  id: string;
  parentId: string;
  body: string;
  isWitnessPost: boolean;
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string;
  authorId?: string;
  authorUsername?: string;
  revisionCount: number;
  replies: ThreadReply[];
  modDeletion?: ModDeletion;
};

export type ThreadData = {
  breadcrumbs: BreadcrumbItem[];
  office: {
    id: string;
    title: string;
    slug: string;
  };
  district: {
    id: string;
    name: string;
    geoSlug: string;
  };
  post: ThreadPost;
  replies: ThreadReply[];
  isWitnessForOffice: boolean;
};

// ─── Thread data fetcher ────────────────────────────────────────────────────

export async function getThreadData(
  postId: string
): Promise<ThreadData | null> {
  // 1. Fetch the root post
  const { data: postRaw } = await db
    .from("Posts")
    .select(
      `id, parent_id, title, body, is_witness_post, is_pinned,
       created_at, updated_at, deleted_at, author_id, office_id,
       featured_link_url, featured_link_title, featured_link_description,
       featured_link_image_url, featured_link_domain, featured_link_fetch_status`
    )
    .eq("id", postId)
    .maybeSingle();

  if (!postRaw) return null;

  // If this is a reply, walk up to the root post
  let rootPost = postRaw;
  if (rootPost.parent_id) {
    const { data: parentPost } = await db
      .from("Posts")
      .select(
        `id, parent_id, title, body, is_witness_post, is_pinned,
         created_at, updated_at, deleted_at, author_id, office_id,
         featured_link_url, featured_link_title, featured_link_description,
         featured_link_image_url, featured_link_domain, featured_link_fetch_status`
      )
      .eq("id", rootPost.parent_id)
      .maybeSingle();

    if (parentPost) rootPost = parentPost;
    // If the parent also has a parent, walk up one more level (2-deep threading max)
    if (rootPost.parent_id) {
      const { data: grandparent } = await db
        .from("Posts")
        .select(
          `id, parent_id, title, body, is_witness_post, is_pinned,
           created_at, updated_at, deleted_at, author_id, office_id,
           featured_link_url, featured_link_title, featured_link_description,
           featured_link_image_url, featured_link_domain, featured_link_fetch_status`
        )
        .eq("id", rootPost.parent_id)
        .maybeSingle();

      if (grandparent) rootPost = grandparent;
    }
  }

  const officeId = rootPost.office_id as string;
  if (!officeId) return null;

  // 2. Fetch office + district context for breadcrumbs
  const { data: officeRaw } = await db
    .from("Offices")
    .select("id, title, slug, district_id")
    .eq("id", officeId)
    .maybeSingle();

  if (!officeRaw) return null;

  const { data: districtRaw } = await db
    .from("Districts")
    .select(
      `id, name, geo_slug,
       parent:parent_id(
         id, name, geo_slug,
         parent:parent_id(id, name, geo_slug)
       )`
    )
    .eq("id", officeRaw.district_id)
    .single();

  if (!districtRaw) return null;

  // 3. Fetch all replies in this thread (flat, then we'll nest them)
  const { data: repliesRaw } = await db
    .from("Posts")
    .select(
      `id, parent_id, body, is_witness_post,
       created_at, updated_at, deleted_at, author_id`
    )
    .eq("office_id", officeId)
    .not("parent_id", "is", null)
    .order("created_at", { ascending: true });

  // Filter to only replies that belong to this thread
  // Build a set of IDs in the thread starting from rootPost.id
  const allReplies = (repliesRaw ?? []) as Array<Record<string, unknown>>;
  const threadIds = new Set<string>([rootPost.id as string]);
  // Multiple passes to capture nested replies
  let added = true;
  while (added) {
    added = false;
    for (const r of allReplies) {
      const rid = r.id as string;
      const pid = r.parent_id as string;
      if (!threadIds.has(rid) && threadIds.has(pid)) {
        threadIds.add(rid);
        added = true;
      }
    }
  }
  const threadReplies = allReplies.filter((r) => threadIds.has(r.id as string) && r.id !== rootPost.id);

  // 4. Collect all author IDs and fetch usernames
  const allAuthorIds = new Set<string>();
  if (rootPost.author_id) allAuthorIds.add(rootPost.author_id as string);
  for (const r of threadReplies) {
    if (r.author_id) allAuthorIds.add(r.author_id as string);
  }

  const authorIds = [...allAuthorIds];

  // 5. Fetch usernames + revision counts + post tags + mod deletions + witness check in parallel
  const allPostIds = [rootPost.id as string, ...threadReplies.map((r) => r.id as string)];

  // Collect deleted post IDs to look up mod actions
  const deletedPostIds = [
    ...(rootPost.deleted_at ? [rootPost.id as string] : []),
    ...threadReplies.filter((r) => r.deleted_at).map((r) => r.id as string),
  ];

  const session = await auth();

  const [authorRows, revisionRows, postTagRows, modDeletionRows, witnessCheck] = await Promise.all([
    authorIds.length > 0
      ? db.from("Users").select("id, username").in("id", authorIds)
      : Promise.resolve({ data: [] }),
    db
      .from("PostRevisions")
      .select("post_id")
      .in("post_id", allPostIds)
      .then((r) => (r.error ? { data: [] } : r)),
    db
      .from("PostTags")
      .select("post_id, tag_id, Tags(id, kind, label, ref_id)")
      .in("post_id", [rootPost.id as string]),
    // Fetch mod deletion actions for deleted posts
    deletedPostIds.length > 0
      ? db
          .from("ModActions")
          .select("target_id, action, reason, actor_id")
          .eq("target_type", "post")
          .eq("action", "soft_delete")
          .in("target_id", deletedPostIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    // Check if current user is the Witness for this office
    session?.user.id
      ? db
          .from("Witnesses")
          .select("id")
          .eq("office_id", officeId)
          .eq("user_id", session.user.id)
          .eq("is_current", true)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const authorMap = new Map(
    (authorRows.data ?? []).map((u) => [u.id as string, u.username as string])
  );

  // Build mod deletion map: postId → { actorId, reason }
  const modDeletionMap = new Map<string, { actorId: string; reason: string }>();
  for (const row of modDeletionRows.data ?? []) {
    const targetId = row.target_id as string;
    if (!modDeletionMap.has(targetId)) {
      modDeletionMap.set(targetId, {
        actorId: row.actor_id as string,
        reason: (row.reason as string) ?? "",
      });
    }
  }

  // Fetch mod actor usernames if needed
  const modActorIds = [...new Set([...modDeletionMap.values()].map((v) => v.actorId))];
  // authorMap already has author usernames; add mod actor usernames
  if (modActorIds.length > 0) {
    const missingIds = modActorIds.filter((id) => !authorMap.has(id));
    if (missingIds.length > 0) {
      const { data: modActorRows } = await db
        .from("Users")
        .select("id, username")
        .in("id", missingIds);
      for (const u of modActorRows ?? []) {
        authorMap.set(u.id as string, u.username as string);
      }
    }
  }

  const isWitnessForOffice = !!(witnessCheck as { data: unknown }).data;

  // Count revisions per post
  const revisionCountMap = new Map<string, number>();
  for (const rev of revisionRows.data ?? []) {
    const pid = rev.post_id as string;
    revisionCountMap.set(pid, (revisionCountMap.get(pid) ?? 0) + 1);
  }

  // Group tags for root post
  const rootTags: PostTag[] = [];
  for (const pt of postTagRows.data ?? []) {
    const tag = (pt as Record<string, unknown>).Tags as
      | { id: string; kind: string; label: string; ref_id?: string }
      | null;
    if (!tag) continue;
    rootTags.push({
      id: tag.id,
      kind: tag.kind,
      label: tag.label,
      refId: tag.ref_id ?? undefined,
    });
  }

  // 6. Build root post
  const post: ThreadPost = {
    id: rootPost.id as string,
    parentId: null,
    title: (rootPost.title as string) || undefined,
    body: rootPost.body as string,
    isWitnessPost: rootPost.is_witness_post as boolean,
    isPinned: rootPost.is_pinned as boolean,
    createdAt: rootPost.created_at as string,
    updatedAt: (rootPost.updated_at as string) || undefined,
    deletedAt: (rootPost.deleted_at as string) || undefined,
    authorId: (rootPost.author_id as string) || undefined,
    authorUsername: rootPost.author_id
      ? authorMap.get(rootPost.author_id as string)
      : undefined,
    revisionCount: revisionCountMap.get(rootPost.id as string) ?? 0,
    featuredLink: rootPost.featured_link_url
      ? {
          url: rootPost.featured_link_url as string,
          title: (rootPost.featured_link_title as string) || undefined,
          description: (rootPost.featured_link_description as string) || undefined,
          imageUrl: (rootPost.featured_link_image_url as string) || undefined,
          domain: (rootPost.featured_link_domain as string) || undefined,
          fetchStatus: (rootPost.featured_link_fetch_status as string) ?? "failed",
        }
      : undefined,
    tags: rootTags,
    modDeletion: (() => {
      const md = modDeletionMap.get(rootPost.id as string);
      if (!md) return undefined;
      return {
        actorUsername: authorMap.get(md.actorId) ?? "unknown",
        reason: md.reason,
      };
    })(),
  };

  // 7. Build reply tree
  const replyMap = new Map<string, ThreadReply>();
  for (const r of threadReplies) {
    const rid = r.id as string;
    const md = modDeletionMap.get(rid);
    replyMap.set(rid, {
      id: rid,
      parentId: r.parent_id as string,
      body: r.body as string,
      isWitnessPost: r.is_witness_post as boolean,
      createdAt: r.created_at as string,
      updatedAt: (r.updated_at as string) || undefined,
      deletedAt: (r.deleted_at as string) || undefined,
      authorId: (r.author_id as string) || undefined,
      authorUsername: r.author_id
        ? authorMap.get(r.author_id as string)
        : undefined,
      revisionCount: revisionCountMap.get(rid) ?? 0,
      replies: [],
      modDeletion: md
        ? { actorUsername: authorMap.get(md.actorId) ?? "unknown", reason: md.reason }
        : undefined,
    });
  }

  // Nest replies under their parents
  const topLevelReplies: ThreadReply[] = [];
  for (const reply of replyMap.values()) {
    if (reply.parentId === post.id) {
      topLevelReplies.push(reply);
    } else {
      const parent = replyMap.get(reply.parentId);
      if (parent) {
        parent.replies.push(reply);
      }
    }
  }

  // 8. Build breadcrumbs
  type ParentRow = { name: string; geo_slug: string };
  const ancestors: ParentRow[] = [];
  const parent = (districtRaw as Record<string, unknown>).parent as
    | (ParentRow & { parent?: ParentRow })
    | null;
  if (parent) {
    if (parent.parent) ancestors.push(parent.parent);
    ancestors.push({ name: parent.name, geo_slug: parent.geo_slug });
  }

  const officeHref = `/${districtRaw.geo_slug}/${officeRaw.slug}`;
  const breadcrumbs: BreadcrumbItem[] = [];
  for (const anc of ancestors) {
    breadcrumbs.push({ label: anc.name, href: `/${anc.geo_slug}` });
  }
  breadcrumbs.push({
    label: districtRaw.name as string,
    href: `/${districtRaw.geo_slug}`,
  });
  breadcrumbs.push({
    label: officeRaw.title as string,
    href: officeHref,
  });
  breadcrumbs.push({
    label: post.title ?? "Thread",
    href: "",
  });

  return {
    breadcrumbs,
    office: {
      id: officeRaw.id as string,
      title: officeRaw.title as string,
      slug: officeRaw.slug as string,
    },
    district: {
      id: districtRaw.id as string,
      name: districtRaw.name as string,
      geoSlug: districtRaw.geo_slug as string,
    },
    post,
    replies: topLevelReplies,
    isWitnessForOffice,
  };
}

// ─── Post permalink resolver ────────────────────────────────────────────────

/**
 * Given a post ID, return the canonical URL path for the thread view.
 * Used by the /p/[postId] short permalink route.
 */
export async function getPostCanonicalPath(
  postId: string
): Promise<string | null> {
  // Find the post and its office
  const { data: postRow } = await db
    .from("Posts")
    .select("id, parent_id, office_id")
    .eq("id", postId)
    .maybeSingle();

  if (!postRow || !postRow.office_id) return null;

  // Walk to root post if this is a reply
  let rootId = postRow.id as string;
  let parentId = postRow.parent_id as string | null;
  while (parentId) {
    const { data: parentRow } = await db
      .from("Posts")
      .select("id, parent_id")
      .eq("id", parentId)
      .maybeSingle();
    if (!parentRow) break;
    rootId = parentRow.id as string;
    parentId = parentRow.parent_id as string | null;
  }

  // Get office + district geo_slug
  const { data: officeRow } = await db
    .from("Offices")
    .select("slug, district_id")
    .eq("id", postRow.office_id)
    .maybeSingle();

  if (!officeRow) return null;

  const { data: districtRow } = await db
    .from("Districts")
    .select("geo_slug")
    .eq("id", officeRow.district_id)
    .maybeSingle();

  if (!districtRow) return null;

  return `/${districtRow.geo_slug}/${officeRow.slug}/post/${rootId}`;
}

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

  // 5. Watcher count + is-watching check + witness check + mod actions (parallel)
  const session = await auth();
  const [{ count: watcherCount }, watchCheck, witnessForOfficeCheck, modActionsRaw] = await Promise.all([
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
    session?.user.id
      ? db
          .from("Witnesses")
          .select("id")
          .eq("office_id", officeRaw.id)
          .eq("user_id", session.user.id)
          .eq("is_current", true)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    db
      .from("ModActions")
      .select("id, actor_id, target_type, target_id, action, reason, created_at")
      .eq("scope_office_id", officeRaw.id)
      .order("created_at", { ascending: false })
      .limit(20),
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

  // 10. Process mod actions for audit log
  const modActionActorIds = [
    ...new Set((modActionsRaw.data ?? []).map((a) => a.actor_id as string).filter(Boolean)),
  ];
  // Fetch actor usernames (some may already be in authorMap)
  const missingModActorIds = modActionActorIds.filter((id) => !authorMap.has(id));
  if (missingModActorIds.length > 0) {
    const { data: modActorUsers } = await db
      .from("Users")
      .select("id, username")
      .in("id", missingModActorIds);
    for (const u of modActorUsers ?? []) {
      authorMap.set(u.id as string, u.username as string);
    }
  }

  // Fetch target post info for mod actions targeting posts
  const modTargetPostIds = [
    ...new Set(
      (modActionsRaw.data ?? [])
        .filter((a) => a.target_type === "post")
        .map((a) => a.target_id as string)
    ),
  ];
  const modTargetPostMap = new Map<string, { title?: string; authorId?: string }>();
  if (modTargetPostIds.length > 0) {
    const { data: targetPosts } = await db
      .from("Posts")
      .select("id, title, author_id")
      .in("id", modTargetPostIds);
    for (const p of targetPosts ?? []) {
      modTargetPostMap.set(p.id as string, {
        title: (p.title as string) || undefined,
        authorId: (p.author_id as string) || undefined,
      });
    }
    // Fetch any missing author usernames for target posts
    const targetAuthorIds = [...new Set(
      [...modTargetPostMap.values()].map((v) => v.authorId).filter(Boolean) as string[]
    )].filter((id) => !authorMap.has(id));
    if (targetAuthorIds.length > 0) {
      const { data: targetAuthorUsers } = await db
        .from("Users")
        .select("id, username")
        .in("id", targetAuthorIds);
      for (const u of targetAuthorUsers ?? []) {
        authorMap.set(u.id as string, u.username as string);
      }
    }
  }

  const modActions: ModActionEntry[] = (modActionsRaw.data ?? []).map((a) => {
    const targetPost = modTargetPostMap.get(a.target_id as string);
    return {
      id: a.id as string,
      actorUsername: authorMap.get(a.actor_id as string) ?? "unknown",
      targetType: a.target_type as string,
      targetId: a.target_id as string,
      action: a.action as string,
      reason: (a.reason as string) || undefined,
      createdAt: a.created_at as string,
      postTitle: targetPost?.title,
      postAuthorUsername: targetPost?.authorId
        ? authorMap.get(targetPost.authorId)
        : undefined,
    };
  });

  // 11. Build breadcrumbs from parent chain
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
    isWitnessForOffice: !!(witnessForOfficeCheck as { data: unknown }).data,
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
    modActions,
  };
}
