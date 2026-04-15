import { db } from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

export type BallotPostPreview = {
  id: string;
  title?: string;
  body: string;
  authorUsername?: string;
  isWitnessPost: boolean;
  replyCount: number;
  createdAt: string;
};

export type BallotElectionAlert = {
  officeId: string;
  officeTitle: string;
  officeHref: string;
  electionId: string;
  votingClosesAt: string;
  candidateCount: number;
  userHasVoted: boolean;
};

export type BallotOffice = {
  id: string;
  title: string;
  slug: string;
  kind: string;
  districtGeoSlug: string;
  nextElectionAt?: string;
  officialName?: string;
  officialParty?: string;
  witnessUsername?: string;
  witnessIsActive: boolean;
  watcherCount: number;
  newPostCount: number;
  hasOpenElection: boolean;
  isWatched: boolean;
  recentPosts: BallotPostPreview[];
};

export type BallotLayer = {
  label: string;
  districtName: string;
  offices: BallotOffice[];
};

export type BallotData = {
  layers: BallotLayer[];
  homeDistrictName: string;
  homeDistrictState?: string;
  homeDistrictCounty?: string;
  totalOffices: number;
  watchedCount: number;
  newPostsThisWeek: number;
  activeWitnesses: number;
  electionAlerts: BallotElectionAlert[];
};

// ─── Layer classification ────────────────────────────────────────────────────

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

// Layer display order
const LAYER_ORDER = ["Federal", "State", "County", "Municipal", "Other"];

// ─── Main data fetcher ───────────────────────────────────────────────────────

export async function getBallotData(
  homeDistrictId: string,
  userId?: string
): Promise<BallotData | null> {
  // 1. Get the home district and walk up the parent chain
  const districts = await getDistrictAncestry(homeDistrictId);
  if (districts.length === 0) return null;

  const homeDistrict = districts[0];
  const districtIds = districts.map((d) => d.id);

  // Derive location context from ancestry
  const stateDistrict = districts.find((d) => d.kind === "state");
  const countyDistrict = districts.find((d) => d.kind === "county");

  // 2. Get all offices across the user's ballot districts
  const { data: officesRaw } = await db
    .from("Offices")
    .select(
      `id, title, slug, kind, next_election_at, district_id,
       Districts!inner(id, name, kind, geo_slug)`
    )
    .in("district_id", districtIds)
    .not("slug", "is", null)
    .order("title");

  if (!officesRaw || officesRaw.length === 0) {
    return {
      layers: [],
      homeDistrictName: homeDistrict.name,
      homeDistrictState: stateDistrict?.name,
      homeDistrictCounty: countyDistrict?.name,
      totalOffices: 0,
      watchedCount: 0,
      newPostsThisWeek: 0,
      activeWitnesses: 0,
      electionAlerts: [],
    };
  }

  const officeIds = officesRaw.map((o) => o.id as string);

  // 3. Batch-fetch related data in parallel
  const thirtyDaysAgo = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000
  ).toISOString();
  const oneWeekAgo = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000
  ).toISOString();
  const now = new Date().toISOString();

  // 3. Batch-fetch related data in parallel
  const [
    officialsResult,
    witnessesResult,
    watchCountsResult,
    electionsResult,
    recentWitnessPostsResult,
    newPostsResult,
    recentPostsResult,
    userWatchesResult,
  ] = await Promise.all([
    // 0: Current officials
    db
      .from("Officials")
      .select("office_id, name, party")
      .in("office_id", officeIds)
      .eq("is_current", true),
    // 1: Current witnesses
    db
      .from("Witnesses")
      .select("office_id, user_id, Users!inner(username)")
      .in("office_id", officeIds)
      .eq("is_current", true),
    // 2: Watcher counts per office
    db
      .from("OfficeWatches")
      .select("office_id")
      .in("office_id", officeIds),
    // 3: Open elections with candidate counts
    db
      .from("WitnessElections")
      .select("id, office_id, voting_closes_at")
      .in("office_id", officeIds)
      .lte("voting_opens_at", now)
      .gte("voting_closes_at", now),
    // 4: Recent witness posts (activity detection)
    db
      .from("Posts")
      .select("office_id, author_id")
      .in("office_id", officeIds)
      .eq("is_witness_post", true)
      .is("deleted_at", null)
      .gte("created_at", thirtyDaysAgo),
    // 5: New posts this week (counts)
    db
      .from("Posts")
      .select("office_id")
      .in("office_id", officeIds)
      .is("deleted_at", null)
      .is("parent_id", null)
      .gte("created_at", oneWeekAgo),
    // 6: Recent posts for inline display (top-level, last 50)
    db
      .from("Posts")
      .select("id, office_id, title, body, author_id, is_witness_post, created_at, Users!inner(username)")
      .in("office_id", officeIds)
      .is("deleted_at", null)
      .is("parent_id", null)
      .order("created_at", { ascending: false })
      .limit(50),
    // 7: User's watch state (empty result if no userId)
    userId
      ? db
          .from("OfficeWatches")
          .select("office_id")
          .eq("user_id", userId)
          .in("office_id", officeIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ]);

  // Build lookup maps — cast rows to Record<string, unknown> for safe access
  type Row = Record<string, unknown>;

  const officialsByOffice = new Map<string, { name: string; party?: string }>();
  for (const o of (officialsResult.data ?? []) as Row[]) {
    officialsByOffice.set(o.office_id as string, {
      name: o.name as string,
      party: (o.party as string) || undefined,
    });
  }

  const witnessByOffice = new Map<string, { username: string; userId: string }>();
  for (const w of (witnessesResult.data ?? []) as Row[]) {
    const user = w.Users as { username: string } | null;
    witnessByOffice.set(w.office_id as string, {
      username: user?.username ?? "unknown",
      userId: w.user_id as string,
    });
  }

  const watchCounts = new Map<string, number>();
  for (const w of (watchCountsResult.data ?? []) as Row[]) {
    const oid = w.office_id as string;
    watchCounts.set(oid, (watchCounts.get(oid) ?? 0) + 1);
  }

  // New post counts per office (this week)
  const newPostCounts = new Map<string, number>();
  let totalNewPosts = 0;
  for (const p of (newPostsResult.data ?? []) as Row[]) {
    const oid = p.office_id as string;
    newPostCounts.set(oid, (newPostCounts.get(oid) ?? 0) + 1);
    totalNewPosts++;
  }

  // Open elections
  type ElectionRow = { id: string; office_id: string; voting_closes_at: string };
  const openElections = new Map<string, ElectionRow>();
  for (const e of (electionsResult.data ?? []) as Row[]) {
    openElections.set(e.office_id as string, e as unknown as ElectionRow);
  }

  // Active witness detection
  const activeWitnessOffices = new Set<string>();
  for (const p of (recentWitnessPostsResult.data ?? []) as Row[]) {
    const witness = witnessByOffice.get(p.office_id as string);
    if (witness && witness.userId === (p.author_id as string)) {
      activeWitnessOffices.add(p.office_id as string);
    }
  }

  // User watch state
  const userWatchedOffices = new Set<string>();
  for (const w of (userWatchesResult.data ?? []) as Row[]) {
    userWatchedOffices.add(w.office_id as string);
  }

  // Recent posts grouped by office (max 3 per office)
  const recentPostsByOffice = new Map<string, BallotPostPreview[]>();
  for (const p of (recentPostsResult.data ?? []) as Row[]) {
    const oid = p.office_id as string;
    const existing = recentPostsByOffice.get(oid) ?? [];
    if (existing.length >= 3) continue;
    const author = p.Users as { username: string } | null;
    existing.push({
      id: p.id as string,
      title: (p.title as string) || undefined,
      body: p.body as string,
      authorUsername: author?.username,
      isWitnessPost: p.is_witness_post as boolean,
      replyCount: 0,
      createdAt: p.created_at as string,
    });
    recentPostsByOffice.set(oid, existing);
  }

  // 4. Build election alerts
  const electionAlerts: BallotElectionAlert[] = [];
  for (const [officeId, election] of openElections) {
    const officeRaw = officesRaw.find((o) => (o.id as string) === officeId);
    if (!officeRaw) continue;
    const district = (officeRaw as Record<string, unknown>).Districts as {
      geo_slug: string;
    };

    // Get candidate count for this election
    const { count: candidateCount } = await db
      .from("WitnessCandidacies")
      .select("*", { count: "exact", head: true })
      .eq("election_id", election.id)
      .is("withdrawn_at", null);

    // Check if user has voted
    let userHasVoted = false;
    if (userId) {
      const { data: vote } = await db
        .from("WitnessVotes")
        .select("id")
        .eq("election_id", election.id)
        .eq("voter_id", userId)
        .maybeSingle();
      userHasVoted = !!vote;
    }

    electionAlerts.push({
      officeId,
      officeTitle: officeRaw.title as string,
      officeHref: `/${district.geo_slug}/${officeRaw.slug as string}`,
      electionId: election.id,
      votingClosesAt: election.voting_closes_at,
      candidateCount: candidateCount ?? 0,
      userHasVoted,
    });
  }

  // 5. Build ballot offices
  const ballotOffices: BallotOffice[] = officesRaw.map((o) => {
    const district = (o as Record<string, unknown>).Districts as {
      kind: string;
      geo_slug: string;
    };
    const oid = o.id as string;
    const official = officialsByOffice.get(oid);
    const witness = witnessByOffice.get(oid);

    return {
      id: oid,
      title: o.title as string,
      slug: o.slug as string,
      kind: district.kind,
      districtGeoSlug: district.geo_slug as string,
      nextElectionAt: (o.next_election_at as string) || undefined,
      officialName: official?.name,
      officialParty: official?.party,
      witnessUsername: witness?.username,
      witnessIsActive: activeWitnessOffices.has(oid),
      watcherCount: watchCounts.get(oid) ?? 0,
      newPostCount: newPostCounts.get(oid) ?? 0,
      hasOpenElection: openElections.has(oid),
      isWatched: userWatchedOffices.has(oid),
      recentPosts: recentPostsByOffice.get(oid) ?? [],
    };
  });

  // 6. Group into layers
  const layerMap = new Map<string, { districtName: string; offices: BallotOffice[] }>();

  for (const office of ballotOffices) {
    const layer = classifyLayer(office.kind);
    if (!layerMap.has(layer)) {
      const district = districts.find((d) => classifyLayer(d.kind) === layer);
      layerMap.set(layer, {
        districtName: district?.name ?? layer,
        offices: [],
      });
    }
    layerMap.get(layer)!.offices.push(office);
  }

  // Combine County & Municipal into a single layer to match mockup
  const countyData = layerMap.get("County");
  const municipalData = layerMap.get("Municipal");
  if (countyData && municipalData) {
    countyData.offices.push(...municipalData.offices);
    layerMap.delete("Municipal");
    layerMap.set("County & Municipal", {
      districtName: countyData.districtName,
      offices: countyData.offices,
    });
    layerMap.delete("County");
  } else if (municipalData && !countyData) {
    layerMap.set("County & Municipal", municipalData);
    layerMap.delete("Municipal");
  } else if (countyData && !municipalData) {
    layerMap.set("County & Municipal", countyData);
    layerMap.delete("County");
  }

  const displayOrder = ["Federal", "State", "County & Municipal", "Other"];
  const layers: BallotLayer[] = displayOrder
    .filter((l) => layerMap.has(l))
    .map((l) => ({
      label: l,
      districtName: layerMap.get(l)!.districtName,
      offices: layerMap.get(l)!.offices,
    }));

  return {
    layers,
    homeDistrictName: homeDistrict.name,
    homeDistrictState: stateDistrict?.name,
    homeDistrictCounty: countyDistrict?.name,
    totalOffices: ballotOffices.length,
    watchedCount: userWatchedOffices.size,
    newPostsThisWeek: totalNewPosts,
    activeWitnesses: ballotOffices.filter((o) => o.witnessUsername && o.witnessIsActive).length,
    electionAlerts,
  };
}

// ─── District ancestry ──────────────────────────────────────────────────────

type DistrictRow = {
  id: string;
  name: string;
  kind: string;
  geoSlug: string;
  parentId?: string;
};

async function getDistrictAncestry(
  districtId: string
): Promise<DistrictRow[]> {
  // Walk up the parent chain collecting all ancestor districts.
  // Then also include sibling districts (e.g., US House districts, state-leg
  // districts) that share the same state parent — these are overlapping
  // geographic districts that belong on the user's ballot.
  const ancestors: DistrictRow[] = [];
  let currentId: string | null = districtId;
  let stateDistrictId: string | null = null;

  // Walk up the parent chain
  for (let i = 0; i < 10 && currentId; i++) {
    const q = await db
      .from("Districts")
      .select("id, name, kind, geo_slug, parent_id")
      .eq("id", currentId)
      .single();
    const row = q.data as Record<string, unknown> | null;

    if (!row) break;

    const district: DistrictRow = {
      id: row.id as string,
      name: row.name as string,
      kind: row.kind as string,
      geoSlug: row.geo_slug as string,
      parentId: (row.parent_id as string) || undefined,
    };
    ancestors.push(district);

    if (district.kind === "state") {
      stateDistrictId = district.id;
    }

    currentId = (row.parent_id as string) || null;
  }

  // Include overlapping districts: US House, US Senate, Governor, state-leg
  // districts that are children of the same state. These don't appear in the
  // direct parent chain but are on every resident's ballot.
  if (stateDistrictId) {
    const overlappingKinds = [
      "us_house",
      "us_senate_state",
      "governor_state",
      "state_house",
      "state_senate",
    ];
    const ancestorIds = new Set(ancestors.map((d) => d.id));

    const { data: siblings } = await db
      .from("Districts")
      .select("id, name, kind, geo_slug, parent_id")
      .eq("parent_id", stateDistrictId)
      .in("kind", overlappingKinds);

    for (const s of siblings ?? []) {
      if (!ancestorIds.has(s.id as string)) {
        ancestors.push({
          id: s.id as string,
          name: s.name as string,
          kind: s.kind as string,
          geoSlug: s.geo_slug as string,
          parentId: (s.parent_id as string) || undefined,
        });
      }
    }
  }

  return ancestors;
}
