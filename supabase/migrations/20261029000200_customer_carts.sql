create table public.customer_cart_items (
  customer_id uuid not null references public.profiles (id) on delete cascade,
  offer_id uuid not null references public.merchant_offers (id) on delete restrict,
  quantity integer not null check (quantity between 1 and 99),
  updated_at timestamptz not null default now(),
  primary key (customer_id, offer_id)
);

alter table public.customer_cart_items enable row level security;
revoke all on public.customer_cart_items from public, anon, authenticated;
grant all on public.customer_cart_items to service_role;

create or replace function public.load_customer_cart(target_customer_id uuid)
returns table (offer_id uuid, quantity integer)
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  customer uuid := (select auth.uid());
begin
  if customer is null or target_customer_id is distinct from customer or not exists (
    select 1 from public.profiles p where p.id = customer and p.account_type = 'consumer'
  ) then
    raise exception 'Consumer account required' using errcode = '42501';
  end if;

  return query
  select i.offer_id, i.quantity
  from public.customer_cart_items i
  where i.customer_id = customer
  order by i.updated_at desc;
end;
$$;

create or replace function public.merge_guest_cart(target_customer_id uuid, guest_items jsonb)
returns table (offer_id uuid, quantity integer)
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  customer uuid := (select auth.uid());
begin
  if customer is null or target_customer_id is distinct from customer or not exists (
    select 1 from public.profiles p where p.id = customer and p.account_type = 'consumer'
  ) then
    raise exception 'Consumer account required' using errcode = '42501';
  end if;
  if guest_items is null or jsonb_typeof(guest_items) is distinct from 'array' then
    raise exception 'Guest cart must be a JSON array';
  end if;
  if jsonb_array_length(guest_items) > 100 then
    raise exception 'Guest cart must contain no more than 100 items';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(guest_items) as item(offer_id uuid, quantity integer)
    where item.offer_id is null or item.quantity is null or item.quantity not between 1 and 99
  ) or exists (
    select item.offer_id
    from jsonb_to_recordset(guest_items) as item(offer_id uuid, quantity integer)
    group by item.offer_id
    having count(*) > 1
  ) then
    raise exception 'Guest cart contains invalid or duplicate items';
  end if;

  insert into public.customer_cart_items as current_item (customer_id, offer_id, quantity)
  select customer, item.offer_id, item.quantity
  from jsonb_to_recordset(guest_items) as item(offer_id uuid, quantity integer)
  on conflict (customer_id, offer_id) do update
  set quantity = greatest(current_item.quantity, excluded.quantity),
      updated_at = now();

  return query
  select i.offer_id, i.quantity
  from public.customer_cart_items i
  where i.customer_id = customer
  order by i.updated_at desc;
end;
$$;

create or replace function public.save_customer_cart(target_customer_id uuid, cart_items jsonb)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  customer uuid := (select auth.uid());
begin
  if customer is null or target_customer_id is distinct from customer or not exists (
    select 1 from public.profiles p where p.id = customer and p.account_type = 'consumer'
  ) then
    raise exception 'Consumer account required' using errcode = '42501';
  end if;
  if cart_items is null or jsonb_typeof(cart_items) is distinct from 'array' then
    raise exception 'Cart must be a JSON array';
  end if;
  if jsonb_array_length(cart_items) > 100 then
    raise exception 'Cart must contain no more than 100 items';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(cart_items) as item(offer_id uuid, quantity integer)
    where item.offer_id is null or item.quantity is null or item.quantity not between 1 and 99
  ) or exists (
    select item.offer_id
    from jsonb_to_recordset(cart_items) as item(offer_id uuid, quantity integer)
    group by item.offer_id
    having count(*) > 1
  ) then
    raise exception 'Cart contains invalid or duplicate items';
  end if;

  delete from public.customer_cart_items i where i.customer_id = customer;
  insert into public.customer_cart_items (customer_id, offer_id, quantity)
  select customer, item.offer_id, item.quantity
  from jsonb_to_recordset(cart_items) as item(offer_id uuid, quantity integer);
end;
$$;

revoke all on function public.load_customer_cart(uuid) from public, anon;
revoke all on function public.merge_guest_cart(uuid, jsonb) from public, anon;
revoke all on function public.save_customer_cart(uuid, jsonb) from public, anon;
grant execute on function public.load_customer_cart(uuid) to authenticated;
grant execute on function public.merge_guest_cart(uuid, jsonb) to authenticated;
grant execute on function public.save_customer_cart(uuid, jsonb) to authenticated;
