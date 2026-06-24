-- BallotCard: Federal primary dates + per-candidate money totals.
-- Both are pure additive enhancements sourced from the FEC API:
--   /election-dates/         → state-level primary date per office type
--   /candidates/{id}/totals/ → receipts + cash on hand per candidate
-- Pages still render fine when these are null.

ALTER TABLE "Offices"
  ADD COLUMN IF NOT EXISTS "primary_election_at" DATE;

ALTER TABLE "Candidates"
  ADD COLUMN IF NOT EXISTS "fec_totals" JSONB;
-- Shape: { receipts: number, disbursements: number, cash_on_hand: number, last_report: "YYYY-MM-DD" }
