-- BallotCard: honest election dates for staggered legislatures.
-- Most state senates have 4-year staggered terms — only ~half the districts
-- are up in any given cycle — but our source data (Open States bulk) carries no
-- per-seat term/class data. Rather than assert a false-precise year for the
-- seats that are actually mid-term, we flag them: the seat's next election is
-- the earlier candidate cycle OR the next one, and the UI renders "2026 or
-- 2028". Whole-chamber and 2-year cases stay exact (estimated = false).
ALTER TABLE "Offices"
  ADD COLUMN IF NOT EXISTS "next_election_estimated" BOOLEAN NOT NULL DEFAULT FALSE;
