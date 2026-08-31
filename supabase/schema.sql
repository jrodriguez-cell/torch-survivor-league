-- ============================================================================
-- Fantasy Survivor League — database schema
-- ----------------------------------------------------------------------------
-- Run this in the Supabase SQL editor (Dashboard -> SQL -> New query) once,
-- against a fresh project. It is idempotent-ish: safe to read top-to-bottom.
--
-- Concepts
--   league        A group of friends playing one season of Survivor.
--   member        A person in a league (one is the commissioner/admin).
--   castaway      A contestant on the show, scoped to a league's season.
--   episode       One week. Has a lock time for pick'em and a "scored" flag.
--   roster        A member's fantasy team of castaways within a league.
--   scoring_event A thing a castaway did in an episode, worth fantasy points.
--   pickem        Weekly prediction questions + each member's answers.
-- ============================================================================

-- Extensions ----------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ============================================================================
-- profiles: 1:1 with auth.users, holds a friendly display name
-- ============================================================================
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'New Player',
  created_at  timestamptz not null default now()
);

-- Auto-create a profile row whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- leagues
-- ============================================================================
create table if not exists public.leagues (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  season_name     text not null default 'Season',
  commissioner_id uuid not null references public.profiles(id) on delete restrict,
  -- short human-shareable code friends use to join
  invite_code     text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 6)),
  roster_size     int  not null default 4,   -- how many castaways each member drafts
  created_at      timestamptz not null default now()
);

-- ============================================================================
-- league_members
-- ============================================================================
create table if not exists public.league_members (
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  role      text not null default 'member' check (role in ('member', 'commissioner')),
  joined_at timestamptz not null default now(),
  primary key (league_id, user_id)
);
create index if not exists league_members_user_idx on public.league_members(user_id);

-- Helper: is the current user a member of a league?
create or replace function public.is_league_member(p_league uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.league_members
    where league_id = p_league and user_id = auth.uid()
  );
$$;

-- Helper: is the current user the commissioner of a league?
create or replace function public.is_commissioner(p_league uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.leagues
    where id = p_league and commissioner_id = auth.uid()
  );
$$;

-- ============================================================================
-- castaways (contestants for a league's season)
-- ============================================================================
create table if not exists public.castaways (
  id             uuid primary key default gen_random_uuid(),
  league_id      uuid not null references public.leagues(id) on delete cascade,
  name           text not null,
  tribe          text,
  image_url      text,
  is_eliminated  boolean not null default false,
  eliminated_week int,
  created_at     timestamptz not null default now()
);
create index if not exists castaways_league_idx on public.castaways(league_id);

-- ============================================================================
-- episodes (one per week)
-- ============================================================================
create table if not exists public.episodes (
  id            uuid primary key default gen_random_uuid(),
  league_id     uuid not null references public.leagues(id) on delete cascade,
  week_number   int not null,
  title         text,
  air_date      date,
  -- pick'em picks are locked once this passes (typically when the episode airs)
  picks_lock_at timestamptz,
  is_scored     boolean not null default false,
  created_at    timestamptz not null default now(),
  unique (league_id, week_number)
);
create index if not exists episodes_league_idx on public.episodes(league_id);

-- ============================================================================
-- rosters: a member's fantasy team in a league (one per member per league)
-- ============================================================================
create table if not exists public.rosters (
  id         uuid primary key default gen_random_uuid(),
  league_id  uuid not null references public.leagues(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (league_id, user_id)
);

create table if not exists public.roster_castaways (
  roster_id   uuid not null references public.rosters(id) on delete cascade,
  castaway_id uuid not null references public.castaways(id) on delete cascade,
  primary key (roster_id, castaway_id)
);

-- ============================================================================
-- scoring_events: fantasy points a castaway earned in an episode
-- event_type examples: survived, immunity_win, reward_win, found_idol,
--   made_merge, voted_out, quit  (fully customizable — points are stored here)
-- ============================================================================
create table if not exists public.scoring_events (
  id          uuid primary key default gen_random_uuid(),
  league_id   uuid not null references public.leagues(id) on delete cascade,
  episode_id  uuid not null references public.episodes(id) on delete cascade,
  castaway_id uuid not null references public.castaways(id) on delete cascade,
  event_type  text not null,
  points      numeric not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists scoring_events_league_idx on public.scoring_events(league_id);
create index if not exists scoring_events_episode_idx on public.scoring_events(episode_id);

-- ============================================================================
-- pick'em: weekly prediction questions and each member's answers
-- question_type:
--   'castaway'  -> answer is a castaway (correct_castaway_id holds the answer)
--   'text'      -> answer is free text / boolean (correct_text holds the answer)
-- ============================================================================
create table if not exists public.pickem_questions (
  id                  uuid primary key default gen_random_uuid(),
  episode_id          uuid not null references public.episodes(id) on delete cascade,
  league_id           uuid not null references public.leagues(id) on delete cascade,
  prompt              text not null,
  question_type       text not null default 'castaway' check (question_type in ('castaway','text')),
  points              numeric not null default 1,
  correct_castaway_id uuid references public.castaways(id) on delete set null,
  correct_text        text,
  sort_order          int not null default 0,
  created_at          timestamptz not null default now()
);
create index if not exists pickem_questions_episode_idx on public.pickem_questions(episode_id);

create table if not exists public.pickem_answers (
  id                  uuid primary key default gen_random_uuid(),
  question_id         uuid not null references public.pickem_questions(id) on delete cascade,
  user_id             uuid not null references public.profiles(id) on delete cascade,
  answer_castaway_id  uuid references public.castaways(id) on delete set null,
  answer_text         text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (question_id, user_id)
);
create index if not exists pickem_answers_user_idx on public.pickem_answers(user_id);

-- ============================================================================
-- Convenience views for leaderboards
-- ============================================================================

-- Fantasy standings: sum of points from each member's rostered castaways.
create or replace view public.fantasy_standings as
select
  r.league_id,
  r.user_id,
  p.display_name,
  coalesce(sum(se.points), 0) as total_points
from public.rosters r
join public.profiles p on p.id = r.user_id
left join public.roster_castaways rc on rc.roster_id = r.id
left join public.scoring_events se on se.castaway_id = rc.castaway_id
  and se.league_id = r.league_id
group by r.league_id, r.user_id, p.display_name;

-- Pick'em standings: points for answers that matched the correct answer,
-- only counting episodes the commissioner has marked scored.
create or replace view public.pickem_standings as
select
  q.league_id,
  a.user_id,
  p.display_name,
  coalesce(sum(
    case
      when q.question_type = 'castaway'
           and a.answer_castaway_id is not null
           and a.answer_castaway_id = q.correct_castaway_id then q.points
      when q.question_type = 'text'
           and a.answer_text is not null
           and lower(trim(a.answer_text)) = lower(trim(coalesce(q.correct_text,''))) then q.points
      else 0
    end
  ), 0) as total_points
from public.pickem_answers a
join public.pickem_questions q on q.id = a.question_id
join public.episodes e on e.id = q.episode_id and e.is_scored = true
join public.profiles p on p.id = a.user_id
group by q.league_id, a.user_id, p.display_name;

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.profiles          enable row level security;
alter table public.leagues           enable row level security;
alter table public.league_members    enable row level security;
alter table public.castaways         enable row level security;
alter table public.episodes          enable row level security;
alter table public.rosters           enable row level security;
alter table public.roster_castaways  enable row level security;
alter table public.scoring_events    enable row level security;
alter table public.pickem_questions  enable row level security;
alter table public.pickem_answers    enable row level security;

-- profiles: everyone signed in can read display names; you edit only your own.
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles
  for select using (auth.role() = 'authenticated');
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update using (id = auth.uid());
drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles
  for insert with check (id = auth.uid());

-- leagues: members can read; anyone authenticated can create (they become commish);
-- only the commissioner can update/delete.
drop policy if exists leagues_read on public.leagues;
create policy leagues_read on public.leagues
  for select using (public.is_league_member(id) or commissioner_id = auth.uid());
drop policy if exists leagues_insert on public.leagues;
create policy leagues_insert on public.leagues
  for insert with check (commissioner_id = auth.uid());
drop policy if exists leagues_update on public.leagues;
create policy leagues_update on public.leagues
  for update using (commissioner_id = auth.uid());
drop policy if exists leagues_delete on public.leagues;
create policy leagues_delete on public.leagues
  for delete using (commissioner_id = auth.uid());

-- league_members: members can see the roster of members; you can add yourself
-- (join), and remove yourself. Commissioner can manage anyone.
drop policy if exists members_read on public.league_members;
create policy members_read on public.league_members
  for select using (public.is_league_member(league_id));
drop policy if exists members_join_self on public.league_members;
create policy members_join_self on public.league_members
  for insert with check (user_id = auth.uid() or public.is_commissioner(league_id));
drop policy if exists members_leave_self on public.league_members;
create policy members_leave_self on public.league_members
  for delete using (user_id = auth.uid() or public.is_commissioner(league_id));

-- castaways / episodes / scoring_events / pickem_questions:
--   readable by members, writable only by the commissioner.
drop policy if exists castaways_read on public.castaways;
create policy castaways_read on public.castaways
  for select using (public.is_league_member(league_id));
drop policy if exists castaways_write on public.castaways;
create policy castaways_write on public.castaways
  for all using (public.is_commissioner(league_id)) with check (public.is_commissioner(league_id));

drop policy if exists episodes_read on public.episodes;
create policy episodes_read on public.episodes
  for select using (public.is_league_member(league_id));
drop policy if exists episodes_write on public.episodes;
create policy episodes_write on public.episodes
  for all using (public.is_commissioner(league_id)) with check (public.is_commissioner(league_id));

drop policy if exists scoring_read on public.scoring_events;
create policy scoring_read on public.scoring_events
  for select using (public.is_league_member(league_id));
drop policy if exists scoring_write on public.scoring_events;
create policy scoring_write on public.scoring_events
  for all using (public.is_commissioner(league_id)) with check (public.is_commissioner(league_id));

drop policy if exists pq_read on public.pickem_questions;
create policy pq_read on public.pickem_questions
  for select using (public.is_league_member(league_id));
drop policy if exists pq_write on public.pickem_questions;
create policy pq_write on public.pickem_questions
  for all using (public.is_commissioner(league_id)) with check (public.is_commissioner(league_id));

-- rosters: a member manages only their own roster within a league they belong to.
drop policy if exists rosters_read on public.rosters;
create policy rosters_read on public.rosters
  for select using (public.is_league_member(league_id));
drop policy if exists rosters_write_self on public.rosters;
create policy rosters_write_self on public.rosters
  for all using (user_id = auth.uid() and public.is_league_member(league_id))
  with check (user_id = auth.uid() and public.is_league_member(league_id));

-- roster_castaways: manage rows only for a roster you own.
drop policy if exists rc_read on public.roster_castaways;
create policy rc_read on public.roster_castaways
  for select using (
    exists (select 1 from public.rosters r
            where r.id = roster_id and public.is_league_member(r.league_id))
  );
drop policy if exists rc_write_self on public.roster_castaways;
create policy rc_write_self on public.roster_castaways
  for all using (
    exists (select 1 from public.rosters r where r.id = roster_id and r.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.rosters r where r.id = roster_id and r.user_id = auth.uid())
  );

-- pickem_answers: read all answers in your league (fun to compare after lock);
-- write only your own answers.
drop policy if exists pa_read on public.pickem_answers;
create policy pa_read on public.pickem_answers
  for select using (
    exists (select 1 from public.pickem_questions q
            where q.id = question_id and public.is_league_member(q.league_id))
  );
drop policy if exists pa_write_self on public.pickem_answers;
create policy pa_write_self on public.pickem_answers
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Note: the fantasy_standings / pickem_standings views run with the querying
-- user's privileges, so they only expose rows the user could already read.
