-- BallotCard: multi-member legislative districts.
-- Some state house/senate districts elect 2-3 members at-large from one
-- district (AZ, MD House of Delegates, NH, NJ Assembly, ND, SD, VT, WA, WV
-- Senate). Ingestion previously deduped on (district_id, slug) and silently
-- dropped every seat past the first, so real currently-serving legislators
-- were entirely absent from BallotCard — not an empty row, just missing.
--
-- Fix: allow multiple Office rows per (district_id, slug), distinguished by
-- seat_label ("Seat 1", "Seat 2", ...), matching how US Senate already uses
-- seat_label ("Class I"/"Class II"/"Class III") to disambiguate a state's two
-- Senate seats sharing one district.

DROP INDEX IF EXISTS "idx_offices_district_slug";

CREATE UNIQUE INDEX IF NOT EXISTS "idx_offices_district_slug_seat"
  ON "Offices"("district_id", "slug", "seat_label");
