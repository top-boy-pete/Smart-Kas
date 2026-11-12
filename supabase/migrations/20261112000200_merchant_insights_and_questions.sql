create table public.merchant_questions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete restrict,
  merchant_user_id uuid not null references public.merchant_profiles (user_id) on delete restrict,
  offer_id uuid not null references public.merchant_offers (id) on delete restrict,
  question text not null check (length(trim(question)) between 5 and 1000),
  answer text check (answer is null or length(trim(answer)) between 5 and 1000),
  status text not null default 'open' check (status in ('open', 'answered', 'closed')),
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  check ((status = 'answered' and answer is not null and answered_at is not null)
    or (status <> 'answered' and answered_at is null))
);

create index merchant_questions_owner_created_idx
  on public.merchant_questions (merchant_user_id, status, created_at desc);
create index merchant_questions_customer_created_idx
  on public.merchant_questions (customer_id, created_at desc);

alter table public.merchant_questions enable row level security;
revoke all on public.merchant_questions from public, anon, authenticated;
grant all on public.merchant_questions to service_role;

create function public.customer_ask_merchant_question(target_offer_id uuid, question_text text)
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  question_id uuid;
  merchant_id uuid;
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.account_type = 'consumer'
  ) then
    raise exception 'Sign in with a customer account to contact a merchant' using errcode = '42501';
  end if;
  if length(trim(coalesce(question_text, ''))) not between 5 and 1000 then
    raise exception 'Question must be between 5 and 1,000 characters';
  end if;

  select o.merchant_user_id into merchant_id
  from public.merchant_offers o
  join public.merchant_profiles m on m.user_id = o.merchant_user_id
  join public.products p on p.id = o.product_id
  where o.id = target_offer_id and o.is_active and o.available_quantity > 0
    and p.status = 'active' and m.verification_status = 'verified';
  if merchant_id is null then
    raise exception 'This listing is not available for questions';
  end if;

  insert into public.merchant_questions (
    customer_id, merchant_user_id, offer_id, question
  ) values (
    (select auth.uid()), merchant_id, target_offer_id, trim(question_text)
  ) returning id into question_id;

  return question_id;
end;
$$;

create function public.merchant_list_own_questions()
returns table (
  question_id uuid,
  offer_id uuid,
  product_name text,
  question text,
  answer text,
  status text,
  created_at timestamptz,
  answered_at timestamptz
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
  select q.id, q.offer_id, p.name, q.question, q.answer, q.status, q.created_at, q.answered_at
  from public.merchant_questions q
  join public.merchant_offers o on o.id = q.offer_id
  join public.products p on p.id = o.product_id
  where q.merchant_user_id = (select auth.uid())
  order by case q.status when 'open' then 0 when 'answered' then 1 else 2 end, q.created_at desc;
end;
$$;

create function public.merchant_answer_customer_question(target_question_id uuid, answer_text text)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  question_status text;
begin
  if not exists (
    select 1 from public.merchant_profiles m
    where m.user_id = (select auth.uid()) and m.verification_status = 'verified'
  ) then
    raise exception 'Verified merchant account required' using errcode = '42501';
  end if;
  if length(trim(coalesce(answer_text, ''))) not between 5 and 1000 then
    raise exception 'Reply must be between 5 and 1,000 characters';
  end if;

  select q.status into question_status
  from public.merchant_questions q
  where q.id = target_question_id and q.merchant_user_id = (select auth.uid())
  for update;
  if not found or question_status = 'closed' then
    raise exception 'Open merchant question not found';
  end if;

  update public.merchant_questions
  set answer = trim(answer_text), status = 'answered', answered_at = now()
  where id = target_question_id;
end;
$$;

create function public.customer_list_own_merchant_questions()
returns table (
  question_id uuid,
  product_name text,
  question text,
  answer text,
  status text,
  created_at timestamptz,
  answered_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.account_type = 'consumer'
  ) then
    raise exception 'Customer account required' using errcode = '42501';
  end if;

  return query
  select q.id, p.name, q.question, q.answer, q.status, q.created_at, q.answered_at
  from public.merchant_questions q
  join public.merchant_offers o on o.id = q.offer_id
  join public.products p on p.id = o.product_id
  where q.customer_id = (select auth.uid())
  order by q.created_at desc;
end;
$$;

create function public.merchant_list_own_insights()
returns table (
  offer_id uuid,
  product_id uuid,
  product_name text,
  category_name text,
  product_unit text,
  product_size text,
  current_price_minor_units bigint,
  available_quantity integer,
  units_ordered_7d bigint,
  units_ordered_30d bigint,
  orders_30d bigint,
  gross_sales_minor_units_30d bigint,
  comparison_count bigint,
  comparison_min_minor_units bigint,
  comparison_median_minor_units bigint,
  comparison_max_minor_units bigint
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
    own_offer.id,
    product.id,
    product.name,
    category.name,
    coalesce(product.variant_attributes ->> 'unit', product.attributes ->> 'unit', 'per item'),
    coalesce(product.variant_attributes ->> 'size', ''),
    own_offer.price_minor_units,
    own_offer.available_quantity,
    coalesce(sales.units_7d, 0)::bigint,
    coalesce(sales.units_30d, 0)::bigint,
    coalesce(sales.orders_30d, 0)::bigint,
    coalesce(sales.gross_30d, 0)::bigint,
    coalesce(prices.comparison_count, 0)::bigint,
    prices.minimum_price,
    prices.median_price,
    prices.maximum_price
  from public.merchant_offers own_offer
  join public.products product on product.id = own_offer.product_id
  left join public.categories category on category.id = product.category_id
  left join lateral (
    select
      sum(greatest(ol.quantity_requested - ol.quantity_cancelled, 0))
        filter (where mo.created_at >= now() - interval '7 days') as units_7d,
      sum(greatest(ol.quantity_requested - ol.quantity_cancelled, 0)) as units_30d,
      count(distinct ol.master_order_id) as orders_30d,
      sum(ol.unit_price_minor_units * greatest(ol.quantity_requested - ol.quantity_cancelled, 0)) as gross_30d
    from public.order_lines ol
    join public.merchant_suborders ms on ms.id = ol.merchant_suborder_id
    join public.master_orders mo on mo.id = ol.master_order_id
    where ol.offer_id = own_offer.id
      and ms.merchant_user_id = (select auth.uid())
      and ms.status not in ('rejected', 'cancelled')
      and mo.status in ('paid', 'processing', 'partially_fulfilled', 'fulfilled')
      and mo.created_at >= now() - interval '30 days'
  ) sales on true
  left join lateral (
    select
      count(*) as comparison_count,
      min(competing.price_minor_units) as minimum_price,
      percentile_disc(0.5) within group (order by competing.price_minor_units)::bigint as median_price,
      max(competing.price_minor_units) as maximum_price
    from public.merchant_offers competing
    join public.products comparable on comparable.id = competing.product_id
    join public.merchant_profiles competing_merchant
      on competing_merchant.user_id = competing.merchant_user_id
    where competing.id <> own_offer.id
      and competing.is_active
      and competing.available_quantity > 0
      and competing_merchant.verification_status = 'verified'
      and comparable.status = 'active'
      and comparable.category_id is not distinct from product.category_id
      and lower(coalesce(comparable.variant_attributes ->> 'unit', comparable.attributes ->> 'unit', 'per item'))
        = lower(coalesce(product.variant_attributes ->> 'unit', product.attributes ->> 'unit', 'per item'))
      and lower(coalesce(comparable.variant_attributes ->> 'size', ''))
        = lower(coalesce(product.variant_attributes ->> 'size', ''))
  ) prices on true
  where own_offer.merchant_user_id = (select auth.uid())
  order by coalesce(sales.gross_30d, 0) desc, product.name;
end;
$$;

revoke all on function public.customer_ask_merchant_question(uuid, text) from public, anon;
revoke all on function public.merchant_list_own_questions() from public, anon;
revoke all on function public.merchant_answer_customer_question(uuid, text) from public, anon;
revoke all on function public.customer_list_own_merchant_questions() from public, anon;
revoke all on function public.merchant_list_own_insights() from public, anon;
grant execute on function public.customer_ask_merchant_question(uuid, text) to authenticated;
grant execute on function public.merchant_list_own_questions() to authenticated;
grant execute on function public.merchant_answer_customer_question(uuid, text) to authenticated;
grant execute on function public.customer_list_own_merchant_questions() to authenticated;
grant execute on function public.merchant_list_own_insights() to authenticated;
