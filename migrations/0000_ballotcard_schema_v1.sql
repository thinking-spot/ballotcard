-- BallotCard V1 Schema
-- Public-by-default civic accountability platform
-- Conventions: PascalCase tables (quoted), snake_case columns, UUID PKs, RLS on all tables.

-- 1. CLEANUP (Drop All)
DROP TABLE IF EXISTS "ModActions";
DROP TABLE IF EXISTS "PostTags";
DROP TABLE IF EXISTS "Tags";
DROP TABLE IF EXISTS "Posts";
DROP TABLE IF EXISTS "OfficeFollows";
DROP TABLE IF EXISTS "WitnessVotes";
DROP TABLE IF EXISTS "WitnessCandidacies";
DROP TABLE IF EXISTS "WitnessElections";
DROP TABLE IF EXISTS "Witnesses";
DROP TABLE IF EXISTS "Officials";
DROP TABLE IF EXISTS "Offices";
DROP TABLE IF EXISTS "Users";
DROP TABLE IF EXISTS "Districts";

-- 2. TABLES

-- Districts: nested geographic units forming a tree via parent_id.
-- kind examples: 'country', 'state', 'us_house', 'us_senate_state', 'governor_state',
-- 'state_house', 'state_senate', 'county', 'municipality', 'school_board', 'judicial'.
CREATE TABLE "Districts" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "state" TEXT,                           -- two-letter state code, null for country-level
  "parent_id" UUID REFERENCES "Districts"("id") ON DELETE SET NULL,
  "geo_slug" TEXT UNIQUE NOT NULL,        -- 'nc/new-hanover', 'us/nc-07'
  "external_refs" JSONB,                  -- {census_geoid: "...", openstates_id: "..."}
  "activated_at" TIMESTAMPTZ,             -- null for seeded-but-inactive; set on first user activity
  "created_at" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX "idx_districts_parent" ON "Districts"("parent_id");
CREATE INDEX "idx_districts_state" ON "Districts"("state");

-- Users: pseudonymous. Self-stated home district.
CREATE TABLE "Users" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "username" TEXT UNIQUE NOT NULL,
  "password_hash" TEXT NOT NULL,
  "home_district_id" UUID REFERENCES "Districts"("id") ON DELETE SET NULL,
  "home_district_set_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ DEFAULT NOW()
);

-- Offices: seats, each bound to one district.
-- Term and election data drive timelines shown on Office pages.
CREATE TABLE "Offices" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "district_id" UUID NOT NULL REFERENCES "Districts"("id") ON DELETE CASCADE,
  "title" TEXT NOT NULL,                  -- 'US House NC-07', 'NHC Commission Seat 3'
  "kind" TEXT NOT NULL,                   -- 'legislative', 'executive', 'judicial', 'board'
  "seat_label" TEXT,                      -- 'Seat 3', 'District A'; null when uncontested by seat
  "term_years" INT,
  "next_election_at" DATE,
  "is_seeded" BOOLEAN NOT NULL DEFAULT FALSE,  -- true for the high-leverage seeded tier
  "activated_at" TIMESTAMPTZ,             -- null until first user activates or seeded tier loaded
  "external_refs" JSONB,
  "created_at" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX "idx_offices_district" ON "Offices"("district_id");
CREATE INDEX "idx_offices_seeded" ON "Offices"("is_seeded") WHERE "is_seeded" = TRUE;

-- Officials: the real elected officials who hold offices.
-- Multiple rows per office over time; is_current flags the incumbent.
-- Referred to in UI by their actual title (Senator, Representative, Mayor, Judge, etc.)
-- rather than a platform-coined term.
CREATE TABLE "Officials" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "office_id" UUID NOT NULL REFERENCES "Offices"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "party" TEXT,
  "term_start" DATE,
  "term_end" DATE,
  "is_current" BOOLEAN NOT NULL DEFAULT TRUE,
  "external_refs" JSONB,                  -- {ballotpedia: "...", openstates: "...", fec: "...", official_site: "..."}
  "created_at" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX "idx_officials_office_current" ON "Officials"("office_id") WHERE "is_current" = TRUE;

-- Witnesses: elected volunteer watchers. Bound to a user account and an office.
CREATE TABLE "Witnesses" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "office_id" UUID NOT NULL REFERENCES "Offices"("id") ON DELETE CASCADE,
  "user_id" UUID NOT NULL REFERENCES "Users"("id") ON DELETE CASCADE,
  "term_start" DATE NOT NULL,
  "term_end" DATE NOT NULL,
  "is_current" BOOLEAN NOT NULL DEFAULT TRUE,
  "statement" TEXT,                       -- short bio / pitch shown on office page
  "created_at" TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE("office_id", "term_start")
);

CREATE INDEX "idx_witnesses_office_current" ON "Witnesses"("office_id") WHERE "is_current" = TRUE;
CREATE INDEX "idx_witnesses_user" ON "Witnesses"("user_id");

-- WitnessElections: one per office per term.
CREATE TABLE "WitnessElections" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "office_id" UUID NOT NULL REFERENCES "Offices"("id") ON DELETE CASCADE,
  "term_start" DATE NOT NULL,
  "term_end" DATE NOT NULL,
  "filing_opens_at" TIMESTAMPTZ NOT NULL,
  "voting_opens_at" TIMESTAMPTZ NOT NULL,
  "voting_closes_at" TIMESTAMPTZ NOT NULL,
  "quorum" INT NOT NULL DEFAULT 25,       -- minimum votes to seat a Witness
  "created_at" TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE("office_id", "term_start")
);

CREATE INDEX "idx_elections_office" ON "WitnessElections"("office_id");

-- WitnessCandidacies
CREATE TABLE "WitnessCandidacies" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "election_id" UUID NOT NULL REFERENCES "WitnessElections"("id") ON DELETE CASCADE,
  "user_id" UUID NOT NULL REFERENCES "Users"("id") ON DELETE CASCADE,
  "statement_short" TEXT NOT NULL,        -- 1-3 lines shown on election page card
  "statement_long" TEXT,                  -- fuller statement for "Read full statement" page
  "withdrawn_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE("election_id", "user_id")
);

CREATE INDEX "idx_candidacies_election" ON "WitnessCandidacies"("election_id");

-- WitnessVotes: one per voter per election; change-allowed semantics via upsert on (election_id, voter_id).
CREATE TABLE "WitnessVotes" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "election_id" UUID NOT NULL REFERENCES "WitnessElections"("id") ON DELETE CASCADE,
  "voter_id" UUID NOT NULL REFERENCES "Users"("id") ON DELETE CASCADE,
  "candidacy_id" UUID NOT NULL REFERENCES "WitnessCandidacies"("id") ON DELETE CASCADE,
  "created_at" TIMESTAMPTZ DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE("election_id", "voter_id")
);

CREATE INDEX "idx_votes_candidacy" ON "WitnessVotes"("candidacy_id");

-- OfficeFollows: a user follows an office to see its activity on their home view.
CREATE TABLE "OfficeFollows" (
  "user_id" UUID NOT NULL REFERENCES "Users"("id") ON DELETE CASCADE,
  "office_id" UUID NOT NULL REFERENCES "Offices"("id") ON DELETE CASCADE,
  "created_at" TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY ("user_id", "office_id")
);

CREATE INDEX "idx_follows_office" ON "OfficeFollows"("office_id");

-- Posts: threaded forum content, bound to an Office (the primary container).
-- parent_id enables threading. deleted_at is soft-delete.
CREATE TABLE "Posts" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "author_id" UUID REFERENCES "Users"("id") ON DELETE SET NULL,
  "parent_id" UUID REFERENCES "Posts"("id") ON DELETE CASCADE,
  "office_id" UUID REFERENCES "Offices"("id") ON DELETE SET NULL,
  "title" TEXT,                           -- only for top-level posts
  "body" TEXT NOT NULL,
  "is_witness_post" BOOLEAN NOT NULL DEFAULT FALSE,  -- authored while serving as Witness for this office
  "is_pinned" BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at" TIMESTAMPTZ DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ DEFAULT NOW(),
  "deleted_at" TIMESTAMPTZ
);

CREATE INDEX "idx_posts_office" ON "Posts"("office_id") WHERE "deleted_at" IS NULL;
CREATE INDEX "idx_posts_parent" ON "Posts"("parent_id") WHERE "deleted_at" IS NULL;
CREATE INDEX "idx_posts_author" ON "Posts"("author_id") WHERE "deleted_at" IS NULL;

-- Tags: structured, from controlled vocabularies.
-- kind: 'official' (ref_id -> Officials.id), 'district' (ref_id -> Districts.id),
--       'issue' (ref_id null, label + scope_district_id define the tag).
CREATE TABLE "Tags" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "kind" TEXT NOT NULL,
  "ref_id" UUID,
  "label" TEXT NOT NULL,
  "scope_district_id" UUID REFERENCES "Districts"("id") ON DELETE SET NULL,
  "created_at" TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE("kind", "ref_id", "label")
);

CREATE INDEX "idx_tags_kind_ref" ON "Tags"("kind", "ref_id");
CREATE INDEX "idx_tags_scope" ON "Tags"("scope_district_id");

-- PostTags: many-to-many between posts and tags.
CREATE TABLE "PostTags" (
  "post_id" UUID NOT NULL REFERENCES "Posts"("id") ON DELETE CASCADE,
  "tag_id" UUID NOT NULL REFERENCES "Tags"("id") ON DELETE CASCADE,
  PRIMARY KEY ("post_id", "tag_id")
);

CREATE INDEX "idx_posttags_tag" ON "PostTags"("tag_id");

-- ModActions: audit log for moderation. Public-readable so the archive shows its seams.
CREATE TABLE "ModActions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "actor_id" UUID REFERENCES "Users"("id") ON DELETE SET NULL,
  "target_type" TEXT NOT NULL,            -- 'post', 'user', 'tag', etc.
  "target_id" UUID NOT NULL,
  "action" TEXT NOT NULL,                 -- 'soft_delete', 'restore', 'pin', 'unpin', 'warn'
  "reason" TEXT,
  "scope_office_id" UUID REFERENCES "Offices"("id") ON DELETE SET NULL,
  "created_at" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX "idx_modactions_target" ON "ModActions"("target_type", "target_id");


-- 3. SECURITY (RLS)

ALTER TABLE "Districts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Offices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Officials" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Witnesses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WitnessElections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WitnessCandidacies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WitnessVotes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OfficeFollows" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Posts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Tags" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PostTags" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ModActions" ENABLE ROW LEVEL SECURITY;

-- Public read on everything. The archive is public; that is the mission.
CREATE POLICY "Public Read Districts"      ON "Districts"          FOR SELECT USING (true);
CREATE POLICY "Public Read Users"          ON "Users"              FOR SELECT USING (true);
CREATE POLICY "Public Read Offices"        ON "Offices"            FOR SELECT USING (true);
CREATE POLICY "Public Read Officials"      ON "Officials"          FOR SELECT USING (true);
CREATE POLICY "Public Read Witnesses"      ON "Witnesses"          FOR SELECT USING (true);
CREATE POLICY "Public Read Elections"      ON "WitnessElections"   FOR SELECT USING (true);
CREATE POLICY "Public Read Candidacies"    ON "WitnessCandidacies" FOR SELECT USING (true);
CREATE POLICY "Public Read Votes"          ON "WitnessVotes"       FOR SELECT USING (true);
CREATE POLICY "Public Read Follows"        ON "OfficeFollows"      FOR SELECT USING (true);
CREATE POLICY "Public Read Posts"          ON "Posts"              FOR SELECT USING ("deleted_at" IS NULL);
CREATE POLICY "Public Read Tags"           ON "Tags"               FOR SELECT USING (true);
CREATE POLICY "Public Read PostTags"       ON "PostTags"           FOR SELECT USING (true);
CREATE POLICY "Public Read ModActions"     ON "ModActions"         FOR SELECT USING (true);

-- Writes require authenticated actor matching the row subject.
-- Note: district-scope checks (e.g., voter must be home-district resident) are enforced in server actions, not RLS,
-- because RLS cannot traverse Districts.parent_id efficiently. Server actions validate scope before insert.

CREATE POLICY "Users Insert Self"          ON "Users"              FOR INSERT WITH CHECK (true);
CREATE POLICY "Users Update Self"          ON "Users"              FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users Author Posts"         ON "Posts"              FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Users Edit Own Posts"       ON "Posts"              FOR UPDATE USING (auth.uid() = author_id);

CREATE POLICY "Users Follow Offices"       ON "OfficeFollows"      FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users Unfollow Offices"     ON "OfficeFollows"      FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users File Candidacy"       ON "WitnessCandidacies" FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users Edit Own Candidacy"   ON "WitnessCandidacies" FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users Cast Vote"            ON "WitnessVotes"       FOR INSERT WITH CHECK (auth.uid() = voter_id);
CREATE POLICY "Users Change Vote"          ON "WitnessVotes"       FOR UPDATE USING (auth.uid() = voter_id);

CREATE POLICY "Users Tag Own Posts"        ON "PostTags"           FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM "Posts" p WHERE p.id = post_id AND p.author_id = auth.uid())
);

-- ModActions inserts are gated in server actions (check Witness status for scope_office_id, etc.)
CREATE POLICY "Mods Record Actions"        ON "ModActions"         FOR INSERT WITH CHECK (auth.uid() = actor_id);
