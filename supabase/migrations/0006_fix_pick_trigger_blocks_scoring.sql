-- ============================================================================
-- 0006 — CRITICAL FIX: enforce_pick_rules() was rejecting the scoring engine's
-- result updates after a week's deadline ("Picks are locked for this week"),
-- so picks never resolved to win/loss and loss-strikes were never charged.
--
-- The player-facing rules (deadline lock, active-player, team-must-play, pick
-- cap) should only apply when a PLAYER makes or changes a pick — i.e. an INSERT,
-- or an UPDATE that changes team_id/week_id. System updates that only change
-- result/locked_at must pass through. Replaces the function from 0004.
-- ============================================================================
create or replace function public.enforce_pick_rules()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  w   public.weeks;
  gm  public.group_members;
  cnt int;
begin
  -- Scoring/system updates that don't change the actual pick bypass the rules.
  if TG_OP = 'UPDATE' and new.team_id = old.team_id and new.week_id = old.week_id then
    return new;
  end if;

  select * into w from public.weeks where id = new.week_id;
  if w.id is null then raise exception 'Unknown week'; end if;

  if now() >= w.pick_deadline then
    raise exception 'Picks are locked for this week';
  end if;

  select * into gm from public.group_members where id = new.group_member_id;
  if gm.status <> 'active' then
    raise exception 'Eliminated players cannot submit picks';
  end if;

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
