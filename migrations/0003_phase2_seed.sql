-- Migration 0003: Phase 2 seed data
-- Adds slug + description to Offices; seeds US House NC-07 office,
-- Rep. Pat Vance, @coastalwatcher Witness, sample posts, and tags.
-- Run after 0000, 0001, 0002.

-- ─── 1. Schema additions ─────────────────────────────────────────────────────

ALTER TABLE "Offices" ADD COLUMN IF NOT EXISTS "slug" TEXT;
ALTER TABLE "Offices" ADD COLUMN IF NOT EXISTS "description" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "idx_offices_district_slug"
  ON "Offices"("district_id", "slug");

-- ─── 2. US House NC-07 office ─────────────────────────────────────────────────

INSERT INTO "Offices" (
  id, district_id, title, slug, description, kind,
  term_years, next_election_at, is_seeded, activated_at
) VALUES (
  '00000000-0000-4000-8000-000000000020',
  '00000000-0000-0000-0000-000000000003',
  'US House, NC-07',
  'us-house',
  'Covers New Hanover, Brunswick, and parts of Pender, Bladen, Columbus, Robeson, and Cumberland counties',
  'legislative',
  2,
  '2026-11-03',
  TRUE,
  NOW()
) ON CONFLICT DO NOTHING;

-- ─── 3. Rep. Pat Vance (incumbent) ────────────────────────────────────────────

INSERT INTO "Officials" (
  id, office_id, name, party, term_start, term_end, is_current, external_refs
) VALUES (
  '00000000-0000-4000-8000-000000000030',
  '00000000-0000-4000-8000-000000000020',
  'Rep. Pat Vance',
  'Democratic',
  '2025-01-03',
  '2027-01-03',
  TRUE,
  '{"ballotpedia": "Pat_Vance_(North_Carolina)", "house_gov": "vance.house.gov", "fec": "H2NC07001"}'::jsonb
) ON CONFLICT DO NOTHING;

-- ─── 4. @coastalwatcher user ──────────────────────────────────────────────────
-- Password: witnesspass123

INSERT INTO "Users" (
  id, username, password_hash, home_district_id, home_district_set_at
) VALUES (
  '00000000-0000-4000-8000-000000000010',
  'coastalwatcher',
  '$2b$10$2EyT9In8I7p8yjGhMycsE.dp149TBqDAUgdKG3mlsYmhvjELuBELW',
  '00000000-0000-0000-0000-000000000005',
  NOW()
) ON CONFLICT (username) DO NOTHING;

-- ─── 5. Witness record ────────────────────────────────────────────────────────

INSERT INTO "Witnesses" (
  id, office_id, user_id, term_start, term_end, is_current, statement
) VALUES (
  '00000000-0000-4000-8000-000000000040',
  '00000000-0000-4000-8000-000000000020',
  '00000000-0000-4000-8000-000000000010',
  '2025-03-01',
  '2027-02-28',
  TRUE,
  'Watching NC-07 from Wilmington. Focus on coastal policy, veterans, and port infrastructure. Nothing I write is endorsed by Rep. Vance.'
) ON CONFLICT DO NOTHING;

-- ─── 6. Tags ──────────────────────────────────────────────────────────────────

-- Official tag for Rep. Pat Vance
INSERT INTO "Tags" (id, kind, ref_id, label) VALUES
  ('00000000-0000-4000-8000-000000000060', 'official',
   '00000000-0000-4000-8000-000000000030', 'Rep. Pat Vance')
ON CONFLICT DO NOTHING;

-- Issue tags scoped to NC-07 district
INSERT INTO "Tags" (id, kind, label, scope_district_id) VALUES
  ('00000000-0000-4000-8000-000000000061', 'issue', 'financial disclosure',
   '00000000-0000-0000-0000-000000000003'),
  ('00000000-0000-4000-8000-000000000062', 'issue', 'STOCK Act',
   '00000000-0000-0000-0000-000000000003'),
  ('00000000-0000-4000-8000-000000000063', 'issue', 'coastal resilience',
   '00000000-0000-0000-0000-000000000003'),
  ('00000000-0000-4000-8000-000000000064', 'issue', 'defense contracting',
   '00000000-0000-0000-0000-000000000003')
ON CONFLICT DO NOTHING;

-- ─── 7. Posts ─────────────────────────────────────────────────────────────────

-- Post 1: Pinned weekly roundup (no featured link)
INSERT INTO "Posts" (
  id, author_id, office_id, title, body,
  is_witness_post, is_pinned, created_at, updated_at
) VALUES (
  '00000000-0000-4000-8000-000000000050',
  '00000000-0000-4000-8000-000000000010',
  '00000000-0000-4000-8000-000000000020',
  'Weekly roundup: votes, committee appearances, casework',
  'Vance voted yea on HR 2847 (defense approps), nay on SB 1102 (EPA rollback). Two committee appearances this week — Transportation & Infrastructure, Veterans Affairs. District office casework queue up 14% month-over-month, mostly VA benefits backlog.',
  TRUE, TRUE,
  NOW() - INTERVAL '6 days',
  NOW() - INTERVAL '6 days'
) ON CONFLICT DO NOTHING;

-- Post 2: Defense contractor investigation with featured link (ProPublica)
INSERT INTO "Posts" (
  id, author_id, office_id, title, body,
  featured_link_url, featured_link_title, featured_link_description,
  featured_link_domain, featured_link_fetch_status, featured_link_fetched_at,
  is_witness_post, is_pinned, created_at, updated_at
) VALUES (
  '00000000-0000-4000-8000-000000000051',
  '00000000-0000-4000-8000-000000000010',
  '00000000-0000-4000-8000-000000000020',
  'Vance among 12 House members named in defense contractor disclosure investigation',
  E'ProPublica published a major investigation today identifying 12 House members whose financial disclosures may have omitted defense contractor stock transactions. Vance is among the 12 named.\n\nThe specific allegations against Vance:\n- Three transactions in Lockheed Martin stock (Mar, Aug, Nov 2025) reportedly not disclosed within the 45-day window required by the STOCK Act\n- Two transactions in RTX Corp (Jun 2025, Feb 2026) similarly delayed\n\nVance sits on the House Armed Services Committee, which makes the timing of the transactions newsworthy regardless of intent. Other NC delegation members were not named in the investigation.\n\nI have emailed Vance''s communications office for response and will update with any reply. The full ProPublica article is linked above; their methodology section is at the bottom of the piece.',
  'https://www.propublica.org/article/house-defense-contractor-stock-disclosure',
  '12 House members under scrutiny over undisclosed defense contractor stock holdings',
  'A months-long ProPublica review of financial disclosures finds 12 sitting House members, including members of the Armed Services and Appropriations committees, may have failed to report stock transactions involving defense contractors during the 2025–2026 reporting period.',
  'propublica.org',
  'ok',
  NOW() - INTERVAL '2 days',
  TRUE, FALSE,
  NOW() - INTERVAL '2 days',
  NOW() - INTERVAL '2 days'
) ON CONFLICT DO NOTHING;

-- Post 3: FOIA result
INSERT INTO "Posts" (
  id, author_id, office_id, title, body,
  is_witness_post, is_pinned, created_at, updated_at
) VALUES (
  '00000000-0000-4000-8000-000000000052',
  '00000000-0000-4000-8000-000000000010',
  '00000000-0000-4000-8000-000000000020',
  'FOIA result: district office staffing 2023–2026',
  E'Got the response back. Staffing dropped from 11 to 7 after the 2024 cycle, casework response times tracked in the attached spreadsheet. The drop coincides with the hiring freeze Vance''s office announced in January 2025.',
  TRUE, FALSE,
  NOW() - INTERVAL '8 days',
  NOW() - INTERVAL '8 days'
) ON CONFLICT DO NOTHING;

-- ─── 8. Post tags ─────────────────────────────────────────────────────────────

INSERT INTO "PostTags" (post_id, tag_id) VALUES
  -- Post 1 (weekly roundup)
  ('00000000-0000-4000-8000-000000000050', '00000000-0000-4000-8000-000000000060'),
  -- Post 2 (defense contractor)
  ('00000000-0000-4000-8000-000000000051', '00000000-0000-4000-8000-000000000060'),
  ('00000000-0000-4000-8000-000000000051', '00000000-0000-4000-8000-000000000061'),
  ('00000000-0000-4000-8000-000000000051', '00000000-0000-4000-8000-000000000062'),
  ('00000000-0000-4000-8000-000000000051', '00000000-0000-4000-8000-000000000064'),
  -- Post 3 (FOIA)
  ('00000000-0000-4000-8000-000000000052', '00000000-0000-4000-8000-000000000060'),
  ('00000000-0000-4000-8000-000000000052', '00000000-0000-4000-8000-000000000061')
ON CONFLICT DO NOTHING;
