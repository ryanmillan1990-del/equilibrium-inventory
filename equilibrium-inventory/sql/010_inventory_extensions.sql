-- EQUILIBRIUM INVENTORY: accessories + client delivery requests.
-- Run ONCE in your existing Supabase SQL editor. Existing data is retained.
create table if not exists public.inventory_accessories (
 id uuid primary key default gen_random_uuid(),
 sku text not null unique check (length(btrim(sku)) between 1 and 80),
 name text not null check (length(btrim(name)) between 1 and 160),
 quantity integer not null default 0 check (quantity between 0 and 1000000),
 unit text not null default 'pcs' check (unit in ('pcs','set','box','pair')),
 location text, notes text,
 created_by uuid not null references public.staff_profiles(id),
 created_at timestamptz not null default now()
);
create table if not exists public.client_deliveries (
 id uuid primary key default gen_random_uuid(),
 client_name text not null check (length(btrim(client_name)) > 0),
 client_contact text, delivery_address text not null check(length(btrim(delivery_address)) > 0),
 item_type text not null check(item_type in ('MACHINE','ACCESSORY')),
 item_name text not null check(length(btrim(item_name)) > 0),
 item_code text, quantity integer not null check(quantity between 1 and 1000000),
 delivery_date date not null, remarks text,
 status text not null default 'FOR_DELIVERY' check(status in ('FOR_DELIVERY','DISPATCHED','DELIVERED','CANCELLED')),
 created_by uuid not null references public.staff_profiles(id),
 created_at timestamptz not null default now()
);
alter table public.inventory_accessories enable row level security;
alter table public.client_deliveries enable row level security;
revoke all on public.inventory_accessories,public.client_deliveries from anon,authenticated;
grant select on public.inventory_accessories,public.client_deliveries to authenticated;
drop policy if exists staff_read_accessories on public.inventory_accessories;
create policy staff_read_accessories on public.inventory_accessories for select to authenticated using ((select private.is_staff()));
drop policy if exists staff_read_deliveries on public.client_deliveries;
create policy staff_read_deliveries on public.client_deliveries for select to authenticated using ((select private.is_staff()));
create or replace function public.register_accessory(
 p_sku text,p_name text,p_quantity integer,p_unit text,p_location text,p_notes text
) returns uuid language plpgsql security definer set search_path='' as $$
declare new_id uuid;
begin
 if not private.is_staff() then raise exception 'Unauthorized staff'; end if;
 if length(btrim(coalesce(p_sku,''))) not between 1 and 80 or length(btrim(coalesce(p_name,''))) not between 1 and 160 then
  raise exception 'Valid SKU and name are required'; end if;
 if p_quantity is null or p_quantity < 0 or p_quantity > 1000000 or p_unit not in ('pcs','set','box','pair') then
  raise exception 'Invalid quantity or unit'; end if;
 insert into public.inventory_accessories(sku,name,quantity,unit,location,notes,created_by)
 values(btrim(p_sku),btrim(p_name),p_quantity,p_unit,nullif(btrim(p_location),''),nullif(btrim(p_notes),''),auth.uid())
 returning id into new_id;
 return new_id;
end;$$;
create or replace function public.create_client_delivery(
 p_client_name text,p_client_contact text,p_delivery_address text,p_item_type text,
 p_item_name text,p_item_code text,p_quantity integer,p_delivery_date date,p_remarks text
) returns uuid language plpgsql security definer set search_path='' as $$
declare new_id uuid;
begin
 if not private.is_staff() then raise exception 'Unauthorized staff'; end if;
 if length(btrim(coalesce(p_client_name,''))) not between 1 and 160 or
    length(btrim(coalesce(p_delivery_address,''))) not between 1 and 600 or
    length(btrim(coalesce(p_item_name,''))) not between 1 and 160 then
  raise exception 'Client name, address and item name are required'; end if;
 if p_item_type not in ('MACHINE','ACCESSORY') or p_quantity is null or p_quantity < 1 or p_quantity > 1000000 or p_delivery_date is null then
  raise exception 'Invalid item type, quantity or date'; end if;
 insert into public.client_deliveries(client_name,client_contact,delivery_address,item_type,item_name,item_code,quantity,delivery_date,remarks,created_by)
 values(btrim(p_client_name),nullif(btrim(p_client_contact),''),btrim(p_delivery_address),p_item_type,btrim(p_item_name),nullif(btrim(p_item_code),''),p_quantity,p_delivery_date,nullif(btrim(p_remarks),''),auth.uid())
 returning id into new_id;
 return new_id;
end;$$;
revoke all on function public.register_accessory(text,text,integer,text,text,text) from public,anon;
revoke all on function public.create_client_delivery(text,text,text,text,text,text,integer,date,text) from public,anon;
grant execute on function public.register_accessory(text,text,integer,text,text,text) to authenticated;
grant execute on function public.create_client_delivery(text,text,text,text,text,text,integer,date,text) to authenticated;
