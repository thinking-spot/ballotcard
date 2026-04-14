-- BallotCard V1.1 — Featured Link
-- Adds featured-source attachment to posts (one OG card per post, Bluesky-style).
-- Snapshot-at-fetch: OG metadata is stored at post creation so the card survives
-- source removal, paywalling, or URL rot.

ALTER TABLE "Posts" ADD COLUMN "featured_link_url" TEXT;
ALTER TABLE "Posts" ADD COLUMN "featured_link_title" TEXT;
ALTER TABLE "Posts" ADD COLUMN "featured_link_description" TEXT;
ALTER TABLE "Posts" ADD COLUMN "featured_link_image_url" TEXT;
ALTER TABLE "Posts" ADD COLUMN "featured_link_domain" TEXT;
ALTER TABLE "Posts" ADD COLUMN "featured_link_published_at" TIMESTAMPTZ;
ALTER TABLE "Posts" ADD COLUMN "featured_link_fetched_at" TIMESTAMPTZ;

-- Status of the OG fetch. Drives card rendering:
--   'ok'            → full card with image, title, description
--   'no_metadata'   → text-only card: "Featured source · [domain]"
--   'failed'        → bare link with no card (generic network error)
--   'timeout'       → bare link with no card (>5s)
--   'blocked'       → bare link with no card (URL rejected for safety)
-- NULL means no featured link was provided for this post.
ALTER TABLE "Posts" ADD COLUMN "featured_link_fetch_status" TEXT
  CHECK ("featured_link_fetch_status" IN ('ok', 'no_metadata', 'failed', 'timeout', 'blocked'));

-- Index for filtering/surfacing posts that cite specific domains.
-- Useful for e.g. "posts citing propublica.org" or surfacing local news coverage.
CREATE INDEX "idx_posts_featured_domain" ON "Posts"("featured_link_domain")
  WHERE "featured_link_domain" IS NOT NULL AND "deleted_at" IS NULL;


-- Notes on implementation (not SQL, kept here as design record):
--
-- 1. Self-hosted OG fetch. We do NOT use third-party services (Cardyb, Microlink, etc.)
--    for two reasons: (a) user composition patterns should not flow through another
--    company's infrastructure on a pseudonymous civic platform, (b) public courtesy
--    services can change or disappear — a hard dependency is fragile.
--
-- 2. OG fetch happens in `fetchOpenGraphAction` (server action in `src/lib/post-actions.ts`
--    or a dedicated `src/lib/og-fetch.ts`), called from `createPostAction` and
--    `editPostAction` at the moment a URL is submitted or edited.
--
-- 3. Parse <meta property="og:*"> and <meta name="twitter:*"> tags. Fall back
--    to <title> and <meta name="description"> if OG tags are absent.
--    Recommended libraries: `node-html-parser` (faster than cheerio for this),
--    `undici` (built into Node, no new dependency).
--
-- 4. Store the original URL always, even if OG parse fails. The card can
--    render as a text-only citation when image/description are missing
--    (fetch_status = 'no_metadata'), or as a bare link when the fetch itself
--    failed (fetch_status = 'failed' | 'timeout' | 'blocked').
--
-- 5. Do not cache og:image binaries. Reference the original URL in
--    featured_link_image_url. Accept that some images will rot over time;
--    the text content of the card remains.
--
-- 6. Follow up to 5 redirects. Store the final canonical URL as
--    featured_link_url. Original user-supplied URL is not stored separately
--    (canonicalizing on insert keeps the schema simple; the original is
--    reachable from post revision history if ever needed).
--
-- 7. Security hardening required on the fetcher:
--    - Accept only http:// and https:// schemes
--    - Block private IP ranges (10/8, 172.16/12, 192.168/16, 127/8, ::1, fc00::/7)
--    - Block link-local (169.254/16, fe80::/10)
--    - Use `ipaddr.js` or equivalent to check post-DNS-resolution IP
--    - Cap response size at ~2 MB (stop reading after that)
--    - 5-second connect + read timeout total
--    - User-Agent identifying BallotCard and linking to project
--
-- 8. Rate-limit OG fetches per user (10/minute, 100/day) via the sliding-window
--    limiter in src/lib/rate-limit.ts. Prevents the compose surface from being
--    used as a URL scanner or SSRF probe.
--
-- 9. If the fetch fails for any reason, the post still saves. The UX signals
--    degradation gracefully (text-only card or bare link) rather than blocking
--    the user from posting.
