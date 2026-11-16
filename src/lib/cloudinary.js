import { supabase } from "./supabase.js";

export const MERCHANT_CLOUDINARY_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const MERCHANT_CLOUDINARY_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

const merchantAssetPattern = /^[0-9a-f-]{36}\/(product|identity|business)\/[0-9a-f-]{36}$/i;

function requireSupabase() {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

function validateFile(file, kind) {
  const isDocument = kind === "identity" || kind === "business";
  const allowedTypes = isDocument
    ? ["application/pdf", "image/jpeg", "image/png"]
    : ["image/jpeg", "image/png", "image/webp"];
  const maxBytes = isDocument ? MERCHANT_CLOUDINARY_DOCUMENT_MAX_BYTES : MERCHANT_CLOUDINARY_IMAGE_MAX_BYTES;
  if (!file || !allowedTypes.includes(file.type)) {
    throw new Error(isDocument
      ? "Verification documents must be PDF, JPG, or PNG files."
      : "Product photos must be JPG, PNG, or WebP images.");
  }
  if (file.size > maxBytes) {
    throw new Error(`This file must be ${isDocument ? "10 MB" : "5 MB"} or smaller.`);
  }
}

export function isMerchantCloudinaryPublicId(value) {
  return typeof value === "string" && merchantAssetPattern.test(value);
}

export function getMerchantCloudinaryImageUrl(publicId) {
  if (!isMerchantCloudinaryPublicId(publicId) || !publicId.includes("/product/")) return null;
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME?.trim();
  if (!cloudName || cloudName === "your_cloudinary_cloud_name") return null;
  return `https://res.cloudinary.com/${encodeURIComponent(cloudName)}/image/upload/${publicId}`;
}

export async function uploadMerchantCloudinaryAsset(file, kind) {
  validateFile(file, kind);
  const { data: signed, error: signingError } = await requireSupabase().functions.invoke("merchant-cloudinary", {
    body: { action: "sign-upload", kind },
  });
  if (signingError) throw signingError;
  if (!signed?.signature || !signed?.timestamp || !signed?.publicId || !signed?.apiKey || !signed?.cloudName) {
    throw new Error("Cloudinary upload signing returned an incomplete response.");
  }

  const form = new FormData();
  form.append("file", file);
  form.append("api_key", signed.apiKey);
  form.append("timestamp", String(signed.timestamp));
  form.append("signature", signed.signature);
  form.append("public_id", signed.publicId);
  form.append("overwrite", "false");
  form.append("type", signed.deliveryType);
  if (signed.uploadPreset) form.append("upload_preset", signed.uploadPreset);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(signed.cloudName)}/image/upload`, {
    method: "POST",
    body: form,
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(result?.error?.message || `Cloudinary upload failed with status ${response.status}.`);
  }
  if (result?.public_id !== signed.publicId || !result.asset_id || result.type !== signed.deliveryType) {
    throw new Error("Cloudinary returned an unexpected asset identity or delivery type.");
  }
  return {
    publicId: result.public_id,
    assetId: result.asset_id,
    secureUrl: result.secure_url,
  };
}

export async function deleteMerchantCloudinaryAsset(publicId, kind) {
  if (!isMerchantCloudinaryPublicId(publicId)) throw new Error("Invalid Cloudinary asset identifier.");
  const { data, error } = await requireSupabase().functions.invoke("merchant-cloudinary", {
    body: { action: "delete-asset", kind, publicId },
  });
  if (error) throw error;
  if (!data?.deleted) throw new Error("Cloudinary did not confirm asset deletion.");
}

export async function createMerchantDocumentDownloadUrl(publicId, assetId) {
  if (!isMerchantCloudinaryPublicId(publicId) || !assetId) {
    throw new Error("This verification document does not have a valid Cloudinary asset reference.");
  }
  const { data, error } = await requireSupabase().functions.invoke("merchant-cloudinary", {
    body: { action: "document-download", publicId, assetId },
  });
  if (error) throw error;
  if (!data?.url) throw new Error("Cloudinary did not return a signed document URL.");
  return data.url;
}
