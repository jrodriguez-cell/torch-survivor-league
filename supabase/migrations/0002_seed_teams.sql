-- ============================================================================
-- 0002 — NFL teams (canonical reference data)
-- Abbreviations match ESPN's scoreboard feed so Phase 4 ingestion can map
-- games to teams directly. Re-runnable: on conflict does nothing.
-- ============================================================================
insert into public.teams (abbreviation, name) values
  ('ARI','Arizona Cardinals'),
  ('ATL','Atlanta Falcons'),
  ('BAL','Baltimore Ravens'),
  ('BUF','Buffalo Bills'),
  ('CAR','Carolina Panthers'),
  ('CHI','Chicago Bears'),
  ('CIN','Cincinnati Bengals'),
  ('CLE','Cleveland Browns'),
  ('DAL','Dallas Cowboys'),
  ('DEN','Denver Broncos'),
  ('DET','Detroit Lions'),
  ('GB','Green Bay Packers'),
  ('HOU','Houston Texans'),
  ('IND','Indianapolis Colts'),
  ('JAX','Jacksonville Jaguars'),
  ('KC','Kansas City Chiefs'),
  ('LV','Las Vegas Raiders'),
  ('LAC','Los Angeles Chargers'),
  ('LAR','Los Angeles Rams'),
  ('MIA','Miami Dolphins'),
  ('MIN','Minnesota Vikings'),
  ('NE','New England Patriots'),
  ('NO','New Orleans Saints'),
  ('NYG','New York Giants'),
  ('NYJ','New York Jets'),
  ('PHI','Philadelphia Eagles'),
  ('PIT','Pittsburgh Steelers'),
  ('SF','San Francisco 49ers'),
  ('SEA','Seattle Seahawks'),
  ('TB','Tampa Bay Buccaneers'),
  ('TEN','Tennessee Titans'),
  ('WSH','Washington Commanders')
on conflict (abbreviation) do nothing;
