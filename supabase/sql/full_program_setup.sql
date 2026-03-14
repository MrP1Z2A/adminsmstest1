-- Full Supabase setup for iacademy-intelligence
-- Run this file in Supabase SQL Editor.
-- It is written to be rerunnable (idempotent where possible).

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------

create or replace function public.set_row_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.ensure_realtime_table(table_name text)
returns void
language plpgsql
as $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = table_name
  ) then
    execute format('alter publication supabase_realtime add table public.%I', table_name);
  end if;
end
$$;

create or replace function public.apply_open_rls(table_name text, prefix text)
returns void
language plpgsql
as $$
begin
  execute format('alter table public.%I enable row level security', table_name);

  execute format('drop policy if exists %I on public.%I', prefix || '_select', table_name);
  execute format('create policy %I on public.%I for select to anon, authenticated using (true)', prefix || '_select', table_name);

  execute format('drop policy if exists %I on public.%I', prefix || '_insert', table_name);
  execute format('create policy %I on public.%I for insert to anon, authenticated with check (true)', prefix || '_insert', table_name);

  execute format('drop policy if exists %I on public.%I', prefix || '_update', table_name);
  execute format('create policy %I on public.%I for update to anon, authenticated using (true) with check (true)', prefix || '_update', table_name);

  execute format('drop policy if exists %I on public.%I', prefix || '_delete', table_name);
  execute format('create policy %I on public.%I for delete to anon, authenticated using (true)', prefix || '_delete', table_name);
end
$$;

create or replace function public.apply_storage_bucket_policies(bucket_name text, prefix text)
returns void
language plpgsql
as $$
begin
  execute format('drop policy if exists %I on storage.objects', prefix || '_select');
  execute format('create policy %I on storage.objects for select to anon, authenticated using (bucket_id = %L)', prefix || '_select', bucket_name);

  execute format('drop policy if exists %I on storage.objects', prefix || '_insert');
  execute format('create policy %I on storage.objects for insert to anon, authenticated with check (bucket_id = %L)', prefix || '_insert', bucket_name);

  execute format('drop policy if exists %I on storage.objects', prefix || '_update');
  execute format('create policy %I on storage.objects for update to anon, authenticated using (bucket_id = %L) with check (bucket_id = %L)', prefix || '_update', bucket_name, bucket_name);

  execute format('drop policy if exists %I on storage.objects', prefix || '_delete');
  execute format('create policy %I on storage.objects for delete to anon, authenticated using (bucket_id = %L)', prefix || '_delete', bucket_name);
end
$$;

-- -----------------------------------------------------------------------------
-- Auth profile table
-- -----------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  role text not null default 'student',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_email_idx on public.profiles (email);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_row_updated_at();

select public.apply_open_rls('profiles', 'profiles');
select public.ensure_realtime_table('profiles');

-- -----------------------------------------------------------------------------
-- Core academic entities
-- -----------------------------------------------------------------------------

create table if not exists public.students (
  id text primary key,
  name text not null,
  role text not null default 'student',
  gender text default 'Male',
  status text default 'Pending',
  email text,
  avatar text,
  "attendanceRate" numeric(6,2) not null default 0,
  "courseAttendance" jsonb not null default '[]'::jsonb,
  "securityStatus" jsonb not null default '{"lastLogin":"Never","twoFactorEnabled":false,"trustedDevices":0,"riskLevel":"Low"}'::jsonb,
  permissions jsonb,
  type text,
  auth_user_id uuid references auth.users(id) on delete set null,
  temp_password text,
  date_of_birth date,
  parent_name text,
  parent_number text,
  parent_email text,
  secondary_parent_name text,
  secondary_parent_number text,
  secondary_parent_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.students add column if not exists "attendanceRate" numeric(6,2) default 0;
alter table public.students add column if not exists "courseAttendance" jsonb default '[]'::jsonb;
alter table public.students add column if not exists "securityStatus" jsonb default '{"lastLogin":"Never","twoFactorEnabled":false,"trustedDevices":0,"riskLevel":"Low"}'::jsonb;
alter table public.students add column if not exists permissions jsonb;
alter table public.students add column if not exists type text;
alter table public.students add column if not exists auth_user_id uuid;
alter table public.students add column if not exists temp_password text;
alter table public.students add column if not exists date_of_birth date;
alter table public.students add column if not exists parent_name text;
alter table public.students add column if not exists parent_number text;
alter table public.students add column if not exists parent_email text;
alter table public.students add column if not exists secondary_parent_name text;
alter table public.students add column if not exists secondary_parent_number text;
alter table public.students add column if not exists secondary_parent_email text;
alter table public.students add column if not exists created_at timestamptz default now();
alter table public.students add column if not exists updated_at timestamptz default now();

update public.students
set
  "attendanceRate" = coalesce("attendanceRate", 0),
  "courseAttendance" = coalesce("courseAttendance", '[]'::jsonb),
  "securityStatus" = coalesce("securityStatus", '{"lastLogin":"Never","twoFactorEnabled":false,"trustedDevices":0,"riskLevel":"Low"}'::jsonb),
  role = coalesce(role, 'student'),
  status = coalesce(status, 'Pending')
where "attendanceRate" is null
   or "courseAttendance" is null
   or "securityStatus" is null
   or role is null
   or status is null;

create index if not exists students_created_at_idx on public.students (created_at desc);
create index if not exists students_email_idx on public.students (email);
create index if not exists students_role_idx on public.students (role);

drop trigger if exists trg_students_updated_at on public.students;
create trigger trg_students_updated_at
before update on public.students
for each row execute function public.set_row_updated_at();

select public.apply_open_rls('students', 'students');
select public.ensure_realtime_table('students');

create table if not exists public.teachers (
  id text primary key,
  name text not null,
  email text,
  role text not null default 'teacher',
  gender text default 'Male',
  status text default 'Pending',
  type text,
  avatar text,
  auth_user_id uuid references auth.users(id) on delete set null,
  temp_password text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.teachers add column if not exists role text default 'teacher';
alter table public.teachers add column if not exists gender text default 'Male';
alter table public.teachers add column if not exists status text default 'Pending';
alter table public.teachers add column if not exists type text;
alter table public.teachers add column if not exists avatar text;
alter table public.teachers add column if not exists auth_user_id uuid;
alter table public.teachers add column if not exists temp_password text;
alter table public.teachers add column if not exists created_at timestamptz default now();
alter table public.teachers add column if not exists updated_at timestamptz default now();

create index if not exists teachers_created_at_idx on public.teachers (created_at desc);
create index if not exists teachers_email_idx on public.teachers (email);

drop trigger if exists trg_teachers_updated_at on public.teachers;
create trigger trg_teachers_updated_at
before update on public.teachers
for each row execute function public.set_row_updated_at();

select public.apply_open_rls('teachers', 'teachers');
select public.ensure_realtime_table('teachers');

create table if not exists public.parents (
  id uuid primary key default gen_random_uuid(),
  student_id text,
  name text,
  email text,
  phone text,
  relation text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.parents add column if not exists student_id text;
alter table public.parents add column if not exists name text;
alter table public.parents add column if not exists email text;
alter table public.parents add column if not exists phone text;
alter table public.parents add column if not exists relation text;
alter table public.parents add column if not exists created_at timestamptz default now();
alter table public.parents add column if not exists updated_at timestamptz default now();

create index if not exists parents_student_id_idx on public.parents (student_id);
create index if not exists parents_created_at_idx on public.parents (created_at desc);

drop trigger if exists trg_parents_updated_at on public.parents;
create trigger trg_parents_updated_at
before update on public.parents
for each row execute function public.set_row_updated_at();

select public.apply_open_rls('parents', 'parents');
select public.ensure_realtime_table('parents');

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  image_url text,
  color text,
  outer_color text,
  class_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.classes add column if not exists image_url text;
alter table public.classes add column if not exists color text;
alter table public.classes add column if not exists outer_color text;
alter table public.classes add column if not exists class_code text;
alter table public.classes add column if not exists created_at timestamptz default now();
alter table public.classes add column if not exists updated_at timestamptz default now();

create index if not exists classes_created_at_idx on public.classes (created_at desc);
create index if not exists classes_class_code_idx on public.classes (class_code);

drop trigger if exists trg_classes_updated_at on public.classes;
create trigger trg_classes_updated_at
before update on public.classes
for each row execute function public.set_row_updated_at();

select public.apply_open_rls('classes', 'classes');
select public.ensure_realtime_table('classes');

create table if not exists public.class_courses (
  id uuid primary key default gen_random_uuid(),
  class_id text not null,
  name text not null,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.class_courses add column if not exists class_id text;
alter table public.class_courses add column if not exists name text;
alter table public.class_courses add column if not exists image_url text;
alter table public.class_courses add column if not exists created_at timestamptz default now();
alter table public.class_courses add column if not exists updated_at timestamptz default now();

update public.class_courses
set
  class_id = coalesce(class_id, ''),
  name = coalesce(nullif(name, ''), 'Untitled Course')
where class_id is null or name is null or name = '';

alter table public.class_courses alter column class_id set not null;
alter table public.class_courses alter column name set not null;

create index if not exists class_courses_class_id_idx on public.class_courses (class_id);
create index if not exists class_courses_created_at_idx on public.class_courses (created_at desc);

drop trigger if exists trg_class_courses_updated_at on public.class_courses;
create trigger trg_class_courses_updated_at
before update on public.class_courses
for each row execute function public.set_row_updated_at();

select public.apply_open_rls('class_courses', 'class_courses');
select public.ensure_realtime_table('class_courses');

create table if not exists public.class_course_students (
  id uuid primary key default gen_random_uuid(),
  class_id text,
  class_course_id text,
  student_id text not null,
  student_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.class_course_students add column if not exists class_id text;
alter table public.class_course_students add column if not exists class_course_id text;
alter table public.class_course_students add column if not exists student_id text;
alter table public.class_course_students add column if not exists student_name text;
alter table public.class_course_students add column if not exists created_at timestamptz default now();
alter table public.class_course_students add column if not exists updated_at timestamptz default now();

update public.class_course_students
set student_id = coalesce(student_id, '')
where student_id is null;

alter table public.class_course_students alter column student_id set not null;

create unique index if not exists class_course_students_unique_idx
  on public.class_course_students (class_id, class_course_id, student_id);

create index if not exists class_course_students_student_idx on public.class_course_students (student_id);
create index if not exists class_course_students_course_idx on public.class_course_students (class_course_id);

drop trigger if exists trg_class_course_students_updated_at on public.class_course_students;
create trigger trg_class_course_students_updated_at
before update on public.class_course_students
for each row execute function public.set_row_updated_at();

select public.apply_open_rls('class_course_students', 'class_course_students');
select public.ensure_realtime_table('class_course_students');

create table if not exists public.student_courses (
  id uuid primary key default gen_random_uuid(),
  course_id text not null,
  student_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.student_courses add column if not exists course_id text;
alter table public.student_courses add column if not exists student_id text;
alter table public.student_courses add column if not exists created_at timestamptz default now();
alter table public.student_courses add column if not exists updated_at timestamptz default now();

update public.student_courses
set
  course_id = coalesce(course_id, ''),
  student_id = coalesce(student_id, '')
where course_id is null or student_id is null;

alter table public.student_courses alter column course_id set not null;
alter table public.student_courses alter column student_id set not null;

create unique index if not exists student_courses_unique_idx on public.student_courses (course_id, student_id);
create index if not exists student_courses_student_idx on public.student_courses (student_id);

drop trigger if exists trg_student_courses_updated_at on public.student_courses;
create trigger trg_student_courses_updated_at
before update on public.student_courses
for each row execute function public.set_row_updated_at();

select public.apply_open_rls('student_courses', 'student_courses');
select public.ensure_realtime_table('student_courses');

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  context_type text not null,
  context_id text not null,
  context_name text,
  attendance_date date not null,
  student_id text not null,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendance_status_check check (status in ('P', 'A', 'L'))
);

alter table public.attendance_records add column if not exists context_type text;
alter table public.attendance_records add column if not exists context_id text;
alter table public.attendance_records add column if not exists context_name text;
alter table public.attendance_records add column if not exists attendance_date date;
alter table public.attendance_records add column if not exists student_id text;
alter table public.attendance_records add column if not exists status text;
alter table public.attendance_records add column if not exists created_at timestamptz default now();
alter table public.attendance_records add column if not exists updated_at timestamptz default now();

update public.attendance_records
set
  context_type = coalesce(context_type, 'class'),
  context_id = coalesce(context_id, ''),
  attendance_date = coalesce(attendance_date, current_date),
  student_id = coalesce(student_id, ''),
  status = case when status in ('P', 'A', 'L') then status else 'P' end
where context_type is null
   or context_id is null
   or attendance_date is null
   or student_id is null
   or status is null
   or status not in ('P', 'A', 'L');

alter table public.attendance_records alter column context_type set not null;
alter table public.attendance_records alter column context_id set not null;
alter table public.attendance_records alter column attendance_date set not null;
alter table public.attendance_records alter column student_id set not null;
alter table public.attendance_records alter column status set not null;

create unique index if not exists attendance_records_unique_idx
  on public.attendance_records (context_type, context_id, attendance_date, student_id);

create index if not exists attendance_records_context_date_idx
  on public.attendance_records (context_type, context_id, attendance_date);

create index if not exists attendance_records_student_idx
  on public.attendance_records (student_id);

drop trigger if exists trg_attendance_records_updated_at on public.attendance_records;
create trigger trg_attendance_records_updated_at
before update on public.attendance_records
for each row execute function public.set_row_updated_at();

select public.apply_open_rls('attendance_records', 'attendance_records');
select public.ensure_realtime_table('attendance_records');

-- -----------------------------------------------------------------------------
-- Homework
-- -----------------------------------------------------------------------------

create table if not exists public.homework_assignments (
  id uuid primary key default gen_random_uuid(),
  class_id text not null,
  class_course_id text not null,
  title text not null,
  description text,
  attachment_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.homework_assignments add column if not exists class_id text;
alter table public.homework_assignments add column if not exists class_course_id text;
alter table public.homework_assignments add column if not exists title text;
alter table public.homework_assignments add column if not exists description text;
alter table public.homework_assignments add column if not exists attachment_url text;
alter table public.homework_assignments add column if not exists created_at timestamptz default now();
alter table public.homework_assignments add column if not exists updated_at timestamptz default now();

update public.homework_assignments
set
  class_id = coalesce(class_id, ''),
  class_course_id = coalesce(class_course_id, ''),
  title = coalesce(nullif(title, ''), 'Homework')
where class_id is null or class_course_id is null or title is null or title = '';

alter table public.homework_assignments alter column class_id set not null;
alter table public.homework_assignments alter column class_course_id set not null;
alter table public.homework_assignments alter column title set not null;

create index if not exists homework_assignments_class_id_idx on public.homework_assignments (class_id);
create index if not exists homework_assignments_course_id_idx on public.homework_assignments (class_course_id);
create index if not exists homework_assignments_created_at_idx on public.homework_assignments (created_at desc);

drop trigger if exists trg_homework_assignments_updated_at on public.homework_assignments;
create trigger trg_homework_assignments_updated_at
before update on public.homework_assignments
for each row execute function public.set_row_updated_at();

select public.apply_open_rls('homework_assignments', 'homework_assignments');
select public.ensure_realtime_table('homework_assignments');

-- -----------------------------------------------------------------------------
-- Calendar
-- -----------------------------------------------------------------------------

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

alter table public.live_calendar_events add column if not exists course_id text;
alter table public.live_calendar_events add column if not exists course_name text;
alter table public.live_calendar_events add column if not exists notes text;

create index if not exists live_calendar_events_event_date_idx on public.live_calendar_events (event_date);
create index if not exists live_calendar_events_class_id_idx on public.live_calendar_events (class_id);

drop trigger if exists trg_live_calendar_events_updated_at on public.live_calendar_events;
create trigger trg_live_calendar_events_updated_at
before update on public.live_calendar_events
for each row execute function public.set_row_updated_at();

select public.apply_open_rls('live_calendar_events', 'live_calendar_events');
select public.ensure_realtime_table('live_calendar_events');

-- -----------------------------------------------------------------------------
-- Notice board
-- -----------------------------------------------------------------------------

create table if not exists public.notice_board (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  notice_date date not null default current_date,
  priority text not null default 'medium',
  file_path text,
  file_name text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notice_board add column if not exists title text;
alter table public.notice_board add column if not exists message text;
alter table public.notice_board add column if not exists notice_date date default current_date;
alter table public.notice_board add column if not exists priority text default 'medium';
alter table public.notice_board add column if not exists file_path text;
alter table public.notice_board add column if not exists file_name text;
alter table public.notice_board add column if not exists created_by uuid references auth.users(id);
alter table public.notice_board add column if not exists created_at timestamptz default now();
alter table public.notice_board add column if not exists updated_at timestamptz default now();

update public.notice_board
set
  title = coalesce(nullif(title, ''), 'Notice'),
  message = coalesce(nullif(message, ''), 'Announcement'),
  notice_date = coalesce(notice_date, current_date),
  priority = case
    when coalesce(priority, '') in ('low', 'medium', 'high', 'urgent') then priority
    else 'medium'
  end
where title is null
   or title = ''
   or message is null
   or message = ''
   or notice_date is null
   or priority is null
   or priority not in ('low', 'medium', 'high', 'urgent');

alter table public.notice_board alter column title set not null;
alter table public.notice_board alter column message set not null;
alter table public.notice_board alter column notice_date set not null;
alter table public.notice_board alter column priority set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'notice_board_priority_check'
  ) then
    alter table public.notice_board
      add constraint notice_board_priority_check
      check (priority in ('low', 'medium', 'high', 'urgent'));
  end if;
end
$$;

create index if not exists notice_board_notice_date_idx on public.notice_board (notice_date desc);
create index if not exists notice_board_created_at_idx on public.notice_board (created_at desc);
create index if not exists notice_board_file_path_idx on public.notice_board (file_path);
create index if not exists notice_board_priority_idx on public.notice_board (priority);

drop trigger if exists trg_notice_board_updated_at on public.notice_board;
create trigger trg_notice_board_updated_at
before update on public.notice_board
for each row execute function public.set_row_updated_at();

select public.apply_open_rls('notice_board', 'notice_board');
select public.ensure_realtime_table('notice_board');

-- -----------------------------------------------------------------------------
-- Exams + grades
-- -----------------------------------------------------------------------------

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

create index if not exists exams_class_id_idx on public.exams (class_id);
create index if not exists exams_class_course_id_idx on public.exams (class_course_id);
create index if not exists exams_created_at_idx on public.exams (created_at desc);
create index if not exists exams_title_idx on public.exams (title);

drop trigger if exists trg_exams_updated_at on public.exams;
create trigger trg_exams_updated_at
before update on public.exams
for each row execute function public.set_row_updated_at();

select public.apply_open_rls('exams', 'exams');
select public.ensure_realtime_table('exams');

create table if not exists public.exam_grades (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  student_id text not null,
  grade text not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exam_id, student_id)
);

alter table public.exam_grades add column if not exists exam_id uuid;
alter table public.exam_grades add column if not exists student_id text;
alter table public.exam_grades add column if not exists grade text;
alter table public.exam_grades add column if not exists note text;
alter table public.exam_grades add column if not exists created_at timestamptz default now();
alter table public.exam_grades add column if not exists updated_at timestamptz default now();

update public.exam_grades
set
  grade = coalesce(nullif(grade, ''), 'A'),
  student_id = coalesce(student_id, '')
where grade is null or grade = '' or student_id is null;

alter table public.exam_grades alter column exam_id set not null;
alter table public.exam_grades alter column student_id set not null;
alter table public.exam_grades alter column grade set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'exam_grades_grade_check'
  ) then
    alter table public.exam_grades
      add constraint exam_grades_grade_check
      check (grade in ('A+', 'A', 'B', 'C', 'D', 'E', 'F'));
  end if;
end
$$;

create index if not exists exam_grades_exam_id_idx on public.exam_grades (exam_id);
create index if not exists exam_grades_student_id_idx on public.exam_grades (student_id);

drop trigger if exists trg_exam_grades_updated_at on public.exam_grades;
create trigger trg_exam_grades_updated_at
before update on public.exam_grades
for each row execute function public.set_row_updated_at();

select public.apply_open_rls('exam_grades', 'exam_grades');
select public.ensure_realtime_table('exam_grades');

-- -----------------------------------------------------------------------------
-- Report cards
-- -----------------------------------------------------------------------------

create table if not exists public.report_cards (
  id uuid primary key default gen_random_uuid(),
  student_id text not null,
  class_id text,
  report_date date not null default current_date,
  report_type text not null default 'uploaded' check (report_type in ('uploaded', 'generated')),
  title text,
  content text,
  file_path text,
  file_name text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.report_cards add column if not exists report_type text default 'uploaded';
alter table public.report_cards add column if not exists class_id text;
alter table public.report_cards add column if not exists title text;
alter table public.report_cards add column if not exists content text;
alter table public.report_cards add column if not exists file_path text;
alter table public.report_cards add column if not exists file_name text;
alter table public.report_cards alter column report_type set default 'uploaded';
alter table public.report_cards alter column report_type set not null;

create index if not exists report_cards_student_id_idx on public.report_cards (student_id);
create index if not exists report_cards_class_id_idx on public.report_cards (class_id);
create index if not exists report_cards_report_date_idx on public.report_cards (report_date desc);

drop trigger if exists trg_report_cards_updated_at on public.report_cards;
create trigger trg_report_cards_updated_at
before update on public.report_cards
for each row execute function public.set_row_updated_at();

select public.apply_open_rls('report_cards', 'report_cards');
select public.ensure_realtime_table('report_cards');

-- -----------------------------------------------------------------------------
-- Payments
-- -----------------------------------------------------------------------------

create table if not exists public.student_payments (
  id uuid primary key default gen_random_uuid(),
  student_id text not null,
  amount_mmk numeric(14, 0) not null default 0,
  payment_date date not null default current_date,
  due_date date,
  status text not null default 'paid' check (status in ('paid', 'pending', 'overdue')),
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.student_payments add column if not exists student_id text;
alter table public.student_payments add column if not exists amount_mmk numeric(14, 0) default 0;
alter table public.student_payments add column if not exists payment_date date default current_date;
alter table public.student_payments add column if not exists due_date date;
alter table public.student_payments add column if not exists status text default 'paid';
alter table public.student_payments add column if not exists note text;
alter table public.student_payments add column if not exists created_by uuid references auth.users(id);
alter table public.student_payments add column if not exists created_at timestamptz default now();
alter table public.student_payments add column if not exists updated_at timestamptz default now();

update public.student_payments
set
  student_id = coalesce(student_id, ''),
  amount_mmk = coalesce(amount_mmk, 0),
  payment_date = coalesce(payment_date, current_date),
  status = case
    when coalesce(status, '') in ('paid', 'pending', 'overdue') then status
    else 'paid'
  end
where student_id is null
   or amount_mmk is null
   or payment_date is null
   or status is null
   or status not in ('paid', 'pending', 'overdue');

alter table public.student_payments alter column student_id set not null;
alter table public.student_payments alter column amount_mmk set not null;
alter table public.student_payments alter column payment_date set not null;
alter table public.student_payments alter column status set not null;

create index if not exists student_payments_student_id_idx on public.student_payments (student_id);
create index if not exists student_payments_status_idx on public.student_payments (status);
create index if not exists student_payments_payment_date_idx on public.student_payments (payment_date desc);

drop trigger if exists trg_student_payments_updated_at on public.student_payments;
create trigger trg_student_payments_updated_at
before update on public.student_payments
for each row execute function public.set_row_updated_at();

select public.apply_open_rls('student_payments', 'student_payments');
select public.ensure_realtime_table('student_payments');

-- -----------------------------------------------------------------------------
-- Admin password verification RPC used by app
-- -----------------------------------------------------------------------------

create table if not exists public.app_admin_settings (
  id boolean primary key default true,
  delete_password text not null default 'admin123',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.app_admin_settings (id, delete_password)
values (true, 'admin123')
on conflict (id) do nothing;

drop trigger if exists trg_app_admin_settings_updated_at on public.app_admin_settings;
create trigger trg_app_admin_settings_updated_at
before update on public.app_admin_settings
for each row execute function public.set_row_updated_at();

create or replace function public.verify_admin_delete_password(input_password text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  stored_password text;
begin
  select delete_password
  into stored_password
  from public.app_admin_settings
  where id = true
  limit 1;

  if stored_password is null then
    return false;
  end if;

  return stored_password = input_password;
end;
$$;

grant execute on function public.verify_admin_delete_password(text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Storage buckets used by app
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('class_image', 'class_image', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('course_profile', 'course_profile', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('student_profile', 'student_profile', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('homework_files', 'homework_files', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('report_cards', 'report_cards', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('exam_files', 'exam_files', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('notice_files', 'notice_files', true)
on conflict (id) do nothing;

select public.apply_storage_bucket_policies('class_image', 'class_image_storage');
select public.apply_storage_bucket_policies('course_profile', 'course_profile_storage');
select public.apply_storage_bucket_policies('student_profile', 'student_profile_storage');
select public.apply_storage_bucket_policies('homework_files', 'homework_files_storage');
select public.apply_storage_bucket_policies('report_cards', 'report_cards_storage');
select public.apply_storage_bucket_policies('exam_files', 'exam_files_storage');
select public.apply_storage_bucket_policies('notice_files', 'notice_files_storage');

-- -----------------------------------------------------------------------------
-- Done
-- -----------------------------------------------------------------------------
-- After running, you can update admin password with:
-- update public.app_admin_settings set delete_password = 'your-strong-password' where id = true;
