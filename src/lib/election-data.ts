import { db } from "@/lib/supabase";
import { auth } from "@/auth";
import type { BreadcrumbItem } from "@/lib/office-data";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ElectionCandidate = {
  candidacyId: string;
  userId: string;
  username: string;
  statementShort: string;
  statementLong?: string;
  filedAt: string;
  voteCount: number;
  isWithdrawn: boolean;
};

export type ElectionPageData = {
  breadcrumbs: BreadcrumbItem[];
  district: {
    id: string;
    name: string;
    geoSlug: string;
  };
  office: {
    id: string;
    title: string;
    slug: string;
  };
  election: {
    id: string;
    termStart: string;
    termEnd: string;
    filingOpensAt: string;
    votingOpensAt: string;
    votingClosesAt: string;
    quorum: number;
  };
  candidates: ElectionCandidate[];
  currentWitnessUsername?: string;
  phase: "filing" | "voting" | "closed";
  userVotedCandidacyId?: string;
  userCandidacyId?: string;
  isResidentOfDistrict: boolean;
  totalVotes: number;
};

// ─── Phase calculation ───────────────────────────────────────────────────────

function getElectionPhase(election: {
  filing_opens_at: string;
  voting_opens_at: string;
  voting_closes_at: string;
}): "filing" | "voting" | "closed" {
  const now = new Date();
  const votingOpens = new Date(election.voting_opens_at);
  const votingCloses = new Date(election.voting_closes_at);

  if (now < votingOpens) return "filing";
  if (now <= votingCloses) return "voting";
  return "closed";
}

// ─── District residency check ────────────────────────────────────────────────

/**
 * Check if a user's home district is in the subtree rooted at the office's
 * district. Walk up the user's home district parent chain and see if it
 * reaches the office district.
 */
export async function isResidentOfDistrictSubtree(
  userHomeDistrictId: string,
  officeDistrictId: string
): Promise<boolean> {
  if (userHomeDistrictId === officeDistrictId) return true;

  // Walk up from the office district to find all ancestors
  const officeAncestors = new Set<string>([officeDistrictId]);
  let currentId: string | null = officeDistrictId;
  for (let i = 0; i < 10 && currentId; i++) {
    const { data } = await db
      .from("Districts")
      .select("parent_id")
      .eq("id", currentId)
      .maybeSingle();
    if (!data?.parent_id) break;
    officeAncestors.add(data.parent_id as string);
    currentId = data.parent_id as string;
  }

  // Walk up from the user's home district and check overlap
  let homeId: string | null = userHomeDistrictId;
  for (let i = 0; i < 10 && homeId; i++) {
    if (officeAncestors.has(homeId)) return true;
    const { data } = await db
      .from("Districts")
      .select("parent_id")
      .eq("id", homeId)
      .maybeSingle();
    if (!data?.parent_id) break;
    homeId = data.parent_id as string;
  }

  return false;
}

// ─── Main data fetcher ───────────────────────────────────────────────────────

export async function getElectionPageData(
  districtGeoSlug: string,
  officeSlug: string
): Promise<ElectionPageData | null> {
  // 1. Resolve district + office
  const { data: districtRaw } = await db
    .from("Districts")
    .select(
      `id, name, geo_slug,
       parent:parent_id(
         id, name, geo_slug,
         parent:parent_id(id, name, geo_slug)
       )`
    )
    .eq("geo_slug", districtGeoSlug)
    .single();

  if (!districtRaw) return null;

  const { data: officeRaw } = await db
    .from("Offices")
    .select("id, title, slug, district_id")
    .eq("district_id", districtRaw.id)
    .eq("slug", officeSlug)
    .maybeSingle();

  if (!officeRaw) return null;

  // 2. Get the most recent election for this office
  const { data: electionRaw } = await db
    .from("WitnessElections")
    .select("*")
    .eq("office_id", officeRaw.id)
    .order("voting_closes_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!electionRaw) return null;

  const phase = getElectionPhase(electionRaw as {
    filing_opens_at: string;
    voting_opens_at: string;
    voting_closes_at: string;
  });

  // 3. Get candidates with vote counts
  const { data: candidaciesRaw } = await db
    .from("WitnessCandidacies")
    .select("id, user_id, statement_short, statement_long, withdrawn_at, created_at")
    .eq("election_id", electionRaw.id)
    .order("created_at", { ascending: true });

  const candidacies = candidaciesRaw ?? [];
  const candidacyIds = candidacies.map((c) => c.id as string);
  const userIds = candidacies.map((c) => c.user_id as string);

  // 4. Fetch usernames, votes, and current witness in parallel
  const [usernameResult, votesResult, witnessResult] = await Promise.all([
    userIds.length > 0
      ? db.from("Users").select("id, username").in("id", userIds)
      : Promise.resolve({ data: [] }),
    candidacyIds.length > 0
      ? db.from("WitnessVotes").select("candidacy_id").in("candidacy_id", candidacyIds)
      : Promise.resolve({ data: [] }),
    db
      .from("Witnesses")
      .select("user_id, Users!inner(username)")
      .eq("office_id", officeRaw.id)
      .eq("is_current", true)
      .maybeSingle(),
  ]);

  const usernameMap = new Map(
    (usernameResult.data ?? []).map((u) => [u.id as string, u.username as string])
  );

  const voteCountMap = new Map<string, number>();
  for (const v of votesResult.data ?? []) {
    const cid = v.candidacy_id as string;
    voteCountMap.set(cid, (voteCountMap.get(cid) ?? 0) + 1);
  }

  const totalVotes = (votesResult.data ?? []).length;

  const candidates: ElectionCandidate[] = candidacies.map((c) => ({
    candidacyId: c.id as string,
    userId: c.user_id as string,
    username: usernameMap.get(c.user_id as string) ?? "unknown",
    statementShort: c.statement_short as string,
    statementLong: (c.statement_long as string) || undefined,
    filedAt: c.created_at as string,
    voteCount: voteCountMap.get(c.id as string) ?? 0,
    isWithdrawn: !!(c.withdrawn_at as string | null),
  }));

  // Sort: active candidates first, then by vote count desc
  candidates.sort((a, b) => {
    if (a.isWithdrawn !== b.isWithdrawn) return a.isWithdrawn ? 1 : -1;
    return b.voteCount - a.voteCount;
  });

  // 5. Check auth state
  const session = await auth();
  let userVotedCandidacyId: string | undefined;
  let userCandidacyId: string | undefined;
  let isResidentOfDistrict = false;

  if (session?.user.id) {
    // Check if user has voted
    const { data: vote } = await db
      .from("WitnessVotes")
      .select("candidacy_id")
      .eq("election_id", electionRaw.id)
      .eq("voter_id", session.user.id)
      .maybeSingle();

    if (vote) {
      userVotedCandidacyId = vote.candidacy_id as string;
    }

    // Check if user is a candidate
    const userCandidate = candidacies.find(
      (c) => (c.user_id as string) === session.user.id
    );
    if (userCandidate) {
      userCandidacyId = userCandidate.id as string;
    }

    // Check district residency
    if (session.user.homeDistrictId) {
      isResidentOfDistrict = await isResidentOfDistrictSubtree(
        session.user.homeDistrictId,
        officeRaw.district_id as string
      );
    }
  }

  // 6. Build breadcrumbs
  type ParentRow = { name: string; geo_slug: string };
  const ancestors: ParentRow[] = [];
  const parent = (districtRaw as Record<string, unknown>).parent as
    | (ParentRow & { parent?: ParentRow })
    | null;
  if (parent) {
    if (parent.parent) ancestors.push(parent.parent);
    ancestors.push({ name: parent.name, geo_slug: parent.geo_slug });
  }

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
    href: `/${districtRaw.geo_slug}/${officeRaw.slug}`,
  });
  breadcrumbs.push({ label: "Witness election", href: "" });

  const currentWitness = witnessResult.data as Record<string, unknown> | null;
  const currentWitnessUser = currentWitness?.Users as { username: string } | null;

  return {
    breadcrumbs,
    district: {
      id: districtRaw.id as string,
      name: districtRaw.name as string,
      geoSlug: districtRaw.geo_slug as string,
    },
    office: {
      id: officeRaw.id as string,
      title: officeRaw.title as string,
      slug: officeRaw.slug as string,
    },
    election: {
      id: electionRaw.id as string,
      termStart: electionRaw.term_start as string,
      termEnd: electionRaw.term_end as string,
      filingOpensAt: electionRaw.filing_opens_at as string,
      votingOpensAt: electionRaw.voting_opens_at as string,
      votingClosesAt: electionRaw.voting_closes_at as string,
      quorum: electionRaw.quorum as number,
    },
    candidates,
    currentWitnessUsername: currentWitnessUser?.username,
    phase,
    userVotedCandidacyId,
    userCandidacyId,
    isResidentOfDistrict,
    totalVotes,
  };
}
