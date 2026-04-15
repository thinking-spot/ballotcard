import { db } from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

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
  witnessIsActive: boolean; // has posted in last 30 days
  watcherCount: number;
  hasOpenElection: boolean;
};

export type BallotLayer = {
  label: string;
  districtName: string;
  offices: BallotOffice[];
};

export type BallotData = {
  layers: BallotLayer[];
  homeDistrictName: string;
  totalOffices: number;
  activeWitnesses: number;
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
  homeDistrictId: string
): Promise<BallotData | null> {
  // 1. Get the home district and walk up the parent chain
  const districts = await getDistrictAncestry(homeDistrictId);
  if (districts.length === 0) return null;

  const homeDistrict = districts[0]; // the user's actual home district
  const districtIds = districts.map((d) => d.id);

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
      totalOffices: 0,
      activeWitnesses: 0,
    };
  }

  const officeIds = officesRaw.map((o) => o.id as string);

  // 3. Batch-fetch related data in parallel
  const thirtyDaysAgo = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000
  ).toISOString();

  const [officialsResult, witnessesResult, watchCountsResult, electionsResult, recentPostsResult] =
    await Promise.all([
      // Current officials for these offices
      db
        .from("Officials")
        .select("office_id, name, party")
        .in("office_id", officeIds)
        .eq("is_current", true),
      // Current witnesses
      db
        .from("Witnesses")
        .select("office_id, user_id, Users!inner(username)")
        .in("office_id", officeIds)
        .eq("is_current", true),
      // Watcher counts per office
      db
        .from("OfficeWatches")
        .select("office_id")
        .in("office_id", officeIds),
      // Open elections (voting currently open)
      db
        .from("WitnessElections")
        .select("office_id")
        .in("office_id", officeIds)
        .lte("voting_opens_at", new Date().toISOString())
        .gte("voting_closes_at", new Date().toISOString()),
      // Recent witness posts (for activity detection)
      db
        .from("Posts")
        .select("office_id, author_id")
        .in("office_id", officeIds)
        .eq("is_witness_post", true)
        .is("deleted_at", null)
        .gte("created_at", thirtyDaysAgo),
    ]);

  // Build lookup maps
  const officialsByOffice = new Map<string, { name: string; party?: string }>();
  for (const o of officialsResult.data ?? []) {
    officialsByOffice.set(o.office_id as string, {
      name: o.name as string,
      party: (o.party as string) || undefined,
    });
  }

  const witnessByOffice = new Map<string, { username: string; userId: string }>();
  for (const w of witnessesResult.data ?? []) {
    const user = (w as Record<string, unknown>).Users as { username: string } | null;
    witnessByOffice.set(w.office_id as string, {
      username: user?.username ?? "unknown",
      userId: w.user_id as string,
    });
  }

  const watchCounts = new Map<string, number>();
  for (const w of watchCountsResult.data ?? []) {
    const oid = w.office_id as string;
    watchCounts.set(oid, (watchCounts.get(oid) ?? 0) + 1);
  }

  const openElections = new Set<string>();
  for (const e of electionsResult.data ?? []) {
    openElections.add(e.office_id as string);
  }

  // Active witness = has posted in last 30 days
  const activeWitnessOffices = new Set<string>();
  for (const p of recentPostsResult.data ?? []) {
    const witness = witnessByOffice.get(p.office_id as string);
    if (witness && witness.userId === (p.author_id as string)) {
      activeWitnessOffices.add(p.office_id as string);
    }
  }

  // 4. Build ballot offices
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
      hasOpenElection: openElections.has(oid),
    };
  });

  // 5. Group into layers
  const layerMap = new Map<string, { districtName: string; offices: BallotOffice[] }>();

  for (const office of ballotOffices) {
    const layer = classifyLayer(office.kind);
    if (!layerMap.has(layer)) {
      // Find the district name for this layer
      const district = districts.find((d) => classifyLayer(d.kind) === layer);
      layerMap.set(layer, {
        districtName: district?.name ?? layer,
        offices: [],
      });
    }
    layerMap.get(layer)!.offices.push(office);
  }

  const layers: BallotLayer[] = LAYER_ORDER
    .filter((l) => layerMap.has(l))
    .map((l) => ({
      label: l,
      districtName: layerMap.get(l)!.districtName,
      offices: layerMap.get(l)!.offices,
    }));

  return {
    layers,
    homeDistrictName: homeDistrict.name,
    totalOffices: ballotOffices.length,
    activeWitnesses: ballotOffices.filter((o) => o.witnessUsername && o.witnessIsActive).length,
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
