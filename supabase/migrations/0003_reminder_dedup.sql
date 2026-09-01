-- ============================================================================
-- 0003 — Track the last week a member was reminded about, so the deadline
-- reminder cron emails each member at most once per week.
-- ============================================================================
alter table public.group_members
  add column if not exists reminded_week_id uuid references public.weeks(id);
