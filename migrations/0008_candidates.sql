-- BallotCard: Candidates for upcoming elections.
-- Federal candidates come from the FEC API; state/local have no national source
-- yet (rendered as honest "coming" states). One row per person per race.

CREATE TABLE IF NOT EXISTS "Candidates" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "office_id" UUID NOT NULL REFERENCES "Offices"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "party" TEXT,
  "cycle" INT NOT NULL,                    -- election year, e.g. 2026
  "election_date" DATE,                    -- the election this candidacy is for
  "is_incumbent" BOOLEAN NOT NULL DEFAULT FALSE,
  "status" TEXT,                           -- source status, e.g. 'candidate' / 'future_candidate'
  "source" TEXT NOT NULL,                  -- 'fec', later 'state-sos', etc.
  "external_refs" JSONB,                   -- {fec_candidate_id: "H8MO07..."}
  "created_at" TIMESTAMPTZ DEFAULT NOW(),
  -- One row per person per office per cycle; the upsert key for ingestion.
  UNIQUE ("office_id", "cycle", "name")
);

CREATE INDEX IF NOT EXISTS "idx_candidates_office_cycle"
  ON "Candidates"("office_id", "cycle");

ALTER TABLE "Candidates" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read Candidates" ON "Candidates" FOR SELECT USING (true);
