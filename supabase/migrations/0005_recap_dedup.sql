-- ============================================================================
-- 0005 — Track the last week a group was auto-recapped, so the weekly recap
-- cron sends each completed week's recap exactly once per pool.
-- ============================================================================
alter table public.groups
  add column if not exists last_recap_week_id uuid references public.weeks(id);
