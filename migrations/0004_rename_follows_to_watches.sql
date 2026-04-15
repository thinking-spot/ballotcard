-- Rename OfficeFollows → OfficeWatches
-- Terminology: "Watch the office; the Witness watches the official."

-- Drop existing policies
DROP POLICY IF EXISTS "Public Read Follows"   ON "OfficeFollows";
DROP POLICY IF EXISTS "Users Follow Offices"  ON "OfficeFollows";
DROP POLICY IF EXISTS "Users Unfollow Offices" ON "OfficeFollows";

-- Drop old index
DROP INDEX IF EXISTS "idx_follows_office";

-- Rename table
ALTER TABLE "OfficeFollows" RENAME TO "OfficeWatches";

-- Re-create index with correct name
CREATE INDEX "idx_watches_office" ON "OfficeWatches"("office_id");

-- Re-create RLS policies with correct names
CREATE POLICY "Public Read Watches"        ON "OfficeWatches" FOR SELECT USING (true);
CREATE POLICY "Users Watch Offices"        ON "OfficeWatches" FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users Unwatch Offices"      ON "OfficeWatches" FOR DELETE USING (auth.uid() = user_id);
