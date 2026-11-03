alter table public.merchant_profiles add column if not exists review_feedback text;

create table public.staff_roles (
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in (
    'merchant_reviewer',
    'support_agent',
    'account_manager',
    'operations_viewer',
    'catalog_reviewer',
    'finance_reviewer',
    'finance_approver',
    'audit_viewer'
  )),
  granted_by uuid references public.profiles (id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

alter table public.staff_roles enable row level security;
revoke all on public.staff_roles from public, anon, authenticated;
grant select on public.staff_roles to authenticated;
grant all on public.staff_roles to service_role;

create policy "staff_roles_select_own" on public.staff_roles
  for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.staff_has_role(role_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select exists (
    select 1
    from public.staff_roles r
    where r.user_id = (select auth.uid())
      and r.role = role_name
  );
$$;

revoke all on function public.staff_has_role(text) from public, anon;
grant execute on function public.staff_has_role(text) to authenticated;

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  area text not null check (area in ('merchant_review', 'complaints', 'finance', 'accounts', 'operations', 'catalog')),
  actor_user_id uuid references public.profiles (id) on delete set null,
  actor_role text not null,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_events_actor_created_idx on public.audit_events (actor_user_id, created_at desc);
create index audit_events_area_created_idx on public.audit_events (area, created_at desc);
alter table public.audit_events enable row level security;
revoke all on public.audit_events from public, anon, authenticated;
grant select on public.audit_events to authenticated;
grant all on public.audit_events to service_role;

create policy "audit_events_select_own_or_auditor" on public.audit_events
  for select to authenticated
  using (actor_user_id = (select auth.uid()) or public.staff_has_role('audit_viewer'));

create table public.merchant_review_checks (
  application_user_id uuid not null references public.merchant_profiles (user_id) on delete cascade,
  check_key text not null check (check_key in ('identity', 'market', 'location', 'policy')),
  is_complete boolean not null default false,
  notes text not null default '',
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (application_user_id, check_key)
);

alter table public.merchant_review_checks enable row level security;
revoke all on public.merchant_review_checks from public, anon, authenticated;
grant all on public.merchant_review_checks to service_role;

create or replace function public.seed_merchant_review_checks()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.merchant_review_checks (application_user_id, check_key)
  values
    (new.user_id, 'identity'),
    (new.user_id, 'market'),
    (new.user_id, 'location'),
    (new.user_id, 'policy')
  on conflict (application_user_id, check_key) do nothing;
  return new;
end;
$$;

create trigger merchant_profile_seed_review_checks
after insert on public.merchant_profiles
for each row execute function public.seed_merchant_review_checks();

revoke all on function public.seed_merchant_review_checks() from public, anon, authenticated;

insert into public.merchant_review_checks (application_user_id, check_key)
select m.user_id, checks.check_key
from public.merchant_profiles m
cross join (values ('identity'), ('market'), ('location'), ('policy')) as checks(check_key)
on conflict (application_user_id, check_key) do nothing;

create policy "merchant_profiles_select_reviewer" on public.merchant_profiles
  for select to authenticated using (public.staff_has_role('merchant_reviewer'));

create or replace function public.admin_list_merchant_applications()
returns table (
  user_id uuid,
  full_name text,
  store_name text,
  market_name text,
  stall_number text,
  landmark text,
  verification_status text,
  submitted_at timestamptz,
  checks jsonb
)
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
begin
  if not public.staff_has_role('merchant_reviewer') then
    raise exception 'Merchant reviewer role required' using errcode = '42501';
  end if;

  return query
  select
    m.user_id,
    p.full_name,
    m.store_name,
    m.market_name,
    m.stall_number,
    m.landmark,
    m.verification_status,
    m.submitted_at,
    coalesce(
      jsonb_agg(jsonb_build_object('id', c.check_key, 'complete', c.is_complete, 'notes', c.notes)
        order by c.check_key) filter (where c.check_key is not null),
      '[]'::jsonb
    )
  from public.merchant_profiles m
  join public.profiles p on p.id = m.user_id
  left join public.merchant_review_checks c on c.application_user_id = m.user_id
  group by m.user_id, p.full_name, m.store_name, m.market_name, m.stall_number, m.landmark,
    m.verification_status, m.submitted_at
  order by m.submitted_at desc;
end;
$$;

create or replace function public.admin_set_merchant_review_check(
  target_user_id uuid,
  target_check_key text,
  completed boolean,
  reviewer_note text default ''
)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
begin
  if not public.staff_has_role('merchant_reviewer') then
    raise exception 'Merchant reviewer role required' using errcode = '42501';
  end if;
  if target_check_key not in ('identity', 'market', 'location', 'policy') then
    raise exception 'Unsupported review check';
  end if;
  if length(coalesce(reviewer_note, '')) > 1000 then
    raise exception 'Review notes must be 1000 characters or fewer';
  end if;

  update public.merchant_review_checks c
  set is_complete = completed,
      notes = coalesce(reviewer_note, ''),
      updated_by = (select auth.uid()),
      updated_at = now()
  from public.merchant_profiles m
  where c.application_user_id = target_user_id
    and c.application_user_id = m.user_id
    and c.check_key = target_check_key
    and m.verification_status in ('pending', 'needs_changes');

  if not found then
    raise exception 'Reviewable merchant application or check not found';
  end if;

  insert into public.audit_events (area, actor_user_id, actor_role, action, entity_type, entity_id, details)
  values ('merchant_review', (select auth.uid()), 'merchant_reviewer', 'review_check_updated',
    'merchant_application', target_user_id::text,
    jsonb_build_object('check', target_check_key, 'complete', completed, 'notes', coalesce(reviewer_note, '')));
end;
$$;

create or replace function public.admin_review_merchant_application(
  target_user_id uuid,
  decision text,
  decision_reason text default ''
)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  current_status text;
begin
  if not public.staff_has_role('merchant_reviewer') then
    raise exception 'Merchant reviewer role required' using errcode = '42501';
  end if;
  if decision not in ('verified', 'needs_changes', 'rejected') then
    raise exception 'Unsupported merchant review decision';
  end if;
  if decision in ('needs_changes', 'rejected') and length(trim(coalesce(decision_reason, ''))) < 3 then
    raise exception 'A reason is required for this decision';
  end if;
  if length(coalesce(decision_reason, '')) > 2000 then
    raise exception 'Decision reason must be 2000 characters or fewer';
  end if;

  select m.verification_status into current_status
  from public.merchant_profiles m
  where m.user_id = target_user_id
  for update;
  if not found or current_status not in ('pending', 'needs_changes') then
    raise exception 'Merchant application is not awaiting review';
  end if;
  if decision = 'verified' and exists (
    select 1 from public.merchant_review_checks c
    where c.application_user_id = target_user_id and not c.is_complete
  ) then
    raise exception 'Complete all review checks before approval';
  end if;

  update public.merchant_profiles
  set verification_status = decision,
      reviewer_user_id = (select auth.uid()),
      reviewed_at = now(),
      review_feedback = case when decision in ('needs_changes', 'rejected') then trim(coalesce(decision_reason, '')) else null end
  where user_id = target_user_id;

  insert into public.audit_events (area, actor_user_id, actor_role, action, entity_type, entity_id, details)
  values ('merchant_review', (select auth.uid()), 'merchant_reviewer', 'application_' || decision,
    'merchant_application', target_user_id::text, jsonb_build_object('reason', coalesce(decision_reason, '')));
end;
$$;

create or replace function public.resubmit_merchant_application(
  new_store_name text,
  new_market_name text,
  new_stall_number text,
  new_landmark text
)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  application_status text;
  applicant_id uuid := (select auth.uid());
begin
  if applicant_id is null or not exists (
    select 1 from public.profiles p
    where p.id = applicant_id and p.account_type = 'merchant'
  ) then
    raise exception 'Merchant account required' using errcode = '42501';
  end if;
  if length(trim(coalesce(new_store_name, ''))) not between 2 and 120
    or length(trim(coalesce(new_market_name, ''))) not between 2 and 120
    or length(trim(coalesce(new_stall_number, ''))) not between 1 and 40
    or length(trim(coalesce(new_landmark, ''))) not between 2 and 240 then
    raise exception 'Enter valid store, market, stall, and location details';
  end if;

  select m.verification_status into application_status
  from public.merchant_profiles m
  where m.user_id = applicant_id
  for update;
  if not found or application_status <> 'needs_changes' then
    raise exception 'Only applications with requested changes can be resubmitted';
  end if;

  update public.merchant_profiles
  set store_name = trim(new_store_name),
      market_name = trim(new_market_name),
      stall_number = trim(new_stall_number),
      landmark = trim(new_landmark),
      verification_status = 'pending',
      submitted_at = now(),
      reviewed_at = null,
      reviewer_user_id = null,
      review_feedback = null
  where user_id = applicant_id;

  update public.merchant_review_checks
  set is_complete = false,
      notes = '',
      updated_by = null,
      updated_at = now()
  where application_user_id = applicant_id;

  insert into public.audit_events (area, actor_user_id, actor_role, action, entity_type, entity_id, details)
  values ('merchant_review', applicant_id, 'merchant', 'application_resubmitted',
    'merchant_application', applicant_id::text, '{}'::jsonb);
end;
$$;

revoke all on function public.admin_list_merchant_applications() from public, anon;
revoke all on function public.admin_set_merchant_review_check(uuid, text, boolean, text) from public, anon;
revoke all on function public.admin_review_merchant_application(uuid, text, text) from public, anon;
revoke all on function public.resubmit_merchant_application(text, text, text, text) from public, anon;
grant execute on function public.admin_list_merchant_applications() to authenticated;
grant execute on function public.admin_set_merchant_review_check(uuid, text, boolean, text) to authenticated;
grant execute on function public.admin_review_merchant_application(uuid, text, text) to authenticated;
grant execute on function public.resubmit_merchant_application(text, text, text, text) to authenticated;

create table public.complaint_cases (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete restrict,
  master_order_id uuid references public.master_orders (id) on delete restrict,
  subject text not null check (length(trim(subject)) between 3 and 160),
  description text not null check (length(trim(description)) between 3 and 5000),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  status text not null default 'open' check (status in ('open', 'investigating', 'waiting_on_customer', 'resolved', 'closed')),
  assigned_to uuid references public.profiles (id) on delete set null,
  resolution text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (resolution is null or length(resolution) <= 2000)
);

create index complaint_cases_queue_idx on public.complaint_cases (status, priority, created_at desc);
alter table public.complaint_cases enable row level security;
revoke all on public.complaint_cases from public, anon, authenticated;
grant select (
  id, customer_id, master_order_id, subject, description, priority, status,
  assigned_to, created_at, updated_at
) on public.complaint_cases to authenticated;
grant insert (customer_id, master_order_id, subject, description) on public.complaint_cases to authenticated;
grant all on public.complaint_cases to service_role;

create table public.complaint_events (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.complaint_cases (id) on delete cascade,
  actor_user_id uuid references public.profiles (id) on delete set null,
  event_type text not null,
  event_note text not null default '',
  internal_only boolean not null default true,
  created_at timestamptz not null default now(),
  check (length(event_note) <= 2000)
);

create index complaint_events_case_created_idx on public.complaint_events (complaint_id, created_at);
alter table public.complaint_events enable row level security;
revoke all on public.complaint_events from public, anon, authenticated;
grant select on public.complaint_events to authenticated;
grant all on public.complaint_events to service_role;

create or replace function public.is_complaint_customer(target_complaint_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select exists (
    select 1 from public.complaint_cases c
    where c.id = target_complaint_id and c.customer_id = (select auth.uid())
  );
$$;

revoke all on function public.is_complaint_customer(uuid) from public, anon;
grant execute on function public.is_complaint_customer(uuid) to authenticated;

create policy "complaint_cases_select_customer_or_support" on public.complaint_cases
  for select to authenticated
  using (customer_id = (select auth.uid()) or public.staff_has_role('support_agent'));
create policy "complaint_cases_insert_own" on public.complaint_cases
  for insert to authenticated
  with check (
    customer_id = (select auth.uid())
    and status = 'open'
    and priority = 'normal'
    and assigned_to is null
    and resolution is null
    and (master_order_id is null or public.is_master_order_customer(master_order_id))
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.account_type = 'consumer'
    )
  );
create policy "complaint_events_select_customer_or_support" on public.complaint_events
  for select to authenticated
  using (
    (not internal_only and public.is_complaint_customer(complaint_id))
    or public.staff_has_role('support_agent')
  );

create or replace function public.record_new_complaint()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.complaint_events (complaint_id, actor_user_id, event_type, event_note, internal_only)
  values (new.id, new.customer_id, 'opened', 'Complaint opened by customer', false);
  insert into public.audit_events (area, actor_user_id, actor_role, action, entity_type, entity_id, details)
  values ('complaints', new.customer_id, 'customer', 'complaint_opened', 'complaint', new.id::text,
    jsonb_build_object('order_id', new.master_order_id));
  return new;
end;
$$;

create trigger complaint_opened_records_event
after insert on public.complaint_cases
for each row execute function public.record_new_complaint();

revoke all on function public.record_new_complaint() from public, anon, authenticated;

create or replace function public.admin_list_complaints()
returns table (
  id uuid,
  customer_name text,
  order_reference text,
  subject text,
  description text,
  priority text,
  status text,
  assigned_to uuid,
  created_at timestamptz,
  updated_at timestamptz,
  events jsonb
)
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
begin
  if not public.staff_has_role('support_agent') then
    raise exception 'Support agent role required' using errcode = '42501';
  end if;

  return query
  select
    c.id,
    p.full_name,
    o.public_reference,
    c.subject,
    c.description,
    c.priority,
    c.status,
    c.assigned_to,
    c.created_at,
    c.updated_at,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id, 'event_type', e.event_type, 'event_note', e.event_note,
        'internal_only', e.internal_only, 'created_at', e.created_at, 'actor_user_id', e.actor_user_id
      ) order by e.created_at)
      from public.complaint_events e where e.complaint_id = c.id
    ), '[]'::jsonb)
  from public.complaint_cases c
  join public.profiles p on p.id = c.customer_id
  left join public.master_orders o on o.id = c.master_order_id
  order by c.created_at desc;
end;
$$;

create or replace function public.admin_update_complaint(
  target_complaint_id uuid,
  new_status text,
  new_priority text,
  claim_for_self boolean,
  staff_note text
)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  prior_status text;
  prior_priority text;
begin
  if not public.staff_has_role('support_agent') then
    raise exception 'Support agent role required' using errcode = '42501';
  end if;
  if new_status not in ('open', 'investigating', 'waiting_on_customer', 'resolved', 'closed') then
    raise exception 'Unsupported complaint status';
  end if;
  if new_priority not in ('low', 'normal', 'high') then
    raise exception 'Unsupported complaint priority';
  end if;
  if length(trim(coalesce(staff_note, ''))) < 3 or length(staff_note) > 2000 then
    raise exception 'A staff note between 3 and 2000 characters is required';
  end if;

  select c.status, c.priority into prior_status, prior_priority
  from public.complaint_cases c where c.id = target_complaint_id for update;
  if not found then
    raise exception 'Complaint not found';
  end if;

  update public.complaint_cases c
  set status = new_status,
      priority = new_priority,
      assigned_to = case when claim_for_self then (select auth.uid()) else c.assigned_to end,
      resolution = case when new_status in ('resolved', 'closed') then trim(staff_note) else null end,
      updated_at = now()
  where c.id = target_complaint_id;

  insert into public.complaint_events (complaint_id, actor_user_id, event_type, event_note, internal_only)
  values (target_complaint_id, (select auth.uid()), 'staff_update', trim(staff_note), true);
  insert into public.audit_events (area, actor_user_id, actor_role, action, entity_type, entity_id, details)
  values ('complaints', (select auth.uid()), 'support_agent', 'complaint_updated', 'complaint',
    target_complaint_id::text, jsonb_build_object(
      'previous_status', prior_status, 'status', new_status,
      'previous_priority', prior_priority, 'priority', new_priority,
      'claimed', claim_for_self
    ));
end;
$$;

revoke all on function public.admin_list_complaints() from public, anon;
revoke all on function public.admin_update_complaint(uuid, text, text, boolean, text) from public, anon;
grant execute on function public.admin_list_complaints() to authenticated;
grant execute on function public.admin_update_complaint(uuid, text, text, boolean, text) to authenticated;

create table public.financial_approval_requests (
  id uuid primary key default gen_random_uuid(),
  action_type text not null check (action_type in ('refund', 'payout_release', 'payment_adjustment')),
  target_reference text not null check (length(trim(target_reference)) between 1 and 200),
  amount_minor_units bigint not null check (amount_minor_units > 0),
  currency text not null default 'NGN' check (currency = 'NGN'),
  request_reason text not null check (length(trim(request_reason)) between 3 and 2000),
  requested_by uuid not null references public.profiles (id) on delete restrict,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles (id) on delete set null,
  review_reason text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  check (
    (status = 'pending' and reviewed_by is null and reviewed_at is null)
    or (status <> 'pending' and reviewed_by is not null and reviewed_at is not null)
  ),
  check (reviewed_by is null or reviewed_by <> requested_by),
  check (review_reason is null or length(review_reason) <= 2000)
);

create index financial_approval_queue_idx on public.financial_approval_requests (status, created_at desc);
alter table public.financial_approval_requests enable row level security;
revoke all on public.financial_approval_requests from public, anon, authenticated;
grant all on public.financial_approval_requests to service_role;

create or replace function public.admin_list_financial_approvals()
returns table (
  id uuid,
  action_type text,
  target_reference text,
  amount_minor_units bigint,
  request_reason text,
  requested_by uuid,
  requester_name text,
  status text,
  reviewed_by uuid,
  review_reason text,
  created_at timestamptz,
  reviewed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
begin
  if not public.staff_has_role('finance_reviewer') and not public.staff_has_role('finance_approver') then
    raise exception 'Finance role required' using errcode = '42501';
  end if;

  return query
  select f.id, f.action_type, f.target_reference, f.amount_minor_units, f.request_reason,
    f.requested_by, p.full_name, f.status, f.reviewed_by, f.review_reason, f.created_at, f.reviewed_at
  from public.financial_approval_requests f
  join public.profiles p on p.id = f.requested_by
  order by f.created_at desc;
end;
$$;

create or replace function public.admin_submit_financial_approval(
  request_action_type text,
  request_target_reference text,
  request_amount_minor_units bigint,
  request_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  request_id uuid;
begin
  if not public.staff_has_role('finance_reviewer') then
    raise exception 'Finance reviewer role required' using errcode = '42501';
  end if;
  if request_action_type not in ('refund', 'payout_release', 'payment_adjustment') then
    raise exception 'Unsupported financial action type';
  end if;
  if length(trim(coalesce(request_target_reference, ''))) not between 1 and 200
    or request_amount_minor_units <= 0
    or length(trim(coalesce(request_reason, ''))) not between 3 and 2000 then
    raise exception 'A reference, positive amount, and reason are required';
  end if;

  insert into public.financial_approval_requests (
    action_type, target_reference, amount_minor_units, request_reason, requested_by
  ) values (
    request_action_type, trim(request_target_reference), request_amount_minor_units,
    trim(request_reason), (select auth.uid())
  ) returning id into request_id;

  insert into public.audit_events (area, actor_user_id, actor_role, action, entity_type, entity_id, details)
  values ('finance', (select auth.uid()), 'finance_reviewer', 'financial_action_requested',
    'financial_approval', request_id::text, jsonb_build_object(
      'action_type', request_action_type, 'target_reference', trim(request_target_reference),
      'amount_minor_units', request_amount_minor_units
    ));
  return request_id;
end;
$$;

create or replace function public.admin_review_financial_approval(
  target_request_id uuid,
  decision text,
  decision_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  requester_id uuid;
begin
  if not public.staff_has_role('finance_approver') then
    raise exception 'Finance approver role required' using errcode = '42501';
  end if;
  if decision not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected';
  end if;
  if length(trim(coalesce(decision_reason, ''))) < 3 or length(decision_reason) > 2000 then
    raise exception 'An approval decision reason between 3 and 2000 characters is required';
  end if;

  select f.requested_by into requester_id
  from public.financial_approval_requests f
  where f.id = target_request_id and f.status = 'pending'
  for update;
  if not found then
    raise exception 'Pending financial approval request not found';
  end if;
  if requester_id = (select auth.uid()) then
    raise exception 'Requesters cannot approve their own financial actions';
  end if;

  update public.financial_approval_requests
  set status = decision, reviewed_by = (select auth.uid()),
      review_reason = trim(decision_reason), reviewed_at = now()
  where id = target_request_id;

  insert into public.audit_events (area, actor_user_id, actor_role, action, entity_type, entity_id, details)
  values ('finance', (select auth.uid()), 'finance_approver', 'financial_action_' || decision,
    'financial_approval', target_request_id::text, jsonb_build_object('reason', trim(decision_reason)));
end;
$$;

revoke all on function public.admin_list_financial_approvals() from public, anon;
revoke all on function public.admin_submit_financial_approval(text, text, bigint, text) from public, anon;
revoke all on function public.admin_review_financial_approval(uuid, text, text) from public, anon;
grant execute on function public.admin_list_financial_approvals() to authenticated;
grant execute on function public.admin_submit_financial_approval(text, text, bigint, text) to authenticated;
grant execute on function public.admin_review_financial_approval(uuid, text, text) to authenticated;
