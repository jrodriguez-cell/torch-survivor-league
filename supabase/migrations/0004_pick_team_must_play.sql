-- ============================================================================
-- 0004 — Security hardening: enforce at the DB layer that a picked team is
-- actually playing in the pick's week. Without this, a user bypassing the UI
-- (direct API call with their own session) could pick a team on a bye — a pick
-- that never resolves, so they'd dodge strikes forever. The app already checks
-- this, but RLS + this trigger are the real trust boundary.
-- Replaces the enforce_pick_rules() function from migration 0001.
-- ============================================================================
create or replace function public.enforce_pick_rules()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  w   public.weeks;
  gm  public.group_members;
  cnt int;
begin
  select * into w from public.weeks where id = new.week_id;
  if w.id is null then raise exception 'Unknown week'; end if;

  if now() >= w.pick_deadline then
    raise exception 'Picks are locked for this week';
  end if;

  select * into gm from public.group_members where id = new.group_member_id;
  if gm.status <> 'active' then
    raise exception 'Eliminated players cannot submit picks';
  end if;

  -- The picked team must be in a game scheduled for this week (not on a bye).
  if not exists (
    select 1 from public.nfl_games g
    where g.week_id = new.week_id
      and (g.home_team_id = new.team_id or g.away_team_id = new.team_id)
  ) then
    raise exception 'That team is not playing this week';
  end if;

  new.phase := w.phase;

  if TG_OP = 'INSERT' then
    select count(*) into cnt from public.picks
      where group_member_id = new.group_member_id and week_id = new.week_id;
    if cnt >= w.picks_required then
      raise exception 'All % pick(s) for this week are already in', w.picks_required;
    end if;
  end if;

  return new;
end;
$$;
-- (trigger picks_enforce from 0001 already points at this function.)
