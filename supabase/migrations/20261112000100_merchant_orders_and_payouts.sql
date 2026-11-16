alter table public.shipments
  add column if not exists merchant_handoff_note text
    check (merchant_handoff_note is null or length(merchant_handoff_note) <= 500);

create table public.merchant_payouts (
  id uuid primary key default gen_random_uuid(),
  merchant_user_id uuid not null references public.merchant_profiles (user_id) on delete restrict,
  amount_minor_units bigint not null check (amount_minor_units > 0),
  currency text not null default 'NGN' check (currency = 'NGN'),
  status text not null check (status in ('pending', 'processing', 'paid', 'failed', 'cancelled')),
  payout_reference text,
  period_start date,
  period_end date,
  failure_reason text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  check (period_end is null or period_start is null or period_end >= period_start),
  check (failure_reason is null or length(failure_reason) <= 500)
);

create index merchant_payouts_owner_created_idx
  on public.merchant_payouts (merchant_user_id, created_at desc);

alter table public.merchant_payouts enable row level security;
revoke all on public.merchant_payouts from public, anon, authenticated;
grant all on public.merchant_payouts to service_role;

create function public.merchant_list_own_orders()
returns table (
  suborder_id uuid,
  public_reference text,
  status text,
  subtotal_minor_units bigint,
  delivery_fee_minor_units bigint,
  created_at timestamptz,
  accepted_at timestamptz,
  delivery_area text,
  delivery_landmark text,
  line_items jsonb,
  shipment_status text,
  merchant_handoff_note text
)
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
begin
  if not exists (
    select 1 from public.merchant_profiles m
    where m.user_id = (select auth.uid()) and m.verification_status = 'verified'
  ) then
    raise exception 'Verified merchant account required' using errcode = '42501';
  end if;

  return query
  select
    s.id,
    o.public_reference,
    s.status,
    s.subtotal_minor_units,
    s.delivery_fee_minor_units,
    s.created_at,
    s.accepted_at,
    coalesce(o.delivery_address_snapshot ->> 'area', o.delivery_address_snapshot #>> '{address,area}'),
    coalesce(o.delivery_address_snapshot ->> 'landmark', o.delivery_address_snapshot #>> '{address,landmark}'),
    coalesce(lines.items, '[]'::jsonb),
    shipment.status,
    shipment.merchant_handoff_note
  from public.merchant_suborders s
  join public.master_orders o on o.id = s.master_order_id
  left join lateral (
    select jsonb_agg(jsonb_build_object(
      'name', coalesce(ol.product_snapshot ->> 'name', ol.offer_snapshot ->> 'name', 'Product'),
      'quantity_requested', ol.quantity_requested,
      'quantity_accepted', ol.quantity_accepted,
      'unit_price_minor_units', ol.unit_price_minor_units
    ) order by ol.created_at) as items
    from public.order_lines ol
    where ol.merchant_suborder_id = s.id
  ) lines on true
  left join lateral (
    select sh.status, sh.merchant_handoff_note
    from public.shipments sh
    where sh.merchant_suborder_id = s.id
    order by sh.created_at desc
    limit 1
  ) shipment on true
  where s.merchant_user_id = (select auth.uid())
    and o.status in ('paid', 'processing', 'partially_fulfilled')
  order by s.created_at desc;
end;
$$;

create function public.merchant_update_order_status(
  target_suborder_id uuid,
  requested_status text,
  handoff_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  current_status text;
  parent_order_id uuid;
  parent_order_status text;
  shipment_id uuid;
  current_shipment_status text;
begin
  if not exists (
    select 1 from public.merchant_profiles m
    where m.user_id = (select auth.uid()) and m.verification_status = 'verified'
  ) then
    raise exception 'Verified merchant account required' using errcode = '42501';
  end if;
  if requested_status not in ('accepted', 'preparing', 'at_hub') then
    raise exception 'Unsupported merchant order status';
  end if;
  if handoff_note is not null and length(handoff_note) > 500 then
    raise exception 'Handoff note must be 500 characters or fewer';
  end if;

  select s.status, s.master_order_id
  into current_status, parent_order_id
  from public.merchant_suborders s
  where s.id = target_suborder_id and s.merchant_user_id = (select auth.uid())
  for update;
  if not found then
    raise exception 'Merchant order not found';
  end if;
  select o.status
  into parent_order_status
  from public.master_orders o
  where o.id = parent_order_id
  for update;
  if not found or parent_order_status not in ('paid', 'processing', 'partially_fulfilled') then
    raise exception 'Only paid, active orders can be updated';
  end if;
  if not (
    (current_status = 'awaiting_merchant' and requested_status = 'accepted')
    or (current_status = 'accepted' and requested_status = 'preparing')
    or (current_status = 'preparing' and requested_status = 'at_hub')
  ) then
    raise exception 'This order cannot move from % to %', current_status, requested_status;
  end if;

  update public.merchant_suborders
  set status = requested_status,
      accepted_at = case when requested_status = 'accepted' then now() else accepted_at end
  where id = target_suborder_id;

  if requested_status = 'accepted' then
    update public.order_lines
    set quantity_accepted = quantity_requested
    where merchant_suborder_id = target_suborder_id;
    update public.master_orders
    set status = 'processing'
    where id = parent_order_id and status = 'paid';
  end if;

  if requested_status = 'at_hub' then
    select sh.id, sh.status
    into shipment_id, current_shipment_status
    from public.shipments sh
    where sh.merchant_suborder_id = target_suborder_id
    order by sh.created_at desc
    limit 1
    for update;
    if found then
      if current_shipment_status not in ('awaiting_collection', 'at_hub') then
        raise exception 'Shipment is already being handled by the Kasua hub';
      end if;
      update public.shipments
      set status = 'at_hub',
          merchant_handoff_note = nullif(trim(handoff_note), '')
      where id = shipment_id;
    else
      insert into public.shipments (merchant_suborder_id, status, merchant_handoff_note)
      values (target_suborder_id, 'at_hub', nullif(trim(handoff_note), ''));
    end if;
  elsif handoff_note is not null then
    update public.shipments
    set merchant_handoff_note = nullif(trim(handoff_note), '')
    where merchant_suborder_id = target_suborder_id;
  end if;

  insert into public.order_events (
    master_order_id, merchant_suborder_id, actor_user_id, event_type, event_data
  ) values (
    parent_order_id, target_suborder_id, (select auth.uid()),
    'merchant_order_' || requested_status,
    jsonb_build_object('handoff_note', nullif(trim(handoff_note), ''))
  );
end;
$$;

create function public.merchant_list_own_payouts()
returns table (
  payout_id uuid,
  amount_minor_units bigint,
  status text,
  payout_reference text,
  period_start date,
  period_end date,
  failure_reason text,
  created_at timestamptz,
  paid_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
begin
  if not exists (
    select 1 from public.merchant_profiles m
    where m.user_id = (select auth.uid()) and m.verification_status = 'verified'
  ) then
    raise exception 'Verified merchant account required' using errcode = '42501';
  end if;

  return query
  select p.id, p.amount_minor_units, p.status, p.payout_reference,
    p.period_start, p.period_end, p.failure_reason, p.created_at, p.paid_at
  from public.merchant_payouts p
  where p.merchant_user_id = (select auth.uid())
  order by p.created_at desc;
end;
$$;

revoke all on function public.merchant_list_own_orders() from public, anon;
revoke all on function public.merchant_update_order_status(uuid, text, text) from public, anon;
revoke all on function public.merchant_list_own_payouts() from public, anon;
grant execute on function public.merchant_list_own_orders() to authenticated;
grant execute on function public.merchant_update_order_status(uuid, text, text) to authenticated;
grant execute on function public.merchant_list_own_payouts() to authenticated;
