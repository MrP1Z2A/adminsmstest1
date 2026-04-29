-- Persist sidebar access configuration for student service staff.
alter table public.student_services
add column if not exists permissions jsonb default '[]'::jsonb;

update public.student_services
set permissions = '[]'::jsonb
where permissions is null;
