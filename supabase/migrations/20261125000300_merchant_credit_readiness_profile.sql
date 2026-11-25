create index if not exists order_lines_merchant_suborder_idx
  on public.order_lines (merchant_suborder_id);

create index if not exists refunds_merchant_suborder_succeeded_created_idx
  on public.refunds (merchant_suborder_id, created_at desc)
  where status = 'succeeded';

create index if not exists merchant_payouts_owner_paid_at_idx
  on public.merchant_payouts (merchant_user_id, paid_at desc)
  where status = 'paid';

create function public.merchant_get_own_credit_readiness_profile()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  merchant_id uuid := (select auth.uid());
  period_start_date date := date_trunc(
    'month',
    ((now() at time zone 'Africa/Lagos')::date - interval '5 months')
  )::date;
  period_end_date date := (now() at time zone 'Africa/Lagos')::date;
begin
  if not exists (
    select 1 from public.merchant_profiles m
    where m.user_id = merchant_id and m.verification_status = 'verified'
  ) then
    raise exception 'Verified merchant account required' using errcode = '42501';
  end if;

  return (
    with paid_orders as (
      select
        s.id,
        o.customer_id,
        s.status,
        (o.created_at at time zone 'Africa/Lagos')::date as order_date,
        date_trunc('month', o.created_at at time zone 'Africa/Lagos')::date as month_start,
        coalesce(sum(
          ol.unit_price_minor_units * greatest(ol.quantity_requested - ol.quantity_cancelled, 0)
        ), 0)::bigint as gross_minor_units
      from public.merchant_suborders s
      join public.master_orders o on o.id = s.master_order_id
      join public.order_lines ol on ol.merchant_suborder_id = s.id
      where s.merchant_user_id = merchant_id
        and (o.created_at at time zone 'Africa/Lagos')::date between period_start_date and period_end_date
        and o.status <> 'pending_payment'
        and exists (
          select 1 from public.payments payment
          where payment.master_order_id = o.id
            and payment.status in ('captured', 'partially_refunded', 'refunded')
        )
      group by s.id, o.customer_id, s.status, o.created_at
    ),
    sales_orders as (
      select * from paid_orders
      where status not in ('rejected', 'cancelled')
    ),
    customer_order_counts as (
      select customer_id, count(*) as order_count
      from sales_orders
      group by customer_id
    ),
    month_keys as (
      select generate_series(
        period_start_date::timestamp,
        date_trunc('month', period_end_date::timestamp),
        interval '1 month'
      )::date as month_start
    ),
    monthly_orders as (
      select
        month_start,
        count(*) filter (where status not in ('rejected', 'cancelled'))::integer as transaction_count,
        count(*) filter (where status = 'delivered')::integer as delivered_orders,
        count(*) filter (where status in (
          'awaiting_merchant', 'accepted', 'preparing', 'at_hub',
          'quality_check', 'ready_for_dispatch', 'in_transit'
        ))::integer as in_progress_orders,
        count(*) filter (where status in (
          'delayed', 'failed_delivery', 'cancelled', 'rejected'
        ))::integer as order_issues
      from paid_orders
      group by month_start
    ),
    monthly_sales as (
      select month_start, coalesce(sum(gross_minor_units), 0)::bigint as gross_sales_minor_units
      from sales_orders
      group by month_start
    ),
    monthly_refunds as (
      select
        date_trunc('month', refund.created_at at time zone 'Africa/Lagos')::date as month_start,
        coalesce(sum(refund.amount_minor_units), 0)::bigint as refund_minor_units
      from public.refunds refund
      join public.merchant_suborders s on s.id = refund.merchant_suborder_id
      where s.merchant_user_id = merchant_id
        and refund.status = 'succeeded'
        and (refund.created_at at time zone 'Africa/Lagos')::date between period_start_date and period_end_date
      group by date_trunc('month', refund.created_at at time zone 'Africa/Lagos')::date
    ),
    monthly_payouts as (
      select
        date_trunc('month', payout.paid_at at time zone 'Africa/Lagos')::date as month_start,
        coalesce(sum(payout.amount_minor_units), 0)::bigint as payout_minor_units
      from public.merchant_payouts payout
      where payout.merchant_user_id = merchant_id
        and payout.status = 'paid'
        and payout.paid_at is not null
        and (payout.paid_at at time zone 'Africa/Lagos')::date between period_start_date and period_end_date
      group by date_trunc('month', payout.paid_at at time zone 'Africa/Lagos')::date
    ),
    cost_rows as (
      select
        date_trunc('month', expense.expense_date::timestamp)::date as month_start,
        expense.amount_minor_units
      from public.merchant_expenses expense
      where expense.merchant_user_id = merchant_id
        and expense.expense_date between period_start_date and period_end_date

      union all

      select
        date_trunc('month', entry.activity_date::timestamp)::date,
        entry.amount_minor_units
      from public.merchant_business_activities entry
      where entry.merchant_user_id = merchant_id
        and entry.activity_type in ('supplier_payment', 'other_expense')
        and entry.activity_date between period_start_date and period_end_date
    ),
    monthly_costs as (
      select month_start, coalesce(sum(amount_minor_units), 0)::bigint as cost_minor_units
      from cost_rows
      group by month_start
    ),
    monthly_other_income as (
      select
        date_trunc('month', entry.activity_date::timestamp)::date as month_start,
        coalesce(sum(entry.amount_minor_units), 0)::bigint as other_income_minor_units
      from public.merchant_business_activities entry
      where entry.merchant_user_id = merchant_id
        and entry.activity_type = 'other_income'
        and entry.activity_date between period_start_date and period_end_date
      group by date_trunc('month', entry.activity_date::timestamp)::date
    ),
    monthly_profile as (
      select
        keys.month_start,
        coalesce(sales.gross_sales_minor_units, 0)::bigint as gross_sales_minor_units,
        coalesce(refunds.refund_minor_units, 0)::bigint as refund_minor_units,
        coalesce(orders.transaction_count, 0)::integer as transaction_count,
        coalesce(orders.delivered_orders, 0)::integer as delivered_orders,
        coalesce(orders.in_progress_orders, 0)::integer as in_progress_orders,
        coalesce(orders.order_issues, 0)::integer as order_issues,
        coalesce(payouts.payout_minor_units, 0)::bigint as payout_minor_units,
        coalesce(costs.cost_minor_units, 0)::bigint as cost_minor_units,
        coalesce(income.other_income_minor_units, 0)::bigint as other_income_minor_units
      from month_keys keys
      left join monthly_sales sales on sales.month_start = keys.month_start
      left join monthly_refunds refunds on refunds.month_start = keys.month_start
      left join monthly_orders orders on orders.month_start = keys.month_start
      left join monthly_payouts payouts on payouts.month_start = keys.month_start
      left join monthly_costs costs on costs.month_start = keys.month_start
      left join monthly_other_income income on income.month_start = keys.month_start
    ),
    order_totals as (
      select
        count(*) filter (where status not in ('rejected', 'cancelled'))::integer as transaction_count,
        count(*) filter (where status = 'delivered')::integer as delivered_orders,
        count(*) filter (where status in (
          'awaiting_merchant', 'accepted', 'preparing', 'at_hub',
          'quality_check', 'ready_for_dispatch', 'in_transit'
        ))::integer as in_progress_orders,
        count(*) filter (where status in (
          'delayed', 'failed_delivery', 'cancelled', 'rejected'
        ))::integer as order_issues
      from paid_orders
    ),
    customer_totals as (
      select
        count(*)::integer as unique_customers,
        count(*) filter (where order_count > 1)::integer as repeat_customers
      from customer_order_counts
    ),
    financial_totals as (
      select
        coalesce(sum(gross_sales_minor_units), 0)::bigint as gross_sales_minor_units,
        coalesce(sum(refund_minor_units), 0)::bigint as refund_minor_units,
        coalesce(sum(payout_minor_units), 0)::bigint as payout_minor_units,
        coalesce(sum(cost_minor_units), 0)::bigint as cost_minor_units,
        coalesce(sum(other_income_minor_units), 0)::bigint as other_income_minor_units,
        count(*) filter (where gross_sales_minor_units > 0)::integer as active_sales_months
      from monthly_profile
    )
    select jsonb_build_object(
      'period_start', period_start_date,
      'period_end', period_end_date,
      'months_in_period', 6,
      'gross_sales_minor_units', financial.gross_sales_minor_units::text,
      'refund_minor_units', financial.refund_minor_units::text,
      'net_sales_minor_units', (financial.gross_sales_minor_units - financial.refund_minor_units)::text,
      'average_monthly_net_sales_minor_units',
        round((financial.gross_sales_minor_units - financial.refund_minor_units)::numeric / 6)::bigint::text,
      'active_sales_months', financial.active_sales_months,
      'transaction_count', orders.transaction_count,
      'unique_customers', customers.unique_customers,
      'repeat_customers', customers.repeat_customers,
      'repeat_customer_rate',
        case when customers.unique_customers = 0 then null
          else round(customers.repeat_customers::numeric * 100 / customers.unique_customers, 1)
        end,
      'delivered_orders', orders.delivered_orders,
      'in_progress_orders', orders.in_progress_orders,
      'order_issues', orders.order_issues,
      'fulfillment_rate',
        case when orders.delivered_orders + orders.order_issues = 0 then null
          else round(orders.delivered_orders::numeric * 100 / (orders.delivered_orders + orders.order_issues), 1)
        end,
      'completed_payout_minor_units', financial.payout_minor_units::text,
      'recorded_cost_minor_units', financial.cost_minor_units::text,
      'other_income_minor_units', financial.other_income_minor_units::text,
      'monthly_history',
        coalesce((
          select jsonb_agg(jsonb_build_object(
            'month', profile.month_start,
            'gross_sales_minor_units', profile.gross_sales_minor_units::text,
            'refund_minor_units', profile.refund_minor_units::text,
            'transaction_count', profile.transaction_count,
            'delivered_orders', profile.delivered_orders,
            'in_progress_orders', profile.in_progress_orders,
            'order_issues', profile.order_issues,
            'payout_minor_units', profile.payout_minor_units::text,
            'cost_minor_units', profile.cost_minor_units::text,
            'other_income_minor_units', profile.other_income_minor_units::text,
            'cashflow_minor_units',
              (profile.payout_minor_units + profile.other_income_minor_units
                - profile.refund_minor_units - profile.cost_minor_units)::text
          ) order by profile.month_start)
          from monthly_profile profile
        ), '[]'::jsonb)
    )
    from financial_totals financial
    cross join order_totals orders
    cross join customer_totals customers
  );
end;
$$;

revoke all on function public.merchant_get_own_credit_readiness_profile() from public, anon;
grant execute on function public.merchant_get_own_credit_readiness_profile() to authenticated;
