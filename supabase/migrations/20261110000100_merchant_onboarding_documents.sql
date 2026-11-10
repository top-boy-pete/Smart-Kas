alter table public.merchant_profiles
  add column identity_document_type text,
  add column identity_document_path text,
  add column business_evidence_type text,
  add column business_document_path text,
  add column accepted_policy_version text,
  add column accepted_policy_at timestamptz;

create or replace function public.stamp_merchant_policy_acceptance()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.accepted_policy_version is not null then
    new.accepted_policy_at := pg_catalog.now();
  end if;
  return new;
end;
$$;

create trigger merchant_policy_acceptance_timestamp
before insert on public.merchant_profiles
for each row execute function public.stamp_merchant_policy_acceptance();

revoke all on function public.stamp_merchant_policy_acceptance() from public, anon, authenticated;

update public.merchant_profiles
set verification_status = 'needs_changes',
    review_feedback = 'Please submit identity and business evidence and accept the current merchant policies before review.'
where verification_status in ('pending', 'verified')
  and (
    identity_document_type is null
    or business_evidence_type is null
    or identity_document_path is null
    or business_document_path is null
    or accepted_policy_version is distinct from 'merchant-draft-2026-11-10-v1'
    or accepted_policy_at is null
  );

alter table public.merchant_profiles
  add constraint merchant_identity_document_type_valid
    check (identity_document_type is null or identity_document_type in (
      'national_id', 'passport', 'drivers_license', 'voters_card'
    )),
  add constraint merchant_business_evidence_type_valid
    check (business_evidence_type is null or business_evidence_type in (
      'market_permit', 'association_letter', 'stall_photo', 'business_registration'
    )),
  add constraint merchant_document_paths_match_owner
    check (
      (identity_document_path is null or identity_document_path like user_id::text || '/identity/%')
      and (business_document_path is null or business_document_path like user_id::text || '/business/%')
    ),
  add constraint merchant_pending_onboarding_complete
    check (
      verification_status <> 'pending'
      or (
        identity_document_type is not null
        and identity_document_path is not null
        and business_evidence_type is not null
        and business_document_path is not null
        and accepted_policy_version = 'merchant-draft-2026-11-10-v1'
        and accepted_policy_at is not null
      )
    );

create or replace function public.validate_merchant_documents_exist()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
begin
    if new.verification_status = 'pending' and (
      not exists (
        select 1 from storage.objects
        where bucket_id = 'merchant-verification'
          and name = new.identity_document_path
      )
      or not exists (
        select 1 from storage.objects
        where bucket_id = 'merchant-verification'
          and name = new.business_document_path
      )
    ) then
      raise exception 'Upload identity and business evidence before submitting for review';
    end if;
    return new;
end;
$$;

create trigger merchant_documents_must_exist
before insert or update of identity_document_path, business_document_path, verification_status
on public.merchant_profiles
for each row execute function public.validate_merchant_documents_exist();

revoke all on function public.validate_merchant_documents_exist() from public, anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'merchant-verification',
  'merchant-verification',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "merchant_verification_upload_own"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'merchant-verification'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (storage.foldername(name))[2] in ('identity', 'business')
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.account_type = 'merchant'
  )
);

create policy "merchant_verification_read_owner_or_reviewer"
on storage.objects for select to authenticated
using (
  bucket_id = 'merchant-verification'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or (
      public.staff_has_role('merchant_reviewer')
      and exists (
        select 1 from public.merchant_profiles m
        where m.identity_document_path = name or m.business_document_path = name
      )
    )
  )
);

create policy "merchant_verification_delete_owner"
on storage.objects for delete to authenticated
using (
  bucket_id = 'merchant-verification'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop function public.admin_list_merchant_applications();
create function public.admin_list_merchant_applications()
returns table (
  user_id uuid,
  full_name text,
  store_name text,
  market_name text,
  stall_number text,
  landmark text,
  verification_status text,
  submitted_at timestamptz,
  checks jsonb,
  identity_document_type text,
  identity_document_path text,
  business_evidence_type text,
  business_document_path text,
  accepted_policy_version text,
  accepted_policy_at timestamptz
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
    ),
    m.identity_document_type,
    m.identity_document_path,
    m.business_evidence_type,
    m.business_document_path,
    m.accepted_policy_version,
    m.accepted_policy_at
  from public.merchant_profiles m
  join public.profiles p on p.id = m.user_id
  left join public.merchant_review_checks c on c.application_user_id = m.user_id
  group by m.user_id, p.full_name, m.store_name, m.market_name, m.stall_number, m.landmark,
    m.verification_status, m.submitted_at, m.identity_document_type, m.identity_document_path,
    m.business_evidence_type, m.business_document_path, m.accepted_policy_version, m.accepted_policy_at
  order by m.submitted_at desc;
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
    select 1 from public.merchant_profiles m
    where m.user_id = target_user_id
      and (
        m.identity_document_type is null
        or m.identity_document_path is null
        or m.business_evidence_type is null
        or m.business_document_path is null
        or m.accepted_policy_version is null
        or m.accepted_policy_at is null
      )
  ) then
    raise exception 'Complete identity, business, and policy requirements before approval';
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

drop function public.resubmit_merchant_application(text, text, text, text);
create function public.resubmit_merchant_application(
  new_store_name text,
  new_market_name text,
  new_stall_number text,
  new_landmark text,
  new_identity_document_type text,
  new_identity_document_path text,
  new_business_evidence_type text,
  new_business_document_path text,
  new_accepted_policy_version text
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
  if (new_identity_document_type is null) <> (new_identity_document_path is null)
    or (new_business_evidence_type is null) <> (new_business_document_path is null) then
    raise exception 'Select both a document type and file when replacing verification evidence';
  end if;
  if new_identity_document_type is not null and new_identity_document_type not in (
    'national_id', 'passport', 'drivers_license', 'voters_card'
  ) then
    raise exception 'Unsupported identity document type';
  end if;
  if new_business_evidence_type is not null and new_business_evidence_type not in (
    'market_permit', 'association_letter', 'stall_photo', 'business_registration'
  ) then
    raise exception 'Unsupported business evidence type';
  end if;
  if new_identity_document_path is not null
    and new_identity_document_path not like applicant_id::text || '/identity/%' then
    raise exception 'Identity document must be stored in your private account folder';
  end if;
  if new_business_document_path is not null
    and new_business_document_path not like applicant_id::text || '/business/%' then
    raise exception 'Business document must be stored in your private account folder';
  end if;
  if new_accepted_policy_version is distinct from 'merchant-draft-2026-11-10-v1' then
    raise exception 'Review and accept the current merchant policies before resubmitting';
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
      identity_document_type = coalesce(new_identity_document_type, identity_document_type),
      identity_document_path = coalesce(new_identity_document_path, identity_document_path),
      business_evidence_type = coalesce(new_business_evidence_type, business_evidence_type),
      business_document_path = coalesce(new_business_document_path, business_document_path),
      accepted_policy_version = new_accepted_policy_version,
      accepted_policy_at = now(),
      verification_status = 'pending',
      submitted_at = now(),
      reviewed_at = null,
      reviewer_user_id = null,
      review_feedback = null
  where user_id = applicant_id;

  if exists (
    select 1 from public.merchant_profiles m
    where m.user_id = applicant_id
      and (
        m.identity_document_type is null
        or m.identity_document_path is null
        or m.business_evidence_type is null
        or m.business_document_path is null
      )
  ) then
    raise exception 'Upload identity and business verification documents before resubmitting';
  end if;

  update public.merchant_review_checks
  set is_complete = false,
      notes = '',
      updated_by = null,
      updated_at = now()
  where application_user_id = applicant_id;

  insert into public.audit_events (area, actor_user_id, actor_role, action, entity_type, entity_id, details)
  values ('merchant_review', applicant_id, 'merchant', 'application_resubmitted',
    'merchant_application', applicant_id::text,
    jsonb_build_object('policy_version', new_accepted_policy_version));
end;
$$;

revoke all on function public.admin_list_merchant_applications() from public, anon;
revoke all on function public.admin_review_merchant_application(uuid, text, text) from public, anon;
revoke all on function public.resubmit_merchant_application(text, text, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.admin_list_merchant_applications() to authenticated;
grant execute on function public.admin_review_merchant_application(uuid, text, text) to authenticated;
grant execute on function public.resubmit_merchant_application(text, text, text, text, text, text, text, text, text) to authenticated;
