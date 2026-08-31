-- ============================================================================
-- 0001 — NFL Survivor / Eliminator football pool: initial schema
-- ----------------------------------------------------------------------------
-- ADDITIVE and safe to run on the live database: it does not touch the legacy
-- Survivor-TV tables (leagues/castaways/episodes/rosters/pickem_*), so the
-- current site keeps working. Those legacy tables are dropped later, at the
-- Phase 3 code cutover (migration 000N_drop_legacy_survivor_tv.sql).
--
-- Game: each week a player picks NFL team(s) to win. A losing/tying/missed
-- week = one strike. Reaching the group's strike_limit = elimination.
-- Weeks 13–18 require TWO picks (both must win). Picks never repeat a team
-- within a regular season; the pool resets for the playoffs phase.
-- ============================================================================

create extension if not exists "pgcrypto";

-- profiles already exists (id -> auth.users, display_name, created_at) with a
-- signup trigger. Just add the avatar column the spec calls for.
alter table public.profiles add column if not exists avatar_url text;

-- ============================================================================
-- Reference data (written only by the service role via cron/admin routes)
-- ============================================================================
create table if not exists public.teams (
  id           uuid primary key default gen_random_uuid(),
  abbreviation text unique not null,
  name         text not null,
  logo_url     text
);

create table if not exists public.weeks (
  id             uuid primary key default gen_random_uuid(),
  season         int not null,
  week_number    int not null,
  phase          text not null default 'regular' check (phase in ('regular','playoffs')),
  pick_deadline  timestamptz not null,        -- kickoff of the week's first game
  picks_required int not null default 1,      -- 2 during the Weeks 13–18 window
  unique (season, week_number)
);

create table if not exists public.nfl_games (
  id             uuid primary key default gen_random_uuid(),
  week_id        uuid not null references public.weeks(id) on delete cascade,
  home_team_id   uuid not null references public.teams(id),
  away_team_id   uuid not null references public.teams(id),
  kickoff_time   timestamptz not null,
  status         text not null default 'scheduled'
                   check (status in ('scheduled','in_progress','final','postponed')),
  home_score     int,
  away_score     int,
  winner_team_id uuid references public.teams(id),  -- null until final; stays null on a tie
  external_id    text unique,                       -- ESPN event id, for idempotent upserts
  updated_at     timestamptz not null default now()
);
create index if not exists nfl_games_week_idx on public.nfl_games(week_id);

-- ============================================================================
-- League structure
-- ============================================================================
create table if not exists public.groups (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  commish_id   uuid not null references auth.users(id),
  strike_limit int not null default 1,
  is_public    boolean not null default false,
  invite_code  text unique not null default upper(substr(md5(gen_random_uuid()::text), 1, 8)),
  season       int not null,
  created_at   timestamptz not null default now()
);

create table if not exists public.group_members (
  id                 uuid primary key default gen_random_uuid(),
  group_id           uuid not null references public.groups(id) on delete cascade,
  user_id            uuid not null references auth.users(id),
  display_name       text,
  status             text not null default 'active' check (status in ('active','eliminated')),
  strikes_used       int not null default 0,
  eliminated_week_id uuid references public.weeks(id),
  joined_at          timestamptz not null default now(),
  unique (group_id, user_id)
);
create index if not exists group_members_user_idx  on public.group_members(user_id);
create index if not exists group_members_group_idx on public.group_members(group_id);

-- ============================================================================
-- Gameplay
-- ============================================================================
create table if not exists public.picks (
  id              uuid primary key default gen_random_uuid(),
  group_member_id uuid not null references public.group_members(id) on delete cascade,
  week_id         uuid not null references public.weeks(id),
  team_id         uuid not null references public.teams(id),
  phase           text not null default 'regular' check (phase in ('regular','playoffs')),
  result          text not null default 'pending'
                    check (result in ('pending','win','loss','tie','missed')),
  locked_at       timestamptz,
  created_at      timestamptz not null default now()
);
-- Up to picks_required rows per member per week (enforced by trigger below).
-- Prevent picking the same team twice in a single week:
create unique index if not exists picks_unique_member_week_team
  on public.picks (group_member_id, week_id, team_id);
-- No repeat team within a regular season (also blocks dup teams in pick-two weeks):
create unique index if not exists picks_no_repeat_regular
  on public.picks (group_member_id, team_id)
  where phase = 'regular';
create index if not exists picks_week_idx on public.picks(week_id);

-- ============================================================================
-- Strike ledger — idempotent, week-level
-- One row = one strike charged to a member for one week. The unique constraint
-- guarantees the scoring job can never double-charge a week, however many of
-- that member's picks failed or however many times the cron re-runs.
-- ============================================================================
create table if not exists public.member_strikes (
  id              uuid primary key default gen_random_uuid(),
  group_member_id uuid not null references public.group_members(id) on delete cascade,
  week_id         uuid not null references public.weeks(id),
  reason          text not null check (reason in ('loss','tie','missed','mixed')),
  created_at      timestamptz not null default now(),
  unique (group_member_id, week_id)
);

-- ============================================================================
-- Helper functions (security definer to avoid RLS recursion)
-- ============================================================================
create or replace function public.is_group_member(p_group uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.group_members
    where group_id = p_group and user_id = auth.uid()
  );
$$;

create or replace function public.is_group_commish(p_group uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.groups
    where id = p_group and commish_id = auth.uid()
  );
$$;

-- Join a group by invite code (runs elevated so a non-member can look up the
-- group by code and insert their own membership row despite RLS).
create or replace function public.join_group_by_code(p_code text, p_display_name text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  g public.groups;
  n text;
begin
  select * into g from public.groups where invite_code = upper(trim(p_code));
  if g.id is null then
    raise exception 'Invalid invite code';
  end if;
  n := coalesce(nullif(trim(coalesce(p_display_name, '')), ''),
                (select display_name from public.profiles where id = auth.uid()));
  insert into public.group_members (group_id, user_id, display_name)
  values (g.id, auth.uid(), n)
  on conflict (group_id, user_id) do nothing;
  return g.id;
end;
$$;

-- ============================================================================
-- Pick rules — deadline lock, pick cap, active-player check (defense in depth
-- behind the route handlers). Also auto-stamps the pick's phase from its week.
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

drop trigger if exists picks_enforce on public.picks;
create trigger picks_enforce
  before insert or update on public.picks
  for each row execute function public.enforce_pick_rules();

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.teams          enable row level security;
alter table public.weeks          enable row level security;
alter table public.nfl_games      enable row level security;
alter table public.groups         enable row level security;
alter table public.group_members  enable row level security;
alter table public.picks          enable row level security;
alter table public.member_strikes enable row level security;

-- Reference data: any authenticated user reads; only the service role writes
-- (no write policies => normal users blocked; service_role bypasses RLS).
drop policy if exists teams_read on public.teams;
create policy teams_read on public.teams for select using (auth.role() = 'authenticated');
drop policy if exists weeks_read on public.weeks;
create policy weeks_read on public.weeks for select using (auth.role() = 'authenticated');
drop policy if exists games_read on public.nfl_games;
create policy games_read on public.nfl_games for select using (auth.role() = 'authenticated');

-- groups: members (and anyone, for public groups) can read; commish writes.
drop policy if exists groups_read on public.groups;
create policy groups_read on public.groups for select
  using (is_public or public.is_group_member(id) or commish_id = auth.uid());
drop policy if exists groups_insert on public.groups;
create policy groups_insert on public.groups for insert with check (commish_id = auth.uid());
drop policy if exists groups_update on public.groups;
create policy groups_update on public.groups for update using (commish_id = auth.uid());
drop policy if exists groups_delete on public.groups;
create policy groups_delete on public.groups for delete using (commish_id = auth.uid());

-- group_members: members of a group see each other (standings). A user can
-- insert their own membership; only the commish edits rows (strikes/status/
-- removal). Strikes & elimination are written by the service role (cron).
drop policy if exists gm_read on public.group_members;
create policy gm_read on public.group_members for select using (public.is_group_member(group_id));
drop policy if exists gm_insert_self on public.group_members;
create policy gm_insert_self on public.group_members for insert
  with check (user_id = auth.uid() or public.is_group_commish(group_id));
drop policy if exists gm_update_commish on public.group_members;
create policy gm_update_commish on public.group_members for update
  using (public.is_group_commish(group_id)) with check (public.is_group_commish(group_id));
drop policy if exists gm_delete on public.group_members;
create policy gm_delete on public.group_members for delete
  using (public.is_group_commish(group_id) or user_id = auth.uid());

-- picks: read/write only your own; read others in your group only AFTER that
-- week's deadline (so rivals can't copy your pick before lock).
drop policy if exists picks_rw_own on public.picks;
create policy picks_rw_own on public.picks for all
  using (exists (select 1 from public.group_members gm
                 where gm.id = group_member_id and gm.user_id = auth.uid()))
  with check (exists (select 1 from public.group_members gm
                      where gm.id = group_member_id and gm.user_id = auth.uid()));
drop policy if exists picks_read_after_deadline on public.picks;
create policy picks_read_after_deadline on public.picks for select
  using (exists (
    select 1
    from public.group_members me
    join public.group_members them on them.group_id = me.group_id
    join public.weeks w on w.id = picks.week_id
    where them.id = picks.group_member_id
      and me.user_id = auth.uid()
      and w.pick_deadline < now()
  ));

-- member_strikes: readable by group members; written by service role only.
drop policy if exists ms_read on public.member_strikes;
create policy ms_read on public.member_strikes for select
  using (exists (select 1 from public.group_members gm
                 where gm.id = group_member_id and public.is_group_member(gm.group_id)));
