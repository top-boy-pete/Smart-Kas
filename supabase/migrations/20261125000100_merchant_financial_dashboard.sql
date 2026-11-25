create table public.merchant_expenses (
  id uuid primary key default gen_random_uuid(),
  merchant_user_id uuid not null references public.merchant_profiles (user_id) on delete restrict,
  expense_date date not null,
  category text not null check (category in ('stock', 'transport', 'rent', 'utilities', 'packaging', 'labour', 'other')),
  description text not null check (length(trim(description)) between 2 and 160),
  amount_minor_units bigint not null check (amount_minor_units between 1 and 1000000000000),
  currency text not null default 'NGN' check (currency = 'NGN'),
  created_at timestamptz not null default now()
);

create index merchant_expenses_owner_date_idx
  on public.merchant_expenses (merchant_user_id, expense_date desc, created_at desc);

alter table public.merchant_expenses enable row level security;
revoke all on public.merchant_expenses from public, anon, authenticated;
grant all on public.merchant_expenses to service_role;

create function public.merchant_add_own_expense(
  expense_category text,
  expense_description text,
  expense_amount_minor_units bigint,
  expense_date date
)
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  new_expense_id uuid;
begin
  if not exists (
    select 1 from public.merchant_profiles m
    where m.user_id = (select auth.uid()) and m.verification_status = 'verified'
  ) then
    raise exception 'Verified merchant account required' using errcode = '42501';
  end if;
  if expense_category is null or expense_category not in ('stock', 'transport', 'rent', 'utilities', 'packaging', 'labour', 'other') then
    raise exception 'Choose a supported expense category';
  end if;
  if length(trim(coalesce(expense_description, ''))) not between 2 and 160 then
    raise exception 'Expense description must be between 2 and 160 characters';
  end if;
  if expense_amount_minor_units is null or expense_amount_minor_units not between 1 and 1000000000000 then
    raise exception 'Expense amount must be greater than zero and within the supported limit';
  end if;
  if expense_date is null or expense_date > (now() at time zone 'Africa/Lagos')::date then
    raise exception 'Expense date cannot be in the future';
  end if;

  insert into public.merchant_expenses (
    merchant_user_id, expense_date, category, description, amount_minor_units
  ) values (
    (select auth.uid()), expense_date, expense_category, trim(expense_description), expense_amount_minor_units
  ) returning id into new_expense_id;

  return new_expense_id;
end;
$$;

create function public.merchant_list_own_financial_activity(
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
      s.id as activity_id,
      'sale'::text as activity_type,
      (o.created_at at time zone 'Africa/Lagos')::date as transaction_date,
      o.created_at as occurred_at,
      o.public_reference as reference,
      'Paid order'::text as description,
      coalesce(sum(
        ol.unit_price_minor_units * greatest(ol.quantity_requested - ol.quantity_cancelled, 0)
      ), 0)::bigint as amount_minor_units,
      s.status::text as status
    from public.merchant_suborders s
    join public.master_orders o on o.id = s.master_order_id
    join public.order_lines ol on ol.merchant_suborder_id = s.id
    where s.merchant_user_id = (select auth.uid())
      and s.status not in ('rejected', 'cancelled')
      and o.status <> 'pending_payment'
      and (o.created_at at time zone 'Africa/Lagos')::date between target_start_date and target_end_date
      and exists (
        select 1 from public.payments payment
        where payment.master_order_id = o.id
          and payment.status in ('captured', 'partially_refunded', 'refunded')
      )
    group by s.id, o.created_at, o.public_reference, s.status

    union all

    select
      refund.id,
      'refund'::text,
      (refund.created_at at time zone 'Africa/Lagos')::date,
      refund.created_at,
      o.public_reference,
      'Successful refund'::text,
      -refund.amount_minor_units,
      refund.status::text
    from public.refunds refund
    join public.merchant_suborders s on s.id = refund.merchant_suborder_id
    join public.master_orders o on o.id = refund.master_order_id
    where s.merchant_user_id = (select auth.uid())
      and refund.status = 'succeeded'
      and (refund.created_at at time zone 'Africa/Lagos')::date between target_start_date and target_end_date

    union all

    select
      payout.id,
      'payout'::text,
      (payout.paid_at at time zone 'Africa/Lagos')::date,
      payout.paid_at,
      coalesce(payout.payout_reference, ''),
      'Completed payout'::text,
      payout.amount_minor_units,
      payout.status::text
    from public.merchant_payouts payout
    where payout.merchant_user_id = (select auth.uid())
      and payout.status = 'paid'
      and payout.paid_at is not null
      and (payout.paid_at at time zone 'Africa/Lagos')::date between target_start_date and target_end_date

    union all

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
  ) activity
  order by activity.occurred_at desc, activity.activity_id;
end;
$$;

revoke all on function public.merchant_add_own_expense(text, text, bigint, date) from public, anon;
revoke all on function public.merchant_list_own_financial_activity(date, date) from public, anon;
grant execute on function public.merchant_add_own_expense(text, text, bigint, date) to authenticated;
grant execute on function public.merchant_list_own_financial_activity(date, date) to authenticated;
