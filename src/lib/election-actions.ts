"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/supabase";
import { CandidacySchema, CastVoteSchema } from "@/lib/validation";
import { limits } from "@/lib/rate-limit";
import { isResidentOfDistrictSubtree } from "@/lib/election-data";

// ─── Declare candidacy ────────────────────────────────────────────────────────

export async function declareCandidacyAction(input: {
  electionId: string;
  statementShort: string;
  statementLong?: string;
}): Promise<{ success: true; data: { candidacyId: string } } | { error: string }> {
  const session = await auth();
  if (!session) return { error: "You must be logged in to file a candidacy." };

  const parsed = CandidacySchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { electionId, statementShort, statementLong } = parsed.data;

  if (!limits.fileCandidacy(session.user.id)) {
    return { error: "Too many candidacy filings. Please wait." };
  }

  // Fetch election and verify it's in the filing phase
  const { data: election } = await db
    .from("WitnessElections")
    .select("id, office_id, voting_opens_at, voting_closes_at")
    .eq("id", electionId)
    .maybeSingle();

  if (!election) return { error: "Election not found." };

  const now = new Date();
  const votingOpens = new Date(election.voting_opens_at as string);
  const votingCloses = new Date(election.voting_closes_at as string);

  if (now >= votingCloses) {
    return { error: "This election has closed." };
  }

  // Allow filing during both filing and voting phases
  // (late entries are allowed while voting is open)
  if (now >= votingOpens) {
    // Still allowed — late filing during voting
  }

  // Check district residency
  if (!session.user.homeDistrictId) {
    return { error: "You must set a home district before filing." };
  }

  const officeDistrictId = await getOfficeDistrictId(election.office_id as string);
  if (!officeDistrictId) return { error: "Office not found." };

  const isResident = await isResidentOfDistrictSubtree(
    session.user.homeDistrictId,
    officeDistrictId
  );
  if (!isResident) {
    return { error: "You must be a resident of this district to file a candidacy." };
  }

  // Check for existing candidacy
  const { data: existing } = await db
    .from("WitnessCandidacies")
    .select("id, withdrawn_at")
    .eq("election_id", electionId)
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (existing && !existing.withdrawn_at) {
    return { error: "You have already filed a candidacy for this election." };
  }

  // If they previously withdrew, re-activate the candidacy
  if (existing && existing.withdrawn_at) {
    const { error: updateError } = await db
      .from("WitnessCandidacies")
      .update({
        withdrawn_at: null,
        statement_short: statementShort,
        statement_long: statementLong ?? null,
      })
      .eq("id", existing.id);

    if (updateError) {
      return { error: "Failed to re-file candidacy. Please try again." };
    }

    revalidatePath("/[state]/[...slug]", "page");
    return { success: true, data: { candidacyId: existing.id as string } };
  }

  // Insert new candidacy
  const { data: candidacy, error: insertError } = await db
    .from("WitnessCandidacies")
    .insert({
      election_id: electionId,
      user_id: session.user.id,
      statement_short: statementShort,
      statement_long: statementLong ?? null,
    })
    .select("id")
    .single();

  if (insertError || !candidacy) {
    return { error: "Failed to file candidacy. Please try again." };
  }

  revalidatePath("/[state]/[...slug]", "page");
  revalidatePath("/ballot", "page");

  return { success: true, data: { candidacyId: candidacy.id as string } };
}

// ─── Withdraw candidacy ──────────────────────────────────────────────────────

export async function withdrawCandidacyAction(
  candidacyId: string
): Promise<{ success: true } | { error: string }> {
  const session = await auth();
  if (!session) return { error: "You must be logged in." };

  const { data: candidacy } = await db
    .from("WitnessCandidacies")
    .select("id, user_id, withdrawn_at")
    .eq("id", candidacyId)
    .maybeSingle();

  if (!candidacy) return { error: "Candidacy not found." };
  if (candidacy.user_id !== session.user.id) {
    return { error: "You can only withdraw your own candidacy." };
  }
  if (candidacy.withdrawn_at) {
    return { error: "Candidacy is already withdrawn." };
  }

  const { error: updateError } = await db
    .from("WitnessCandidacies")
    .update({ withdrawn_at: new Date().toISOString() })
    .eq("id", candidacyId);

  if (updateError) {
    return { error: "Failed to withdraw candidacy. Please try again." };
  }

  revalidatePath("/[state]/[...slug]", "page");
  revalidatePath("/ballot", "page");

  return { success: true };
}

// ─── Cast vote ────────────────────────────────────────────────────────────────

export async function castVoteAction(input: {
  electionId: string;
  candidacyId: string;
}): Promise<{ success: true } | { error: string }> {
  const session = await auth();
  if (!session) return { error: "You must be logged in to vote." };

  const parsed = CastVoteSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { electionId, candidacyId } = parsed.data;

  if (!limits.castVote(session.user.id)) {
    return { error: "Too many vote changes. Please wait." };
  }

  // Fetch election and verify voting is open
  const { data: election } = await db
    .from("WitnessElections")
    .select("id, office_id, voting_opens_at, voting_closes_at")
    .eq("id", electionId)
    .maybeSingle();

  if (!election) return { error: "Election not found." };

  const now = new Date();
  const votingOpens = new Date(election.voting_opens_at as string);
  const votingCloses = new Date(election.voting_closes_at as string);

  if (now < votingOpens) {
    return { error: "Voting has not opened yet." };
  }
  if (now > votingCloses) {
    return { error: "Voting has closed." };
  }

  // Verify candidate exists and is not withdrawn
  const { data: candidacy } = await db
    .from("WitnessCandidacies")
    .select("id, election_id, withdrawn_at")
    .eq("id", candidacyId)
    .maybeSingle();

  if (!candidacy) return { error: "Candidate not found." };
  if (candidacy.election_id !== electionId) {
    return { error: "Candidate is not in this election." };
  }
  if (candidacy.withdrawn_at) {
    return { error: "Cannot vote for a withdrawn candidate." };
  }

  // Check district residency
  if (!session.user.homeDistrictId) {
    return { error: "You must set a home district before voting." };
  }

  const officeDistrictId = await getOfficeDistrictId(election.office_id as string);
  if (!officeDistrictId) return { error: "Office not found." };

  const isResident = await isResidentOfDistrictSubtree(
    session.user.homeDistrictId,
    officeDistrictId
  );
  if (!isResident) {
    return { error: "You must be a resident of this district to vote." };
  }

  // Upsert vote — one per voter per election, changeable
  const { error: voteError } = await db
    .from("WitnessVotes")
    .upsert(
      {
        election_id: electionId,
        voter_id: session.user.id,
        candidacy_id: candidacyId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "election_id,voter_id" }
    );

  if (voteError) {
    return { error: "Failed to cast vote. Please try again." };
  }

  revalidatePath("/[state]/[...slug]", "page");
  revalidatePath("/ballot", "page");

  return { success: true };
}

// ─── Resolve election ────────────────────────────────────────────────────────

export async function resolveElectionAction(
  electionId: string
): Promise<{ success: true; data: { witnessId?: string; reason: string } } | { error: string }> {
  const session = await auth();
  if (!session) return { error: "You must be logged in." };

  // Fetch election
  const { data: election } = await db
    .from("WitnessElections")
    .select("id, office_id, term_start, term_end, voting_closes_at, quorum")
    .eq("id", electionId)
    .maybeSingle();

  if (!election) return { error: "Election not found." };

  const now = new Date();
  const votingCloses = new Date(election.voting_closes_at as string);

  if (now <= votingCloses) {
    return { error: "Voting has not closed yet." };
  }

  // Check if a Witness has already been seated for this term
  const { data: existingWitness } = await db
    .from("Witnesses")
    .select("id")
    .eq("office_id", election.office_id)
    .eq("term_start", election.term_start)
    .maybeSingle();

  if (existingWitness) {
    return { error: "This election has already been resolved." };
  }

  // Count votes per candidate
  const { data: votes } = await db
    .from("WitnessVotes")
    .select("candidacy_id")
    .eq("election_id", electionId);

  const totalVotes = (votes ?? []).length;
  const quorum = election.quorum as number;

  if (totalVotes < quorum) {
    return {
      success: true,
      data: {
        reason: `Quorum not met (${totalVotes}/${quorum} votes). No Witness seated.`,
      },
    };
  }

  // Tally votes
  const tally = new Map<string, number>();
  for (const v of votes ?? []) {
    const cid = v.candidacy_id as string;
    tally.set(cid, (tally.get(cid) ?? 0) + 1);
  }

  // Find the winner (most votes, exclude withdrawn)
  const { data: activeCandidacies } = await db
    .from("WitnessCandidacies")
    .select("id, user_id")
    .eq("election_id", electionId)
    .is("withdrawn_at", null);

  let winnerId: string | null = null;
  let winnerUserId: string | null = null;
  let maxVotes = 0;

  for (const c of activeCandidacies ?? []) {
    const count = tally.get(c.id as string) ?? 0;
    if (count > maxVotes) {
      maxVotes = count;
      winnerId = c.id as string;
      winnerUserId = c.user_id as string;
    }
  }

  if (!winnerId || !winnerUserId) {
    return {
      success: true,
      data: { reason: "No active candidates received votes. No Witness seated." },
    };
  }

  // Unseat any current Witness for this office
  await db
    .from("Witnesses")
    .update({ is_current: false })
    .eq("office_id", election.office_id)
    .eq("is_current", true);

  // Seat the winner
  const { data: witness, error: witnessError } = await db
    .from("Witnesses")
    .insert({
      office_id: election.office_id,
      user_id: winnerUserId,
      term_start: election.term_start,
      term_end: election.term_end,
      is_current: true,
    })
    .select("id")
    .single();

  if (witnessError || !witness) {
    return { error: "Failed to seat Witness. Please try again." };
  }

  revalidatePath("/[state]/[...slug]", "page");
  revalidatePath("/ballot", "page");

  return {
    success: true,
    data: {
      witnessId: witness.id as string,
      reason: `Witness seated with ${maxVotes} vote${maxVotes !== 1 ? "s" : ""} (${totalVotes} total, quorum was ${quorum}).`,
    },
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getOfficeDistrictId(officeId: string): Promise<string | null> {
  const { data } = await db
    .from("Offices")
    .select("district_id")
    .eq("id", officeId)
    .maybeSingle();
  return (data?.district_id as string) ?? null;
}
