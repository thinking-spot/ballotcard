-- Migration 0006: Seed a Witness election for US House NC-07
-- Creates a currently-open election so the election page and ballot alerts work.

-- Election for the next Witness term (filing opened 2 weeks ago, voting open now, closes in 2 weeks)
INSERT INTO "WitnessElections" (
  id, office_id, term_start, term_end,
  filing_opens_at, voting_opens_at, voting_closes_at, quorum
) VALUES (
  '00000000-0000-4000-8000-000000000070',
  '00000000-0000-4000-8000-000000000020',
  '2026-07-01',
  '2027-06-30',
  NOW() - INTERVAL '14 days',
  NOW() - INTERVAL '3 days',
  NOW() + INTERVAL '14 days',
  3
) ON CONFLICT DO NOTHING;

-- A test candidate: @coastalwatcher re-running for Witness
INSERT INTO "WitnessCandidacies" (
  id, election_id, user_id, statement_short, statement_long
) VALUES (
  '00000000-0000-4000-8000-000000000071',
  '00000000-0000-4000-8000-000000000070',
  '00000000-0000-4000-8000-000000000010',
  'Incumbent Witness. I have filed 3 FOIA requests, tracked 47 votes, and published weekly roundups for 15 months. I am asking for another term.',
  'Since becoming Witness for NC-07, I have focused on three areas: financial disclosure compliance (the STOCK Act investigation), district office staffing and casework capacity, and defense/port infrastructure policy that directly affects our coastal communities.

If re-elected, I plan to expand coverage of committee markup sessions and continue the weekly roundup format that residents have told me is useful. I also want to establish a quarterly casework tracker so residents can see how responsive the district office is over time.

I live in Wilmington and work remotely. I can commit 5-10 hours per week to Witness duties.'
) ON CONFLICT DO NOTHING;
