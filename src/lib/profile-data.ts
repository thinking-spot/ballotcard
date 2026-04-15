import { db } from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProfilePost = {
  id: string;
  title?: string;
  body: string;
  isWitnessPost: boolean;
  isPinned: boolean;
  createdAt: string;
  replyCount: number;
  office: {
    title: string;
    slug: string;
    districtGeoSlug: string;
  };
};

export type ProfileWitnessTerm = {
  id: string;
  isCurrent: boolean;
  termStart: string;
  termEnd: string;
  statement?: string;
  office: {
    title: string;
    slug: string;
    districtGeoSlug: string;
  };
};

export type ProfileCandidacy = {
  id: string;
  statementShort: string;
  filedAt: string;
  office: {
    title: string;
    slug: string;
    districtGeoSlug: string;
  };
};

export type ProfileWatchedOffice = {
  id: string;
  title: string;
  slug: string;
  districtGeoSlug: string;
};

export type ProfilePageData = {
  user: {
    id: string;
    username: string;
    createdAt: string;
    homeDistrict?: {
      name: string;
      geoSlug: string;
    };
  };
  posts: ProfilePost[];
  witnessTerms: ProfileWitnessTerm[];
  activeCandidacies: ProfileCandidacy[];
  watchedOffices: ProfileWatchedOffice[];
  stats: {
    postCount: number;
    witnessTermCount: number;
    officesWatched: number;
  };
};

// ─── Main data fetcher ────────────────────────────────────────────────────────

export async function getProfilePageData(
  username: string
): Promise<ProfilePageData | null> {
  // 1. Fetch user by username
  const { data: userRaw } = await db
    .from("Users")
    .select("id, username, created_at, home_district_id")
    .eq("username", username)
    .maybeSingle();

  if (!userRaw) return null;

  const userId = userRaw.id as string;

  // 2. Parallel: home district, posts, witness terms, candidacies, watches
  const [
    homeDistrictResult,
    postsResult,
    witnessResult,
    candidacyResult,
    watchResult,
    postCountResult,
  ] = await Promise.all([
    // Home district
    userRaw.home_district_id
      ? db
          .from("Districts")
          .select("name, geo_slug")
          .eq("id", userRaw.home_district_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),

    // Recent posts (top-level, non-deleted)
    db
      .from("Posts")
      .select("id, title, body, is_witness_post, is_pinned, created_at, office_id")
      .eq("author_id", userId)
      .is("parent_id", null)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(20),

    // Witness terms (all, newest first)
    db
      .from("Witnesses")
      .select("id, is_current, term_start, term_end, statement, office_id")
      .eq("user_id", userId)
      .order("term_start", { ascending: false }),

    // Active candidacies (not withdrawn, in open elections)
    db
      .from("WitnessCandidacies")
      .select("id, statement_short, created_at, election_id")
      .eq("user_id", userId)
      .is("withdrawn_at", null),

    // Watched offices
    db
      .from("OfficeWatches")
      .select("office_id")
      .eq("user_id", userId),

    // Total post count
    db
      .from("Posts")
      .select("*", { count: "exact", head: true })
      .eq("author_id", userId)
      .is("parent_id", null)
      .is("deleted_at", null),
  ]);

  // 3. Collect all office IDs we need to look up
  const officeIds = new Set<string>();
  for (const p of postsResult.data ?? []) {
    if (p.office_id) officeIds.add(p.office_id as string);
  }
  for (const w of witnessResult.data ?? []) {
    if (w.office_id) officeIds.add(w.office_id as string);
  }
  for (const w of watchResult.data ?? []) {
    if (w.office_id) officeIds.add(w.office_id as string);
  }

  // Candidacies need election → office lookup
  const electionIds = (candidacyResult.data ?? []).map(
    (c) => c.election_id as string
  );

  const [officeRows, electionRows, replyCountRows] = await Promise.all([
    officeIds.size > 0
      ? db
          .from("Offices")
          .select("id, title, slug, district_id")
          .in("id", [...officeIds])
      : Promise.resolve({ data: [] }),
    electionIds.length > 0
      ? db
          .from("WitnessElections")
          .select("id, office_id")
          .in("id", electionIds)
      : Promise.resolve({ data: [] }),
    // Reply counts for the user's posts
    (postsResult.data ?? []).length > 0
      ? db
          .from("Posts")
          .select("parent_id")
          .in(
            "parent_id",
            (postsResult.data ?? []).map((p) => p.id as string)
          )
          .is("deleted_at", null)
      : Promise.resolve({ data: [] }),
  ]);

  // Add election office IDs to the set and fetch those too if needed
  const electionOfficeMap = new Map<string, string>();
  for (const e of electionRows.data ?? []) {
    electionOfficeMap.set(e.id as string, e.office_id as string);
    officeIds.add(e.office_id as string);
  }

  // If we found new office IDs from elections, fetch those too
  const existingOfficeIds = new Set(
    (officeRows.data ?? []).map((o) => o.id as string)
  );
  const missingOfficeIds = [...officeIds].filter(
    (id) => !existingOfficeIds.has(id)
  );

  let allOfficeRows = officeRows.data ?? [];
  if (missingOfficeIds.length > 0) {
    const { data: extraOffices } = await db
      .from("Offices")
      .select("id, title, slug, district_id")
      .in("id", missingOfficeIds);
    allOfficeRows = [...allOfficeRows, ...(extraOffices ?? [])];
  }

  // 4. Fetch district geo_slugs for all offices
  const districtIds = [
    ...new Set(allOfficeRows.map((o) => o.district_id as string)),
  ];

  const { data: districtRows } =
    districtIds.length > 0
      ? await db
          .from("Districts")
          .select("id, geo_slug")
          .in("id", districtIds)
      : { data: [] };

  const districtMap = new Map(
    (districtRows ?? []).map((d) => [d.id as string, d.geo_slug as string])
  );

  // Build office lookup
  type OfficeInfo = { title: string; slug: string; districtGeoSlug: string };
  const officeMap = new Map<string, OfficeInfo>();
  for (const o of allOfficeRows) {
    officeMap.set(o.id as string, {
      title: o.title as string,
      slug: o.slug as string,
      districtGeoSlug: districtMap.get(o.district_id as string) ?? "",
    });
  }

  // Reply count map
  const replyCountMap = new Map<string, number>();
  for (const r of replyCountRows.data ?? []) {
    const pid = r.parent_id as string;
    replyCountMap.set(pid, (replyCountMap.get(pid) ?? 0) + 1);
  }

  // 5. Build posts
  const posts: ProfilePost[] = [];
  for (const p of postsResult.data ?? []) {
    const office = officeMap.get(p.office_id as string);
    if (!office) continue;
    posts.push({
      id: p.id as string,
      title: (p.title as string) || undefined,
      body: p.body as string,
      isWitnessPost: p.is_witness_post as boolean,
      isPinned: p.is_pinned as boolean,
      createdAt: p.created_at as string,
      replyCount: replyCountMap.get(p.id as string) ?? 0,
      office,
    });
  }

  // 6. Build witness terms
  const witnessTerms: ProfileWitnessTerm[] = [];
  for (const w of witnessResult.data ?? []) {
    const office = officeMap.get(w.office_id as string);
    if (!office) continue;
    witnessTerms.push({
      id: w.id as string,
      isCurrent: w.is_current as boolean,
      termStart: w.term_start as string,
      termEnd: w.term_end as string,
      statement: (w.statement as string) || undefined,
      office,
    });
  }

  // 7. Build active candidacies
  const activeCandidacies: ProfileCandidacy[] = [];
  for (const c of candidacyResult.data ?? []) {
    const officeId = electionOfficeMap.get(c.election_id as string);
    if (!officeId) continue;
    const office = officeMap.get(officeId);
    if (!office) continue;
    activeCandidacies.push({
      id: c.id as string,
      statementShort: c.statement_short as string,
      filedAt: c.created_at as string,
      office,
    });
  }

  // 8. Build watched offices
  const watchedOffices: ProfileWatchedOffice[] = [];
  for (const w of watchResult.data ?? []) {
    const office = officeMap.get(w.office_id as string);
    if (!office) continue;
    watchedOffices.push({
      id: w.office_id as string,
      title: office.title,
      slug: office.slug,
      districtGeoSlug: office.districtGeoSlug,
    });
  }

  return {
    user: {
      id: userId,
      username: userRaw.username as string,
      createdAt: userRaw.created_at as string,
      homeDistrict: homeDistrictResult.data
        ? {
            name: homeDistrictResult.data.name as string,
            geoSlug: homeDistrictResult.data.geo_slug as string,
          }
        : undefined,
    },
    posts,
    witnessTerms,
    activeCandidacies,
    watchedOffices,
    stats: {
      postCount: postCountResult.count ?? 0,
      witnessTermCount: (witnessResult.data ?? []).length,
      officesWatched: (watchResult.data ?? []).length,
    },
  };
}
