alter table public.merchant_profiles
  add column identity_document_asset_id text,
  add column business_document_asset_id text;

drop trigger if exists merchant_documents_must_exist on public.merchant_profiles;
drop function if exists public.validate_merchant_documents_exist();

create function public.validate_merchant_cloudinary_documents()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.verification_status = 'pending' and (
    (new.identity_document_path not like '%.%' and new.identity_document_asset_id is null)
    or (new.business_document_path not like '%.%' and new.business_document_asset_id is null)
  ) then
    raise exception 'Cloudinary asset references are required for new verification uploads';
  end if;
  return new;
end;
$$;

create trigger merchant_documents_require_cloudinary_assets
before insert or update of identity_document_path, identity_document_asset_id,
  business_document_path, business_document_asset_id, verification_status
on public.merchant_profiles
for each row execute function public.validate_merchant_cloudinary_documents();

revoke all on function public.validate_merchant_cloudinary_documents() from public, anon, authenticated;

create or replace function public.merchant_cloudinary_can_upload(asset_kind text)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select exists (
    select 1
    from public.profiles p
    left join public.merchant_profiles m on m.user_id = p.id
    where p.id = (select auth.uid())
      and p.account_type = 'merchant'
      and (
        (asset_kind = 'product' and m.verification_status = 'verified')
        or (
          asset_kind in ('identity', 'business')
          and (m.user_id is null or m.verification_status = 'needs_changes')
        )
      )
  );
$$;

create function public.merchant_cloudinary_can_delete(asset_kind text, asset_public_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select exists (
    select 1
    from public.profiles p
    left join public.merchant_profiles m on m.user_id = p.id
    where p.id = (select auth.uid())
      and p.account_type = 'merchant'
      and asset_public_id like p.id::text || '/' || asset_kind || '/%'
      and (
        (asset_kind = 'product' and m.verification_status = 'verified')
        or (asset_kind in ('identity', 'business') and m.user_id is not null)
        or (asset_kind in ('identity', 'business') and m.user_id is null)
      )
  );
$$;

create function public.merchant_cloudinary_can_view_document(
  target_public_id text,
  target_asset_id text
)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select exists (
    select 1
    from public.merchant_profiles m
    where (
      (m.identity_document_path = target_public_id and m.identity_document_asset_id = target_asset_id)
      or (m.business_document_path = target_public_id and m.business_document_asset_id = target_asset_id)
    )
      and (m.user_id = (select auth.uid()) or public.staff_has_role('merchant_reviewer'))
  );
$$;

revoke all on function public.merchant_cloudinary_can_upload(text) from public, anon;
revoke all on function public.merchant_cloudinary_can_delete(text, text) from public, anon;
revoke all on function public.merchant_cloudinary_can_view_document(text, text) from public, anon;
grant execute on function public.merchant_cloudinary_can_upload(text) to authenticated;
grant execute on function public.merchant_cloudinary_can_delete(text, text) to authenticated;
grant execute on function public.merchant_cloudinary_can_view_document(text, text) to authenticated;

drop function public.resubmit_merchant_application(text, text, text, text, text, text, text, text, text);
create function public.resubmit_merchant_application(
  new_store_name text,
  new_market_name text,
  new_stall_number text,
  new_landmark text,
  new_identity_document_type text,
  new_identity_document_path text,
  new_identity_document_asset_id text,
  new_business_evidence_type text,
  new_business_document_path text,
  new_business_document_asset_id text,
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
    or (new_identity_document_type is null) <> (new_identity_document_asset_id is null)
    or (new_business_evidence_type is null) <> (new_business_document_path is null)
    or (new_business_evidence_type is null) <> (new_business_document_asset_id is null) then
    raise exception 'Select a document type and upload when replacing verification evidence';
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
    and (new_identity_document_path not like applicant_id::text || '/identity/%'
      or new_identity_document_asset_id is null) then
    raise exception 'Identity document must be uploaded to your Cloudinary account folder';
  end if;
  if new_business_document_path is not null
    and (new_business_document_path not like applicant_id::text || '/business/%'
      or new_business_document_asset_id is null) then
    raise exception 'Business evidence must be uploaded to your Cloudinary account folder';
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
      identity_document_asset_id = coalesce(new_identity_document_asset_id, identity_document_asset_id),
      business_evidence_type = coalesce(new_business_evidence_type, business_evidence_type),
      business_document_path = coalesce(new_business_document_path, business_document_path),
      business_document_asset_id = coalesce(new_business_document_asset_id, business_document_asset_id),
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

revoke all on function public.resubmit_merchant_application(text, text, text, text, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.resubmit_merchant_application(text, text, text, text, text, text, text, text, text, text, text) to authenticated;

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
  identity_document_asset_id text,
  business_evidence_type text,
  business_document_path text,
  business_document_asset_id text,
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
    m.user_id, p.full_name, m.store_name, m.market_name, m.stall_number, m.landmark,
    m.verification_status, m.submitted_at,
    coalesce(
      jsonb_agg(jsonb_build_object('id', c.check_key, 'complete', c.is_complete, 'notes', c.notes)
        order by c.check_key) filter (where c.check_key is not null),
      '[]'::jsonb
    ),
    m.identity_document_type, m.identity_document_path, m.identity_document_asset_id,
    m.business_evidence_type, m.business_document_path, m.business_document_asset_id,
    m.accepted_policy_version, m.accepted_policy_at
  from public.merchant_profiles m
  join public.profiles p on p.id = m.user_id
  left join public.merchant_review_checks c on c.application_user_id = m.user_id
  group by m.user_id, p.full_name, m.store_name, m.market_name, m.stall_number, m.landmark,
    m.verification_status, m.submitted_at, m.identity_document_type, m.identity_document_path,
    m.identity_document_asset_id, m.business_evidence_type, m.business_document_path,
    m.business_document_asset_id, m.accepted_policy_version, m.accepted_policy_at
  order by m.submitted_at desc;
end;
$$;

revoke all on function public.admin_list_merchant_applications() from public, anon;
grant execute on function public.admin_list_merchant_applications() to authenticated;

create or replace function public.save_merchant_product(
  target_offer_id uuid,
  product_name text,
  product_category_slug text,
  product_description text,
  product_brand text,
  product_size text,
  product_origin text,
  product_specifications text,
  product_condition text,
  product_unit text,
  product_image_path text,
  offer_price_minor_units bigint,
  offer_available_quantity integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  merchant_id uuid := (select auth.uid());
  selected_category_id uuid;
  target_product_id uuid;
  current_product_id uuid;
  saved_offer_id uuid;
begin
  if merchant_id is null or not exists (
    select 1 from public.merchant_profiles m
    where m.user_id = merchant_id and m.verification_status = 'verified'
  ) then
    raise exception 'Verified merchant account required' using errcode = '42501';
  end if;
  if length(trim(coalesce(product_name, ''))) not between 2 and 120 then
    raise exception 'Product name must be between 2 and 120 characters';
  end if;
  if length(coalesce(product_description, '')) > 2000
    or length(coalesce(product_brand, '')) > 120
    or length(coalesce(product_size, '')) > 80
    or length(coalesce(product_origin, '')) > 120
    or length(coalesce(product_specifications, '')) > 1000
    or length(coalesce(product_unit, '')) not between 1 and 80 then
    raise exception 'Product details exceed the allowed length';
  end if;
  if product_condition not in ('new', 'used', 'refurbished', 'not_applicable') then
    raise exception 'Unsupported product condition';
  end if;
  if offer_price_minor_units not between 1 and 1000000000000 then
    raise exception 'Enter a valid product price';
  end if;
  if offer_available_quantity not between 0 and 1000000 then
    raise exception 'Stock must be between 0 and 1,000,000';
  end if;
  if product_image_path is not null
    and product_image_path not like merchant_id::text || '/%' then
    raise exception 'Product image must be stored in your account folder';
  end if;

  select c.id into selected_category_id
  from public.categories c
  where c.slug = product_category_slug and c.is_active;
  if selected_category_id is null then
    raise exception 'Choose an active product category';
  end if;

  if target_offer_id is null then
    insert into public.products (
      category_id, name, description, attributes, variant_attributes, condition, status
    )
    values (
      selected_category_id, trim(product_name), trim(coalesce(product_description, '')),
      jsonb_build_object(
        'brand', trim(coalesce(product_brand, '')),
        'origin', trim(coalesce(product_origin, '')),
        'specifications', trim(coalesce(product_specifications, '')),
        'image_path', product_image_path
      ),
      jsonb_build_object('size', trim(coalesce(product_size, '')), 'unit', trim(product_unit)),
      product_condition,
      case when offer_available_quantity > 0 then 'active' else 'draft' end
    )
    returning id into target_product_id;

    insert into public.merchant_offers (
      product_id, merchant_user_id, price_minor_units, available_quantity, is_active
    )
    values (
      target_product_id, merchant_id, offer_price_minor_units,
      offer_available_quantity, offer_available_quantity > 0
    )
    returning id into saved_offer_id;
    return saved_offer_id;
  end if;

  select o.product_id into current_product_id
  from public.merchant_offers o
  where o.id = target_offer_id and o.merchant_user_id = merchant_id
  for update;
  if current_product_id is null then
    raise exception 'Product listing not found';
  end if;
  if exists (
    select 1 from public.merchant_offers o
    where o.product_id = current_product_id
      and o.merchant_user_id <> merchant_id
  ) then
    raise exception 'This product is shared by other merchants and its details cannot be changed here';
  end if;

  update public.products
  set category_id = selected_category_id,
      name = trim(product_name),
      description = trim(coalesce(product_description, '')),
      attributes = jsonb_build_object(
        'brand', trim(coalesce(product_brand, '')),
        'origin', trim(coalesce(product_origin, '')),
        'specifications', trim(coalesce(product_specifications, '')),
        'image_path', product_image_path
      ),
      variant_attributes = jsonb_build_object(
        'size', trim(coalesce(product_size, '')),
        'unit', trim(product_unit)
      ),
      condition = product_condition,
      status = case when offer_available_quantity > 0 then 'active' else 'draft' end
  where id = current_product_id;

  update public.merchant_offers
  set price_minor_units = offer_price_minor_units,
      available_quantity = offer_available_quantity,
      is_active = offer_available_quantity > 0
  where id = target_offer_id and merchant_user_id = merchant_id;

  return target_offer_id;
end;
$$;

revoke all on function public.save_merchant_product(uuid, text, text, text, text, text, text, text, text, text, text, bigint, integer) from public, anon;
grant execute on function public.save_merchant_product(uuid, text, text, text, text, text, text, text, text, text, text, bigint, integer) to authenticated;
