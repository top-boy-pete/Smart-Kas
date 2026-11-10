import { supabase } from "./supabase.js";

export const MERCHANT_PRODUCT_IMAGE_BUCKET = "merchant-product-images";
export const MERCHANT_PRODUCT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

const categorySlugs = {
  Produce: "produce",
  Grains: "grains",
  Pantry: "pantry",
  Protein: "protein",
  Household: "household",
};

function requireSupabase() {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

function normalizeCategory(name) {
  const value = (name || "").toLowerCase();
  if (value.includes("produce")) return "Produce";
  if (value.includes("grain") || value.includes("rice")) return "Grains";
  if (value.includes("pantry")) return "Pantry";
  if (value.includes("protein") || value.includes("fish") || value.includes("meat")) return "Protein";
  if (value.includes("household")) return "Household";
  return "Produce";
}

function parseMerchantProduct(row) {
  const attributes = row.attributes || {};
  const variant = row.variant_attributes || {};
  const imageUrl = row.image_path
    ? requireSupabase().storage.from(MERCHANT_PRODUCT_IMAGE_BUCKET).getPublicUrl(row.image_path).data.publicUrl
    : null;
  return {
    id: row.offer_id,
    productId: row.product_id,
    name: row.name,
    category: normalizeCategory(row.category_name),
    description: row.description || "",
    brand: attributes.brand || "",
    origin: attributes.origin || "",
    specifications: attributes.specifications || "",
    condition: row.condition || "new",
    size: variant.size || "",
    unit: variant.unit || "per item",
    price: Number(row.price_minor_units) / 100,
    stock: row.available_quantity,
    imagePath: row.image_path,
    imageUrl,
    checked: "Live listing",
    seller: "Your verified stall",
    rating: "New",
    note: "Verified trader",
  };
}

export async function loadMerchantProducts() {
  const client = requireSupabase();
  const { data, error } = await client.rpc("merchant_list_own_products");
  if (error) throw error;
  return data.map(parseMerchantProduct);
}

export async function saveMerchantProduct(userId, form, existingProduct) {
  const client = requireSupabase();
  const photo = form.photo;
  let uploadedPath = null;
  let saved = false;
  let cleanupWarning = "";
  try {
    if (photo) {
      validateMerchantProductPhoto(photo);
      uploadedPath = `${userId}/${crypto.randomUUID()}.${photo.type === "image/jpeg" ? "jpg" : photo.type === "image/png" ? "png" : "webp"}`;
      const { error } = await client.storage
        .from(MERCHANT_PRODUCT_IMAGE_BUCKET)
        .upload(uploadedPath, photo, { cacheControl: "3600", contentType: photo.type, upsert: false });
      if (error) throw error;
    }

    const categorySlug = categorySlugs[form.category];
    if (!categorySlug) throw new Error("Choose a valid product category.");
    const { error } = await client.rpc("save_merchant_product", {
      target_offer_id: existingProduct?.id || null,
      product_name: form.name.trim(),
      product_category_slug: categorySlug,
      product_description: form.description.trim(),
      product_brand: form.brand.trim(),
      product_size: form.size.trim(),
      product_origin: form.origin.trim(),
      product_specifications: form.specifications.trim(),
      product_condition: form.condition,
      product_unit: form.unit.trim(),
      product_image_path: uploadedPath || existingProduct?.imagePath || null,
      offer_price_minor_units: Math.round(Number(form.price) * 100),
      offer_available_quantity: Number(form.stock),
    });
    if (error) throw error;
    saved = true;

    if (uploadedPath && existingProduct?.imagePath) {
      const { error: cleanupError } = await client.storage
        .from(MERCHANT_PRODUCT_IMAGE_BUCKET)
        .remove([existingProduct.imagePath]);
      if (cleanupError) cleanupWarning = `Product saved, but old photo cleanup failed: ${cleanupError.message}`;
    }
  } catch (saveError) {
    if (uploadedPath && !saved) {
      const { error: cleanupError } = await client.storage
        .from(MERCHANT_PRODUCT_IMAGE_BUCKET)
        .remove([uploadedPath]);
      if (cleanupError) {
        throw new Error(`${saveError.message} Temporary photo cleanup also failed: ${cleanupError.message}`);
      }
    }
    throw saveError;
  }
  return cleanupWarning ? { warning: cleanupWarning } : null;
}

export function validateMerchantProductPhoto(photo) {
  if (!photo) return;
  if (!["image/jpeg", "image/png", "image/webp"].includes(photo.type)) {
    throw new Error("Product photos must be JPG, PNG, or WebP images.");
  }
  if (photo.size > MERCHANT_PRODUCT_IMAGE_MAX_BYTES) {
    throw new Error("Product photos must be 5 MB or smaller.");
  }
}
