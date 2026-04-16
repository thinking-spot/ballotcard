import { describe, it, expect, vi } from "vitest";
import {
  q,
  loginAsTestUser,
  getInserts,
  getUpdates,
  getUpserts,
  TEST_USER,
} from "@/test-utils/helpers";
import {
  declareCandidacyAction,
  withdrawCandidacyAction,
  castVoteAction,
  resolveElectionAction,
} from "@/lib/election-actions";
import { isResidentOfDistrictSubtree } from "@/lib/election-data";

// ── Fixtures ────────────────────────────────────────────────────────────────

// UUID-format IDs (Zod validation requires valid UUID format)
const ELECTION_ID = "00000000-0000-0000-0000-000000000e01";
const ELECTION_ID_2 = "00000000-0000-0000-0000-000000000e02";
const OFFICE_ID = "00000000-0000-0000-0000-0000000000f1";
const CANDIDACY_ID = "00000000-0000-0000-0000-000000000c01";
const CANDIDACY_ID_2 = "00000000-0000-0000-0000-000000000c02";

/** An election currently in the voting window. */
const OPEN_ELECTION = {
  id: ELECTION_ID,
  office_id: OFFICE_ID,
  voting_opens_at: new Date(Date.now() - 7 * 86400000).toISOString(),
  voting_closes_at: new Date(Date.now() + 7 * 86400000).toISOString(),
};

/** An election whose voting has closed. */
const CLOSED_ELECTION = {
  id: ELECTION_ID_2,
  office_id: OFFICE_ID,
  term_start: "2026-01-01",
  term_end: "2026-07-01",
  voting_opens_at: new Date(Date.now() - 30 * 86400000).toISOString(),
  voting_closes_at: new Date(Date.now() - 86400000).toISOString(),
  quorum: 3,
};

// ── declareCandidacyAction ──────────────────────────────────────────────────

describe("declareCandidacyAction", () => {
  const validInput = {
    electionId: ELECTION_ID,
    statementShort: "I will watch this office diligently.",
  };

  it("requires authentication", async () => {
    const result = await declareCandidacyAction(validInput);
    expect(result).toEqual({
      error: "You must be logged in to file a candidacy.",
    });
  });

  it("rejects after election closes", async () => {
    loginAsTestUser();
    q({
      ...OPEN_ELECTION,
      voting_closes_at: new Date(Date.now() - 86400000).toISOString(),
    });

    const result = await declareCandidacyAction(validInput);
    expect(result).toEqual({ error: "This election has closed." });
  });

  it("rejects non-resident", async () => {
    loginAsTestUser();
    q(OPEN_ELECTION); // election
    q({ district_id: "od-001" }); // getOfficeDistrictId
    vi.mocked(isResidentOfDistrictSubtree).mockResolvedValueOnce(false);

    const result = await declareCandidacyAction(validInput);
    expect(result).toEqual({
      error: "You must be a resident of this district to file a candidacy.",
    });
  });

  it("rejects duplicate active candidacy", async () => {
    loginAsTestUser();
    q(OPEN_ELECTION); // election
    q({ district_id: "od-001" }); // office district
    q({ id: "c-existing", withdrawn_at: null }); // existing active candidacy

    const result = await declareCandidacyAction(validInput);
    expect(result).toEqual({
      error: "You have already filed a candidacy for this election.",
    });
  });

  it("re-activates a withdrawn candidacy", async () => {
    loginAsTestUser();
    q(OPEN_ELECTION); // election
    q({ district_id: "od-001" }); // office district
    q({ id: "c-existing", withdrawn_at: "2026-01-01T00:00:00Z" }); // withdrawn
    q(null); // update success

    const result = await declareCandidacyAction(validInput);
    expect(result).toEqual({
      success: true,
      data: { candidacyId: "c-existing" },
    });
  });

  it("creates a new candidacy", async () => {
    loginAsTestUser();
    q(OPEN_ELECTION); // election
    q({ district_id: "od-001" }); // office district
    q(null); // no existing candidacy
    q({ id: "c-new" }); // inserted candidacy

    const result = await declareCandidacyAction(validInput);
    expect(result).toEqual({ success: true, data: { candidacyId: "c-new" } });
  });
});

// ── withdrawCandidacyAction ─────────────────────────────────────────────────

describe("withdrawCandidacyAction", () => {
  it("requires authentication", async () => {
    const result = await withdrawCandidacyAction("c-001");
    expect(result).toEqual({ error: "You must be logged in." });
  });

  it("rejects if not owner", async () => {
    loginAsTestUser();
    q({ id: "c-001", user_id: "other-user", withdrawn_at: null });

    const result = await withdrawCandidacyAction("c-001");
    expect(result).toEqual({
      error: "You can only withdraw your own candidacy.",
    });
  });

  it("rejects if already withdrawn", async () => {
    loginAsTestUser();
    q({
      id: "c-001",
      user_id: TEST_USER.id,
      withdrawn_at: "2026-01-01T00:00:00Z",
    });

    const result = await withdrawCandidacyAction("c-001");
    expect(result).toEqual({ error: "Candidacy is already withdrawn." });
  });

  it("withdraws successfully", async () => {
    loginAsTestUser();
    q({ id: "c-001", user_id: TEST_USER.id, withdrawn_at: null });
    q(null); // update success

    const result = await withdrawCandidacyAction("c-001");
    expect(result).toEqual({ success: true });
  });
});

// ── castVoteAction ──────────────────────────────────────────────────────────

describe("castVoteAction", () => {
  const validInput = { electionId: ELECTION_ID, candidacyId: CANDIDACY_ID };

  it("requires authentication", async () => {
    const result = await castVoteAction(validInput);
    expect(result).toEqual({ error: "You must be logged in to vote." });
  });

  it("rejects before voting opens", async () => {
    loginAsTestUser();
    q({
      ...OPEN_ELECTION,
      voting_opens_at: new Date(Date.now() + 86400000).toISOString(),
      voting_closes_at: new Date(Date.now() + 14 * 86400000).toISOString(),
    });

    const result = await castVoteAction(validInput);
    expect(result).toEqual({ error: "Voting has not opened yet." });
  });

  it("rejects after voting closes", async () => {
    loginAsTestUser();
    q({
      ...OPEN_ELECTION,
      voting_closes_at: new Date(Date.now() - 86400000).toISOString(),
    });

    const result = await castVoteAction(validInput);
    expect(result).toEqual({ error: "Voting has closed." });
  });

  it("rejects vote for withdrawn candidate", async () => {
    loginAsTestUser();
    q(OPEN_ELECTION); // election
    q({
      id: CANDIDACY_ID,
      election_id: ELECTION_ID,
      withdrawn_at: "2026-01-01T00:00:00Z",
    }); // withdrawn candidacy

    const result = await castVoteAction(validInput);
    expect(result).toEqual({
      error: "Cannot vote for a withdrawn candidate.",
    });
  });

  it("casts vote successfully", async () => {
    loginAsTestUser();
    q(OPEN_ELECTION); // election
    q({ id: CANDIDACY_ID, election_id: ELECTION_ID, withdrawn_at: null }); // candidacy
    q({ district_id: "od-001" }); // office district
    q(null); // upsert success

    const result = await castVoteAction(validInput);
    expect(result).toEqual({ success: true });
    expect(getUpserts("WitnessVotes")).toHaveLength(1);
  });
});

// ── resolveElectionAction ───────────────────────────────────────────────────

describe("resolveElectionAction", () => {
  it("requires authentication", async () => {
    const result = await resolveElectionAction("e-001");
    expect(result).toEqual({ error: "You must be logged in." });
  });

  it("returns error if election not found", async () => {
    loginAsTestUser();
    q(null);

    const result = await resolveElectionAction("e-001");
    expect(result).toEqual({ error: "Election not found." });
  });

  it("returns error if voting has not closed", async () => {
    loginAsTestUser();
    q({
      ...CLOSED_ELECTION,
      voting_closes_at: new Date(Date.now() + 86400000).toISOString(),
    });

    const result = await resolveElectionAction("e-002");
    expect(result).toEqual({ error: "Voting has not closed yet." });
  });

  it("returns error if already resolved", async () => {
    loginAsTestUser();
    q(CLOSED_ELECTION); // election
    q({ id: "w-existing" }); // existing witness = already resolved

    const result = await resolveElectionAction("e-002");
    expect(result).toEqual({
      error: "This election has already been resolved.",
    });
  });

  it("creates next election when quorum not met", async () => {
    loginAsTestUser();
    q(CLOSED_ELECTION); // election
    q(null); // no existing witness
    q([{ candidacy_id: "c-1" }]); // 1 vote (quorum is 3)
    q(null); // no existing next election
    q(null); // insert next election

    const result = await resolveElectionAction("e-002");
    expect(result).toHaveProperty("success", true);
    expect((result as any).data.reason).toContain("Quorum not met");

    const electionInserts = getInserts("WitnessElections");
    expect(electionInserts).toHaveLength(1);
  });

  it("computes correct next election dates", async () => {
    loginAsTestUser();

    // 6-month term: Jan 1 to Jul 1 2026
    const termStart = "2026-01-01";
    const termEnd = "2026-07-01";
    const durationMs =
      new Date(termEnd).getTime() - new Date(termStart).getTime();
    const nextTermStart = new Date(termEnd);
    const nextTermEnd = new Date(nextTermStart.getTime() + durationMs);

    q({
      id: "e-date",
      office_id: "o-date",
      term_start: termStart,
      term_end: termEnd,
      voting_closes_at: "2025-12-31T00:00:00Z",
      quorum: 100,
    }); // election
    q(null); // no existing witness
    q([]); // 0 votes (quorum not met)
    q(null); // no existing next election
    q(null); // insert

    await resolveElectionAction("e-date");

    const inserted = getInserts("WitnessElections")[0].row as Record<
      string,
      unknown
    >;

    expect(inserted.term_start).toBe(
      nextTermStart.toISOString().split("T")[0]
    );
    expect(inserted.term_end).toBe(nextTermEnd.toISOString().split("T")[0]);

    // Filing opens 30 days before next term
    const filingDaysBefore =
      (nextTermStart.getTime() -
        new Date(inserted.filing_opens_at as string).getTime()) /
      86400000;
    expect(filingDaysBefore).toBe(30);

    // Voting opens 14 days before next term
    const votingDaysBefore =
      (nextTermStart.getTime() -
        new Date(inserted.voting_opens_at as string).getTime()) /
      86400000;
    expect(votingDaysBefore).toBe(14);

    // Voting closes at next term start
    expect(inserted.voting_closes_at).toBe(nextTermStart.toISOString());

    expect(inserted.quorum).toBe(100);
  });

  it("seats winner with most votes", async () => {
    loginAsTestUser();
    q(CLOSED_ELECTION); // election
    q(null); // no existing witness
    q([
      // 4 votes: c-1 gets 3, c-2 gets 1
      { candidacy_id: "c-1" },
      { candidacy_id: "c-1" },
      { candidacy_id: "c-1" },
      { candidacy_id: "c-2" },
    ]);
    q([
      // active candidacies
      { id: "c-1", user_id: "u-winner" },
      { id: "c-2", user_id: "u-loser" },
    ]);
    q(null); // unseat previous witness
    q({ id: "w-new" }); // seat winner
    q(null); // no existing next election
    q(null); // insert next election

    const result = await resolveElectionAction("e-002");
    expect(result).toHaveProperty("success", true);
    expect((result as any).data.witnessId).toBe("w-new");
    expect((result as any).data.reason).toContain("3 vote");

    // Verify winner was seated
    const witnessInserts = getInserts("Witnesses");
    expect(witnessInserts).toHaveLength(1);
    expect((witnessInserts[0].row as any).user_id).toBe("u-winner");
    expect((witnessInserts[0].row as any).is_current).toBe(true);
  });
});
