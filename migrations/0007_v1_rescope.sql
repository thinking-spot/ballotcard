-- BallotCard v1.0 rescope (2026-06): remove the Witness/forum/auth layer entirely;
-- extend the civic data layer for the faithful full-ballot model.
-- See docs/V1-SPEC.md. Git history preserves the removed schema.

-- 1. REMOVE the Witness / forum / auth layer
DROP TABLE IF EXISTS "PostRevisions";
DROP TABLE IF EXISTS "ModActions";
DROP TABLE IF EXISTS "PostTags";
DROP TABLE IF EXISTS "Tags";
DROP TABLE IF EXISTS "Posts";
DROP TABLE IF EXISTS "OfficeWatches";
DROP TABLE IF EXISTS "OfficeFollows";
DROP TABLE IF EXISTS "WitnessVotes";
DROP TABLE IF EXISTS "WitnessCandidacies";
DROP TABLE IF EXISTS "WitnessElections";
DROP TABLE IF EXISTS "Witnesses";
DROP TABLE IF EXISTS "Users";

-- 2. EXTEND Offices: three classification axes replacing the single 'kind'.
-- branch: which arm of government the seat belongs to.
-- level: which layer of the ballot it appears on.
-- selection_method: how the seat is filled; only elected_* and retention render on ballot cards.
ALTER TABLE "Offices"
  ADD COLUMN IF NOT EXISTS "branch" TEXT,
  ADD COLUMN IF NOT EXISTS "level" TEXT,
  ADD COLUMN IF NOT EXISTS "selection_method" TEXT NOT NULL DEFAULT 'elected_partisan';

-- Backfill branch from the legacy 'kind' column.
UPDATE "Offices" SET "branch" = CASE "kind"
  WHEN 'legislative' THEN 'legislative'
  WHEN 'executive'   THEN 'executive'
  WHEN 'judicial'    THEN 'judicial'
  ELSE 'other'
END
WHERE "branch" IS NULL;

-- Backfill level from the bound district's kind.
UPDATE "Offices" o SET "level" = CASE d."kind"
  WHEN 'country'         THEN 'federal'
  WHEN 'us_house'        THEN 'federal'
  WHEN 'us_senate_state' THEN 'federal'
  WHEN 'state'           THEN 'state'
  WHEN 'governor_state'  THEN 'state'
  WHEN 'state_house'     THEN 'state'
  WHEN 'state_senate'    THEN 'state'
  WHEN 'county'          THEN 'county'
  WHEN 'judicial'        THEN 'state'
  WHEN 'municipality'    THEN 'municipal'
  WHEN 'school_board'    THEN 'special'
  ELSE 'special'
END
FROM "Districts" d
WHERE o."district_id" = d."id" AND o."level" IS NULL;

-- US Senate offices are bound to state-kind districts; the district-kind backfill
-- above would mislabel them. They are federal seats.
UPDATE "Offices" SET "level" = 'federal' WHERE "title" LIKE 'US Senate%';

ALTER TABLE "Offices"
  ALTER COLUMN "branch" SET NOT NULL,
  ALTER COLUMN "level" SET NOT NULL,
  ADD CONSTRAINT "offices_branch_check" CHECK ("branch" IN
    ('executive', 'legislative', 'judicial', 'law_enforcement', 'other')),
  ADD CONSTRAINT "offices_level_check" CHECK ("level" IN
    ('federal', 'state', 'county', 'municipal', 'special')),
  ADD CONSTRAINT "offices_selection_check" CHECK ("selection_method" IN
    ('elected_partisan', 'elected_nonpartisan', 'retention', 'appointed'));

CREATE INDEX IF NOT EXISTS "idx_offices_level_branch" ON "Offices"("level", "branch");

-- 3. EXTEND Officials: photo + sworn-in metadata for the ballot card rows.
ALTER TABLE "Officials"
  ADD COLUMN IF NOT EXISTS "photo_url" TEXT,
  ADD COLUMN IF NOT EXISTS "first_took_office" DATE;  -- start of continuous service ("in office since")

-- Upsert key for ingestion: one current official per office.
-- (History rows have is_current = false and are exempt.)
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_officials_current_per_office"
  ON "Officials"("office_id") WHERE "is_current" = TRUE;

-- 4. IngestionRuns: provenance for the "data as of" stamps shown on every page.
CREATE TABLE IF NOT EXISTS "IngestionRuns" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "source" TEXT NOT NULL,                 -- 'congress-legislators', 'openstates-people', 'seed:governors', ...
  "started_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "finished_at" TIMESTAMPTZ,
  "status" TEXT NOT NULL DEFAULT 'running',  -- 'running' | 'succeeded' | 'failed'
  "counts" JSONB,                         -- {districts: n, offices: n, officials: n, ...}
  "error" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_ingestion_runs_source" ON "IngestionRuns"("source", "started_at" DESC);

ALTER TABLE "IngestionRuns" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read IngestionRuns" ON "IngestionRuns" FOR SELECT USING (true);

-- 5. RLS hygiene: the only remaining write path is the service role (ingestion),
-- which bypasses RLS. No anon/auth write policies remain anywhere.
