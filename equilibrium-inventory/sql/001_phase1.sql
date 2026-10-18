-- EQUILIBRIUM INVENTORY PHASE 1
-- Run once in a NEW Supabase project, SQL Editor as project owner.
create extension if not exists pgcrypto;
create schema if not exists private;

create table public.staff_profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null check (length(trim(full_name)) > 0),
 role text not null check (role in ('ADMIN','WAREHOUSE')),
 is_active boolean not null default true,
 created_at timestamptz not null default now()
);

create table public.machines (
 id uuid primary key default gen_random_uuid(),
 asset_code text not null unique,
 machine_name text not null check (length(trim(machine_name)) > 0),
 brand text,
 model text,
 serial_number text not null unique,
 category text,
 location text,
 condition text not null default 'GOOD' check (condition in ('GOOD','NEEDS_INSPECTION','DAMAGED')),
 status text not null default 'AVAILABLE' check (status in ('AVAILABLE','BORROWED','MAINTENANCE','RETIRED')),
 qr_token uuid not null unique default gen_random_uuid(),
 created_by uuid references public.staff_profiles(id),
 created_at timestamptz not null default now()
);
create unique index machines_serial_ci_idx on public.machines(lower(trim(serial_number)));

create table public.borrowers (
 id uuid primary key default gen_random_uuid(),
 borrower_name text not null,
 organization text,
 contact_number text,
 email text,
 created_at timestamptz not null default now()
);

create table public.machine_loans (
 id uuid primary key default gen_random_uuid(),
 machine_id uuid not null references public.machines(id),
 borrower_id uuid not null references public.borrowers(id),
 purpose text,
 borrowed_at timestamptz not null default now(),
 due_at timestamptz not null,
 returned_at timestamptz,
 released_by uuid not null references public.staff_profiles(id),
 received_by uuid references public.staff_profiles(id),
 condition_out text not null default 'GOOD',
 condition_in text,
 status text not null default 'ACTIVE' check (status in ('ACTIVE','RETURNED')),
 remarks text,
 check (due_at > borrowed_at),
 check ((status='ACTIVE' and returned_at is null and received_by is null) or
        (status='RETURNED' and returned_at is not null and received_by is not null))
);
create unique index one_active_loan_per_machine on public.machine_loans(machine_id) where status='ACTIVE';

create table public.machine_activity_logs (
 id bigint generated always as identity primary key,
 machine_id uuid references public.machines(id),
 loan_id uuid references public.machine_loans(id),
 staff_id uuid references public.staff_profiles(id),
 action text not null,
 details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);

create table public.machine_maintenance (
 id uuid primary key default gen_random_uuid(),
 machine_id uuid not null references public.machines(id),
 reported_by uuid references public.staff_profiles(id),
 issue_description text not null,
 started_at timestamptz not null default now(),
 completed_at timestamptz,
 resolution text
);

-- Membership checks run as the function owner, without RLS recursion.
create or replace function private.is_staff()
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.staff_profiles s
 where s.id = (select auth.uid()) and s.is_active);
$$;
create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.staff_profiles s
 where s.id = (select auth.uid()) and s.is_active and s.role='ADMIN');
$$;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
revoke all on function private.is_staff() from public, anon;
revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_staff() to authenticated;
grant execute on function private.is_admin() to authenticated;

alter table public.staff_profiles enable row level security;
alter table public.machines enable row level security;
alter table public.borrowers enable row level security;
alter table public.machine_loans enable row level security;
alter table public.machine_activity_logs enable row level security;
alter table public.machine_maintenance enable row level security;

-- Do not rely on RLS alone; also restrict table privileges.
revoke all on table public.staff_profiles, public.machines, public.borrowers,
 public.machine_loans, public.machine_activity_logs, public.machine_maintenance
 from anon, authenticated;
grant select on table public.staff_profiles, public.machines, public.borrowers,
 public.machine_loans, public.machine_activity_logs, public.machine_maintenance to authenticated;
-- Phase 1 does not permit browser-side writes. Borrow/return will use RPC in Phase 2+.

create policy staff_read_profiles on public.staff_profiles
 for select to authenticated using (
 (select private.is_admin()) or (id=(select auth.uid()) and is_active)
 );
create policy staff_read_machines on public.machines
 for select to authenticated using ((select private.is_staff()));
create policy staff_read_borrowers on public.borrowers
 for select to authenticated using ((select private.is_staff()));
create policy staff_read_loans on public.machine_loans
 for select to authenticated using ((select private.is_staff()));
create policy staff_read_logs on public.machine_activity_logs
 for select to authenticated using ((select private.is_staff()));
create policy staff_read_maintenance on public.machine_maintenance
 for select to authenticated using ((select private.is_staff()));

-- No INSERT/UPDATE/DELETE policies or grants for browser users, intentionally.
-- First Admin bootstrap: create user in Authentication > Users, then use separate 002 SQL.
