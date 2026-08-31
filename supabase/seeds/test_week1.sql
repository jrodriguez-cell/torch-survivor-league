-- ============================================================================
-- TEST SEED — a fake Week 1 (season 2026) so you can exercise the pick flow
-- before real NFL ingestion (Phase 4) exists. Safe/idempotent to re-run.
-- The deadline is 3 days out so picks are OPEN. Phase 4 replaces this with the
-- real schedule. To reset the test, you can delete week 2026/1 and its games.
-- ============================================================================

-- Requires migration 0002 (teams) to have been run first.

insert into public.weeks (season, week_number, phase, pick_deadline, picks_required)
values (2026, 1, 'regular', now() + interval '3 days', 1)
on conflict (season, week_number)
  do update set pick_deadline = excluded.pick_deadline,
                picks_required = excluded.picks_required;

insert into public.nfl_games (week_id, home_team_id, away_team_id, kickoff_time, status, external_id)
select w.id, home.id, away.id, k.kickoff, 'scheduled', k.ext
from (select id from public.weeks where season = 2026 and week_number = 1) w
cross join (values
  ('KC','BUF',  now() + interval '3 days',                        'seed-w1-1'),
  ('PHI','DAL', now() + interval '3 days' + interval '3 hours',   'seed-w1-2'),
  ('SEA','SF',  now() + interval '3 days' + interval '3 hours',   'seed-w1-3'),
  ('GB','DET',  now() + interval '3 days' + interval '6 hours',   'seed-w1-4'),
  ('CIN','BAL', now() + interval '4 days',                        'seed-w1-5'),
  ('NYJ','MIA', now() + interval '4 days' + interval '3 hours',   'seed-w1-6')
) as k(home_abbr, away_abbr, kickoff, ext)
join public.teams home on home.abbreviation = k.home_abbr
join public.teams away on away.abbreviation = k.away_abbr
on conflict (external_id) do nothing;
