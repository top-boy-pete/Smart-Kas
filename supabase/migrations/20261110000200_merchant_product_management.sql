insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'merchant-product-images',
  'merchant-product-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = true,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "merchant_product_images_upload_verified_owner"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'merchant-product-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.merchant_profiles m
    where m.user_id = (select auth.uid()) and m.verification_status = 'verified'
  )
);

create policy "merchant_product_images_delete_verified_owner"
on storage.objects for delete to authenticated
using (
  bucket_id = 'merchant-product-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.merchant_profiles m
    where m.user_id = (select auth.uid()) and m.verification_status = 'verified'
  )
);

create function public.merchant_list_own_products()
returns table (
  offer_id uuid,
  product_id uuid,
  name text,
  category_name text,
  description text,
  attributes jsonb,
  variant_attributes jsonb,
  condition text,
  image_path text,
  price_minor_units bigint,
  available_quantity integer,
  created_at timestamptz
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
  select o.id, p.id, p.name, c.name, p.description, p.attributes, p.variant_attributes,
    p.condition, p.attributes ->> 'image_path', o.price_minor_units, o.available_quantity, o.created_at
  from public.merchant_offers o
  join public.products p on p.id = o.product_id
  left join public.categories c on c.id = p.category_id
  where o.merchant_user_id = (select auth.uid())
  order by o.created_at desc;
end;
$$;

create function public.save_merchant_product(
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
  if product_image_path is not null and product_image_path not like merchant_id::text || '/%' then
    raise exception 'Product image must be in your account folder';
  end if;
  if product_image_path is not null and not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'merchant-product-images' and o.name = product_image_path
  ) then
    raise exception 'Product photo must be uploaded before saving the listing';
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
      selected_category_id,
      trim(product_name),
      trim(coalesce(product_description, '')),
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

revoke all on function public.merchant_list_own_products() from public, anon;
revoke all on function public.save_merchant_product(uuid, text, text, text, text, text, text, text, text, text, text, bigint, integer) from public, anon;
grant execute on function public.merchant_list_own_products() to authenticated;
grant execute on function public.save_merchant_product(uuid, text, text, text, text, text, text, text, text, text, text, bigint, integer) to authenticated;
