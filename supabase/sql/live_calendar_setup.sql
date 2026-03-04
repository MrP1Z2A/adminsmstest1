-- Live Calendar / Timetable setup for IEM Intelligence
-- Run this in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.live_calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  event_date date not null,
  start_time time not null,
  end_time time not null,
  class_id text not null,
  class_name text not null,
  course_id text,
  course_name text,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint live_calendar_events_time_check check (end_time > start_time)
);

create index if not exists live_calendar_events_event_date_idx
  on public.live_calendar_events (event_date);

create index if not exists live_calendar_events_class_id_idx
  on public.live_calendar_events (class_id);

create or replace function public.set_live_calendar_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_live_calendar_updated_at on public.live_calendar_events;

create trigger trg_live_calendar_updated_at
before update on public.live_calendar_events
for each row
execute function public.set_live_calendar_updated_at();

alter table public.live_calendar_events enable row level security;

-- Basic authenticated access so admins can manage timetable entries from the app.
-- Tighten these policies later if you have a dedicated admin role claim.
drop policy if exists "live_calendar_select_authenticated" on public.live_calendar_events;
create policy "live_calendar_select_authenticated"
  on public.live_calendar_events
  for select
  to authenticated
  using (true);

drop policy if exists "live_calendar_insert_authenticated" on public.live_calendar_events;
create policy "live_calendar_insert_authenticated"
  on public.live_calendar_events
  for insert
  to authenticated
  with check (true);

drop policy if exists "live_calendar_update_authenticated" on public.live_calendar_events;
create policy "live_calendar_update_authenticated"
  on public.live_calendar_events
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "live_calendar_delete_authenticated" on public.live_calendar_events;
create policy "live_calendar_delete_authenticated"
  on public.live_calendar_events
  for delete
  to authenticated
  using (true);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'live_calendar_events'
  ) then
    alter publication supabase_realtime add table public.live_calendar_events;
  end if;
end
$$;
