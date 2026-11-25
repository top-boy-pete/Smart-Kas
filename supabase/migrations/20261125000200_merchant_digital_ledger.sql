create table public.merchant_business_activities (
  id uuid primary key default gen_random_uuid(),
  merchant_user_id uuid not null references public.merchant_profiles (user_id) on delete restrict,
  activity_date date not null,
  activity_type text not null check (activity_type in ('supplier_payment', 'other_income', 'other_expense')),
  counterparty text check (counterparty is null or length(trim(counterparty)) between 2 and 120),
  description text not null check (length(trim(description)) between 2 and 160),
  payment_reference text not null default '' check (length(payment_reference) <= 120),
  amount_minor_units bigint not null check (amount_minor_units between 1 and 1000000000000),
  currency text not null default 'NGN' check (currency = 'NGN'),
  created_at timestamptz not null default now(),
  check (activity_type <> 'supplier_payment' or counterparty is not null)
);

create index merchant_business_activities_owner_date_idx
  on public.merchant_business_activities (merchant_user_id, activity_date desc, created_at desc);

alter table public.merchant_business_activities enable row level security;
revoke all on public.merchant_business_activities from public, anon, authenticated;
grant all on public.merchant_business_activities to service_role;

create function public.merchant_add_own_business_activity(
  entry_type text,
  entry_description text,
  entry_amount_minor_units bigint,
  entry_date date,
  entry_counterparty text default null,
  entry_reference text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  new_activity_id uuid;
begin
  if not exists (
    select 1 from public.merchant_profiles m
    where m.user_id = (select auth.uid()) and m.verification_status = 'verified'
  ) then
    raise exception 'Verified merchant account required' using errcode = '42501';
  end if;
  if entry_type is null or entry_type not in ('supplier_payment', 'other_income', 'other_expense') then
    raise exception 'Choose a supported business activity';
  end if;
  if length(trim(coalesce(entry_description, ''))) not between 2 and 160 then
    raise exception 'Description must be between 2 and 160 characters';
  end if;
  if entry_amount_minor_units is null or entry_amount_minor_units not between 1 and 1000000000000 then
    raise exception 'Amount must be greater than zero and within the supported limit';
  end if;
  if entry_date is null or entry_date > (now() at time zone 'Africa/Lagos')::date then
    raise exception 'Activity date cannot be in the future';
  end if;
  if entry_counterparty is not null and length(trim(entry_counterparty)) not between 2 and 120 then
    raise exception 'Name must be between 2 and 120 characters';
  end if;
  if entry_type = 'supplier_payment' and length(trim(coalesce(entry_counterparty, ''))) not between 2 and 120 then
    raise exception 'Enter the supplier name';
  end if;
  if length(coalesce(entry_reference, '')) > 120 then
    raise exception 'Payment reference must be 120 characters or fewer';
  end if;

  insert into public.merchant_business_activities (
    merchant_user_id, activity_date, activity_type, counterparty,
    description, payment_reference, amount_minor_units
  ) values (
    (select auth.uid()), entry_date, entry_type, nullif(trim(entry_counterparty), ''),
    trim(entry_description), trim(coalesce(entry_reference, '')), entry_amount_minor_units
  ) returning id into new_activity_id;

  return new_activity_id;
end;
$$;

create function public.merchant_list_own_business_activities(
  target_start_date date,
  target_end_date date
)
returns table (
  activity_id uuid,
  activity_type text,
  transaction_date date,
  occurred_at timestamptz,
  reference text,
  description text,
  amount_minor_units bigint,
  status text
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
  if target_start_date is null or target_end_date is null or target_end_date < target_start_date
    or target_end_date - target_start_date > 365 then
    raise exception 'Choose a valid date range of no more than one year';
  end if;

  return query
  select activity.activity_id, activity.activity_type, activity.transaction_date,
    activity.occurred_at, activity.reference, activity.description,
    activity.amount_minor_units, activity.status
  from (
    select
      expense.id,
      'expense'::text,
      expense.expense_date,
      expense.expense_date::timestamp at time zone 'Africa/Lagos',
      '',
      expense.category || ': ' || expense.description,
      -expense.amount_minor_units,
      'recorded'::text
    from public.merchant_expenses expense
    where expense.merchant_user_id = (select auth.uid())
      and expense.expense_date between target_start_date and target_end_date

    union all

    select
      entry.id,
      entry.activity_type,
      entry.activity_date,
      entry.activity_date::timestamp at time zone 'Africa/Lagos',
      entry.payment_reference,
      case entry.activity_type
        when 'supplier_payment' then 'Supplier payment: ' || entry.counterparty || ' — ' || entry.description
        when 'other_income' then 'Other income: ' || coalesce(entry.counterparty || ' — ', '') || entry.description
        else 'Other expense: ' || coalesce(entry.counterparty || ' — ', '') || entry.description
      end,
      case when entry.activity_type = 'other_income'
        then entry.amount_minor_units
        else -entry.amount_minor_units
      end,
      'recorded'::text
    from public.merchant_business_activities entry
    where entry.merchant_user_id = (select auth.uid())
      and entry.activity_date between target_start_date and target_end_date
  ) activity
  order by activity.occurred_at desc, activity.activity_id;
end;
$$;

create function public.merchant_list_own_financial_order_items(target_suborder_id uuid)
returns table (
  product_name text,
  quantity integer,
  unit_price_minor_units bigint,
  line_total_minor_units bigint
)
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
begin
  if not exists (
    select 1
    from public.merchant_suborders s
    join public.merchant_profiles m on m.user_id = s.merchant_user_id
    join public.master_orders o on o.id = s.master_order_id
    where s.id = target_suborder_id
      and s.merchant_user_id = (select auth.uid())
      and m.verification_status = 'verified'
      and s.status not in ('rejected', 'cancelled')
      and o.status <> 'pending_payment'
      and exists (
        select 1 from public.payments payment
        where payment.master_order_id = o.id
          and payment.status in ('captured', 'partially_refunded', 'refunded')
      )
  ) then
    raise exception 'Paid merchant order not found' using errcode = '42501';
  end if;

  return query
  select
    coalesce(ol.product_snapshot ->> 'name', ol.offer_snapshot ->> 'name', 'Product'),
    greatest(ol.quantity_requested - ol.quantity_cancelled, 0),
    ol.unit_price_minor_units,
    ol.unit_price_minor_units * greatest(ol.quantity_requested - ol.quantity_cancelled, 0)
  from public.order_lines ol
  where ol.merchant_suborder_id = target_suborder_id
    and greatest(ol.quantity_requested - ol.quantity_cancelled, 0) > 0
  order by ol.created_at;
end;
$$;

revoke all on function public.merchant_add_own_business_activity(text, text, bigint, date, text, text) from public, anon;
revoke all on function public.merchant_list_own_business_activities(date, date) from public, anon;
revoke all on function public.merchant_list_own_financial_order_items(uuid) from public, anon;
grant execute on function public.merchant_add_own_business_activity(text, text, bigint, date, text, text) to authenticated;
grant execute on function public.merchant_list_own_business_activities(date, date) to authenticated;
grant execute on function public.merchant_list_own_financial_order_items(uuid) to authenticated;
