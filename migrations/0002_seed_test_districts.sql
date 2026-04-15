-- Seed: minimal district tree for Phase 1 testing
-- USA → NC → [NC-07 US House district, New Hanover County → Wilmington]
-- Run this after applying 0000 and 0001.

-- Country
INSERT INTO "Districts" (id, name, kind, geo_slug)
VALUES ('00000000-0000-0000-0000-000000000001', 'United States', 'country', 'us')
ON CONFLICT (geo_slug) DO NOTHING;

-- State: North Carolina
INSERT INTO "Districts" (id, name, kind, state, parent_id, geo_slug)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'North Carolina',
  'state',
  'NC',
  '00000000-0000-0000-0000-000000000001',
  'nc'
)
ON CONFLICT (geo_slug) DO NOTHING;

-- US House District: NC-07
INSERT INTO "Districts" (id, name, kind, state, parent_id, geo_slug)
VALUES (
  '00000000-0000-0000-0000-000000000003',
  'NC-07 (US House)',
  'us_house',
  'NC',
  '00000000-0000-0000-0000-000000000002',
  'nc/07'
)
ON CONFLICT (geo_slug) DO NOTHING;

-- County: New Hanover County
INSERT INTO "Districts" (id, name, kind, state, parent_id, geo_slug)
VALUES (
  '00000000-0000-0000-0000-000000000004',
  'New Hanover County',
  'county',
  'NC',
  '00000000-0000-0000-0000-000000000002',
  'nc/new-hanover'
)
ON CONFLICT (geo_slug) DO NOTHING;

-- Municipality: Wilmington
INSERT INTO "Districts" (id, name, kind, state, parent_id, geo_slug)
VALUES (
  '00000000-0000-0000-0000-000000000005',
  'Wilmington',
  'municipality',
  'NC',
  '00000000-0000-0000-0000-000000000004',
  'nc/new-hanover/wilmington'
)
ON CONFLICT (geo_slug) DO NOTHING;

-- Mark all as activated (they're the test baseline)
UPDATE "Districts"
SET activated_at = NOW()
WHERE geo_slug IN ('us', 'nc', 'nc/07', 'nc/new-hanover', 'nc/new-hanover/wilmington');
