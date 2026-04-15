-- PostRevisions: edit history for posts.
-- Every edit creates a revision preserving the previous state.
-- The current content lives on the Posts row; revisions are the trail.

CREATE TABLE "PostRevisions" (
  "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "post_id"    UUID NOT NULL REFERENCES "Posts"("id") ON DELETE CASCADE,
  "author_id"  UUID REFERENCES "Users"("id") ON DELETE SET NULL,
  "title"      TEXT,
  "body"       TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX "idx_post_revisions_post" ON "PostRevisions"("post_id");

-- RLS: world-readable (civic archive), insert restricted to server actions via service role.
ALTER TABLE "PostRevisions" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "PostRevisions are public"
  ON "PostRevisions" FOR SELECT
  USING (true);
