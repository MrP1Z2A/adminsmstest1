-- Exams setup for IEM Intelligence
-- Run this in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  class_id text not null,
  class_course_id text not null,
  title text not null,
  description text,
  file_url text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.exams add column if not exists class_id text;
alter table public.exams add column if not exists class_course_id text;
alter table public.exams add column if not exists title text;
alter table public.exams add column if not exists description text;
alter table public.exams add column if not exists file_url text;
alter table public.exams add column if not exists created_by uuid references auth.users(id);
alter table public.exams add column if not exists created_at timestamptz default now();
alter table public.exams add column if not exists updated_at timestamptz default now();

update public.exams
set
  class_id = coalesce(class_id, ''),
  class_course_id = coalesce(class_course_id, ''),
  title = coalesce(nullif(title, ''), 'Untitled Exam')
where class_id is null
   or class_course_id is null
   or title is null
   or title = '';

alter table public.exams alter column class_id set not null;
alter table public.exams alter column class_course_id set not null;
alter table public.exams alter column title set not null;
alter table public.exams alter column created_at set default now();
alter table public.exams alter column created_at set not null;
alter table public.exams alter column updated_at set default now();
alter table public.exams alter column updated_at set not null;

create index if not exists exams_class_id_idx
  on public.exams (class_id);

create index if not exists exams_class_course_id_idx
  on public.exams (class_course_id);

create index if not exists exams_created_at_idx
  on public.exams (created_at desc);

create index if not exists exams_title_idx
  on public.exams (title);

create or replace function public.set_exams_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_exams_updated_at on public.exams;

create trigger trg_exams_updated_at
before update on public.exams
for each row
execute function public.set_exams_updated_at();

alter table public.exams enable row level security;

drop policy if exists "exams_select_authenticated" on public.exams;
create policy "exams_select_authenticated"
  on public.exams
  for select
  to anon, authenticated
  using (true);

drop policy if exists "exams_insert_authenticated" on public.exams;
create policy "exams_insert_authenticated"
  on public.exams
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "exams_update_authenticated" on public.exams;
create policy "exams_update_authenticated"
  on public.exams
  for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "exams_delete_authenticated" on public.exams;
create policy "exams_delete_authenticated"
  on public.exams
  for delete
  to anon, authenticated
  using (true);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'exams'
  ) then
    alter publication supabase_realtime add table public.exams;
  end if;
end
$$;

insert into storage.buckets (id, name, public)
values ('exam_files', 'exam_files', true)
on conflict (id) do nothing;

drop policy if exists "exam_files_storage_select" on storage.objects;
create policy "exam_files_storage_select"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'exam_files');

drop policy if exists "exam_files_storage_insert" on storage.objects;
create policy "exam_files_storage_insert"
  on storage.objects
  for insert
  to anon, authenticated
  with check (bucket_id = 'exam_files');

drop policy if exists "exam_files_storage_update" on storage.objects;
create policy "exam_files_storage_update"
  on storage.objects
  for update
  to anon, authenticated
  using (bucket_id = 'exam_files')
  with check (bucket_id = 'exam_files');

drop policy if exists "exam_files_storage_delete" on storage.objects;
create policy "exam_files_storage_delete"
  on storage.objects
  for delete
  to anon, authenticated
  using (bucket_id = 'exam_files');
