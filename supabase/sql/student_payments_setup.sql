-- Student payments setup for IEM Intelligence
-- Run this in Supabase SQL Editor.

create extension if not exists pgcrypto;

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
alter table public.student_payments alter column created_at set default now();
alter table public.student_payments alter column created_at set not null;
alter table public.student_payments alter column updated_at set default now();
alter table public.student_payments alter column updated_at set not null;

create index if not exists student_payments_student_id_idx
  on public.student_payments (student_id);

create index if not exists student_payments_status_idx
  on public.student_payments (status);

create index if not exists student_payments_payment_date_idx
  on public.student_payments (payment_date desc);

create index if not exists student_payments_due_date_idx
  on public.student_payments (due_date);

create or replace function public.set_student_payments_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_student_payments_updated_at on public.student_payments;

create trigger trg_student_payments_updated_at
before update on public.student_payments
for each row
execute function public.set_student_payments_updated_at();

alter table public.student_payments enable row level security;

drop policy if exists "student_payments_select_authenticated" on public.student_payments;
create policy "student_payments_select_authenticated"
  on public.student_payments
  for select
  to anon, authenticated
  using (true);

drop policy if exists "student_payments_insert_authenticated" on public.student_payments;
create policy "student_payments_insert_authenticated"
  on public.student_payments
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "student_payments_update_authenticated" on public.student_payments;
create policy "student_payments_update_authenticated"
  on public.student_payments
  for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "student_payments_delete_authenticated" on public.student_payments;
create policy "student_payments_delete_authenticated"
  on public.student_payments
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
      and tablename = 'student_payments'
  ) then
    alter publication supabase_realtime add table public.student_payments;
  end if;
end
$$;
