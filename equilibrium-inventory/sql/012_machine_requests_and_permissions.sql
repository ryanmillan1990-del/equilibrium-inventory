-- EQUILIBRIUM INTERTRADE — PHASE 12: REQUEST / APPROVAL WORKFLOW
-- Apply AFTER 001, 010, 011 and after the existing borrow_machine,
-- return_machine, register_machine and get_loan_history RPCs are installed.
-- Run as Supabase project owner in SQL Editor. Preserve existing loans.
-- IMPORTANT: This deliberately revokes direct authenticated execution of
-- legacy inventory-changing RPCs. Deploy the matching frontend at the same time.

begin;

create table if not exists public.machine_action_requests (
  id uuid primary key default gen_random_uuid(),
  machine_id uuid not null references public.machines(id),
  requested_by uuid not null references public.staff_profiles(id),
  action text not null check (action in ('BORROW','RETURN')),
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED')),
  borrower_name text,
  organization text,
  contact_number text,
  purpose text,
  due_at timestamptz,
  condition_in text check (condition_in is null or condition_in in ('GOOD','NEEDS_INSPECTION','DAMAGED')),
  remarks text,
  reviewed_by uuid references public.staff_profiles(id),
  reviewed_at timestamptz,
  loan_id uuid references public.machine_loans(id),
  created_at timestamptz not null default now(),
  constraint action_request_valid_fields check (
    (action='BORROW' and borrower_name is not null and due_at is not null and condition_in is null)
    or (action='RETURN' and borrower_name is null and due_at is null and condition_in is not null)
  ),
  constraint action_request_review_consistency check (
    (status='PENDING' and reviewed_at is null and reviewed_by is null)
    or (status<>'PENDING' and reviewed_at is not null and reviewed_by is not null)
  )
);

-- One pending request per machine prevents overlapping borrow / return decisions.
create unique index if not exists one_pending_machine_request
  on public.machine_action_requests(machine_id) where status='PENDING';
create index if not exists machine_requests_requested_idx
  on public.machine_action_requests(requested_by, created_at desc);

alter table public.machine_action_requests enable row level security;
revoke all on table public.machine_action_requests from anon, authenticated;
grant select on table public.machine_action_requests to authenticated;
drop policy if exists read_machine_action_requests on public.machine_action_requests;
create policy read_machine_action_requests on public.machine_action_requests
  for select to authenticated using (
    exists (select 1 from public.staff_profiles s
      where s.id=auth.uid() and s.is_active and s.approval_status='APPROVED'
      and (s.role='ADMIN' or (s.role in ('TECHNICAL','WAREHOUSE') and requested_by=auth.uid())))
  );

-- Technical accounts can see machines/QR codes, but not the global loan directory,
-- borrower directory, historical logs or maintenance records.
drop policy if exists staff_read_borrowers on public.borrowers;
create policy staff_read_borrowers on public.borrowers for select to authenticated
  using (exists (select 1 from public.staff_profiles s
    where s.id=auth.uid() and s.is_active and s.approval_status='APPROVED' and s.role='ADMIN'));
drop policy if exists staff_read_loans on public.machine_loans;
create policy staff_read_loans on public.machine_loans for select to authenticated
  using (exists (select 1 from public.staff_profiles s
    where s.id=auth.uid() and s.is_active and s.approval_status='APPROVED' and s.role='ADMIN'));
drop policy if exists staff_read_logs on public.machine_activity_logs;
create policy staff_read_logs on public.machine_activity_logs for select to authenticated
  using (exists (select 1 from public.staff_profiles s
    where s.id=auth.uid() and s.is_active and s.approval_status='APPROVED' and s.role='ADMIN'));
drop policy if exists staff_read_maintenance on public.machine_maintenance;
create policy staff_read_maintenance on public.machine_maintenance for select to authenticated
  using (exists (select 1 from public.staff_profiles s
    where s.id=auth.uid() and s.is_active and s.approval_status='APPROVED' and s.role='ADMIN'));

-- Accessories and client delivery records are Admin-only (not just hidden in UI).
drop policy if exists staff_read_accessories on public.inventory_accessories;
create policy staff_read_accessories on public.inventory_accessories for select to authenticated
  using (exists (select 1 from public.staff_profiles s
    where s.id=auth.uid() and s.is_active and s.approval_status='APPROVED' and s.role='ADMIN'));
drop policy if exists staff_read_deliveries on public.client_deliveries;
create policy staff_read_deliveries on public.client_deliveries for select to authenticated
  using (exists (select 1 from public.staff_profiles s
    where s.id=auth.uid() and s.is_active and s.approval_status='APPROVED' and s.role='ADMIN'));

-- QR returns need a *single active loan*, not the unrestricted loan directory.
create or replace function public.get_machine_active_loan(p_machine_id uuid)
returns table(id uuid, borrowed_at timestamptz, due_at timestamptz,
              borrower_name text, organization text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.staff_profiles s
    where s.id=auth.uid() and s.is_active and s.approval_status='APPROVED'
    and s.role in ('ADMIN','TECHNICAL','WAREHOUSE')) then
    raise exception 'Approved staff account required';
  end if;
  return query
    select l.id,l.borrowed_at,l.due_at,b.borrower_name,b.organization
    from public.machine_loans l join public.borrowers b on b.id=l.borrower_id
    where l.machine_id=p_machine_id and l.status='ACTIVE' limit 1;
end; $$;
revoke all on function public.get_machine_active_loan(uuid) from public,anon;
grant execute on function public.get_machine_active_loan(uuid) to authenticated;

-- Only TECHNICAL/WAREHOUSE can submit; nobody changes machine state here.
create or replace function public.submit_machine_action_request(
  p_machine_id uuid, p_action text,
  p_borrower_name text default null, p_organization text default null,
  p_contact_number text default null, p_purpose text default null,
  p_due_at timestamptz default null, p_condition_in text default null,
  p_remarks text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_machine public.machines%rowtype; v_id uuid;
begin
  if not exists (select 1 from public.staff_profiles s
    where s.id=auth.uid() and s.is_active and s.approval_status='APPROVED'
    and s.role in ('TECHNICAL','WAREHOUSE')) then
    raise exception 'Only approved Technical or Warehouse staff may submit requests';
  end if;
  select * into v_machine from public.machines where id=p_machine_id for update;
  if not found then raise exception 'Machine not found'; end if;
  if p_action='BORROW' then
    if v_machine.status<>'AVAILABLE' or v_machine.condition<>'GOOD' then
      raise exception 'Machine is unavailable for borrowing'; end if;
    if length(btrim(coalesce(p_borrower_name,''))) not between 2 and 150
       or p_due_at is null or p_due_at <= now() then
      raise exception 'Borrower name and a future due date are required'; end if;
  elsif p_action='RETURN' then
    if v_machine.status<>'BORROWED' or p_condition_in not in ('GOOD','NEEDS_INSPECTION','DAMAGED') then
      raise exception 'Invalid return request'; end if;
    if not exists (select 1 from public.machine_loans l
      where l.machine_id=p_machine_id and l.status='ACTIVE') then
      raise exception 'No active loan found'; end if;
  else
    raise exception 'Invalid action';
  end if;
  insert into public.machine_action_requests (
    machine_id, requested_by, action, borrower_name, organization,
    contact_number, purpose, due_at, condition_in, remarks
  ) values (
    p_machine_id, auth.uid(), p_action,
    case when p_action='BORROW' then btrim(p_borrower_name) else null end,
    case when p_action='BORROW' then nullif(btrim(coalesce(p_organization,'')),'') else null end,
    case when p_action='BORROW' then nullif(btrim(coalesce(p_contact_number,'')),'') else null end,
    case when p_action='BORROW' then nullif(btrim(coalesce(p_purpose,'')),'') else null end,
    case when p_action='BORROW' then p_due_at else null end,
    case when p_action='RETURN' then p_condition_in else null end,
    nullif(btrim(coalesce(p_remarks,'')),'')
  ) returning id into v_id;
  return v_id;
end; $$;
revoke all on function public.submit_machine_action_request(uuid,text,text,text,text,text,timestamptz,text,text) from public,anon;
grant execute on function public.submit_machine_action_request(uuid,text,text,text,text,text,timestamptz,text,text) to authenticated;

-- Admin approval is atomic: legacy RPC executes within the same transaction.
-- A failure leaves the request PENDING and does NOT change the machine.
create or replace function public.review_machine_action_request(
  p_request_id uuid, p_decision text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_request public.machine_action_requests%rowtype; v_loan_id uuid;
begin
  if not exists (select 1 from public.staff_profiles s
    where s.id=auth.uid() and s.is_active and s.approval_status='APPROVED' and s.role='ADMIN') then
    raise exception 'Only approved administrators can review machine requests';
  end if;
  if p_decision not in ('APPROVED','REJECTED') then raise exception 'Invalid decision'; end if;
  select * into v_request from public.machine_action_requests
    where id=p_request_id for update;
  if not found then raise exception 'Request not found'; end if;
  if v_request.status<>'PENDING' then raise exception 'Request was already reviewed'; end if;
  if v_request.requested_by=auth.uid() then raise exception 'You cannot approve your own request'; end if;

  if p_decision='APPROVED' then
    if v_request.action='BORROW' then
      select public.borrow_machine(
        p_machine_id=>v_request.machine_id,
        p_borrower_name=>v_request.borrower_name,
        p_organization=>v_request.organization,
        p_contact_number=>v_request.contact_number,
        p_purpose=>v_request.purpose,
        p_due_at=>v_request.due_at
      ) into v_loan_id;
    else
      select public.return_machine(
        p_machine_id=>v_request.machine_id,
        p_condition_in=>v_request.condition_in,
        p_remarks=>v_request.remarks
      ) into v_loan_id;
    end if;
  end if;
  update public.machine_action_requests set status=p_decision,
    reviewed_by=auth.uid(), reviewed_at=now(), loan_id=v_loan_id
  where id=p_request_id;
  return v_loan_id;
end; $$;
revoke all on function public.review_machine_action_request(uuid,text) from public,anon;
grant execute on function public.review_machine_action_request(uuid,text) to authenticated;

-- Keep the original registered-machine generator intact, but limit it to
-- Admin through a new checked wrapper.
create or replace function public.admin_register_machine(
  p_machine_name text, p_serial_number text, p_brand text,
  p_category text, p_location text
) returns text language plpgsql security definer set search_path = '' as $$
declare v_result text;
begin
  if not exists (select 1 from public.staff_profiles s
    where s.id=auth.uid() and s.is_active and s.approval_status='APPROVED' and s.role='ADMIN') then
    raise exception 'Administrator permission required'; end if;
  select public.register_machine(
    p_machine_name=>p_machine_name,p_serial_number=>p_serial_number,
    p_brand=>p_brand,p_category=>p_category,p_location=>p_location
  )::text into v_result;
  return v_result;
end; $$;
revoke all on function public.admin_register_machine(text,text,text,text,text) from public,anon;
grant execute on function public.admin_register_machine(text,text,text,text,text) to authenticated;

-- Accessories and deliveries: existing legacy RPCs are reused behind
-- checked wrappers (their definitions are installed by SQL 010).
create or replace function public.admin_register_accessory(
 p_sku text,p_name text,p_quantity integer,p_unit text,p_location text,p_notes text
) returns uuid language plpgsql security definer set search_path='' as $$
begin
  if not exists (select 1 from public.staff_profiles s
    where s.id=auth.uid() and s.is_active and s.approval_status='APPROVED' and s.role='ADMIN') then
    raise exception 'Administrator permission required'; end if;
  return public.register_accessory(p_sku,p_name,p_quantity,p_unit,p_location,p_notes);
end; $$;
revoke all on function public.admin_register_accessory(text,text,integer,text,text,text) from public,anon;
grant execute on function public.admin_register_accessory(text,text,integer,text,text,text) to authenticated;

create or replace function public.admin_create_client_delivery(
 p_client_name text,p_client_contact text,p_delivery_address text,p_item_type text,
 p_item_name text,p_item_code text,p_quantity integer,p_delivery_date date,p_remarks text
) returns uuid language plpgsql security definer set search_path='' as $$
begin
  if not exists (select 1 from public.staff_profiles s
    where s.id=auth.uid() and s.is_active and s.approval_status='APPROVED' and s.role='ADMIN') then
    raise exception 'Administrator permission required'; end if;
  return public.create_client_delivery(p_client_name,p_client_contact,p_delivery_address,p_item_type,
    p_item_name,p_item_code,p_quantity,p_delivery_date,p_remarks);
end; $$;
revoke all on function public.admin_create_client_delivery(text,text,text,text,text,text,integer,date,text) from public,anon;
grant execute on function public.admin_create_client_delivery(text,text,text,text,text,text,integer,date,text) to authenticated;

-- History remains available to Admin via a JSON wrapper; direct legacy
-- get_loan_history() execution is revoked for Technical users.
create or replace function public.get_admin_loan_history()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb;
begin
  if not exists (select 1 from public.staff_profiles s
    where s.id=auth.uid() and s.is_active and s.approval_status='APPROVED' and s.role='ADMIN') then
    raise exception 'Administrator permission required'; end if;
  select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) into v_result
    from public.get_loan_history() x;
  return v_result;
end; $$;
revoke all on function public.get_admin_loan_history() from public,anon;
grant execute on function public.get_admin_loan_history() to authenticated;

-- Lock down every existing overload of these legacy RPC names so authenticated
-- clients cannot bypass review by calling the old endpoints directly.
do $$
declare v_signature text;
begin
  for v_signature in
    select p.oid::regprocedure::text from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in (
      'borrow_machine','return_machine','register_machine',
      'register_accessory','create_client_delivery','get_loan_history'
    )
  loop
    execute format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated',v_signature);
  end loop;
end; $$;

commit;
