import { starterProducts } from "../data.js";
import { supabase } from "./supabase.js";
import { getMerchantCloudinaryImageUrl, isMerchantCloudinaryPublicId } from "./cloudinary.js";

function normalizeCategory(name) {
  const value = (name || "").toLowerCase();
  if (value.includes("produce")) return "Produce";
  if (value.includes("grain") || value.includes("rice")) return "Grains";
  if (value.includes("pantry")) return "Pantry";
  if (value.includes("protein") || value.includes("fish") || value.includes("meat")) return "Protein";
  if (value.includes("household")) return "Household";
  return "All items";
}

function fallbackImage(category) {
  return starterProducts.find(product => product.category === category)?.image || starterProducts[0].image;
}

export async function loadPublicProducts() {
  if (!supabase) throw new Error("The live catalog requires a configured Supabase project.");
  const { data, error } = await supabase
    .from("products")
    .select(`
      id,
      name,
      description,
      attributes,
      variant_attributes,
      condition,
      categories(name),
      merchant_offers!inner(
        id,
        price_minor_units,
        available_quantity,
        authenticity_notes,
        merchant_profiles!inner(store_name)
      )
    `)
    .eq("status", "active")
    .eq("merchant_offers.is_active", true)
    .gt("merchant_offers.available_quantity", 0)
    .eq("merchant_offers.merchant_profiles.verification_status", "verified")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw error;

  return data.flatMap(product => {
    const category = normalizeCategory(product.categories?.name);
    const attributes = product.attributes || {};
    const variantAttributes = product.variant_attributes || {};
    return product.merchant_offers.map(offer => ({
      id: offer.id,
      productId: product.id,
      name: product.name,
      category,
      description: product.description || "",
      brand: attributes.brand || "",
      origin: attributes.origin || "",
      specifications: attributes.specifications || "",
      size: variantAttributes.size || "",
      condition: product.condition,
      price: offer.price_minor_units / 100,
      unit: variantAttributes.unit || attributes.unit || "per item",
      seller: offer.merchant_profiles.store_name,
      rating: null,
      note: offer.authenticity_notes || "Verified trader",
      imageUrl: isMerchantCloudinaryPublicId(attributes.image_path)
        ? getMerchantCloudinaryImageUrl(attributes.image_path)
        : (attributes.image_path
          ? supabase.storage.from("merchant-product-images").getPublicUrl(attributes.image_path).data.publicUrl
          : null),
      image: fallbackImage(category),
      stock: offer.available_quantity,
    }));
  });
}
