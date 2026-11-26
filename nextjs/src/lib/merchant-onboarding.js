import { supabase } from "./supabase.js";
import {
  deleteMerchantCloudinaryAsset, isMerchantCloudinaryPublicId,
  uploadMerchantCloudinaryAsset,
} from "./cloudinary.js";

export const MERCHANT_POLICY_VERSION = "merchant-draft-2026-11-10-v1";
export const MERCHANT_DOCUMENT_BUCKET = "merchant-verification";
export const MERCHANT_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

const documentExtensions = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
};

function validateDocument(file, label) {
  if (!file) throw new Error(`Select a ${label} document.`);
  if (!documentExtensions[file.type]) throw new Error(`${label} must be a PDF, JPG, or PNG file.`);
  if (file.size > MERCHANT_DOCUMENT_MAX_BYTES) throw new Error(`${label} must be 10 MB or smaller.`);
}

export function validateMerchantDocuments({ identityFile, businessFile }, required = true) {
  if (required || identityFile) validateDocument(identityFile, "identity");
  if (required || businessFile) validateDocument(businessFile, "business verification");
}

export async function uploadMerchantDocuments(documents) {
  if (!supabase) throw new Error("Secure merchant document storage is not configured.");
  validateMerchantDocuments(documents, false);

  const uploadedPaths = [];
  const result = {};
  const uploads = [
    ["identityFile", "identity", "identityDocumentPath", "identityDocumentAssetId"],
    ["businessFile", "business", "businessDocumentPath", "businessDocumentAssetId"],
  ];

  try {
    for (const [fileKey, folder, resultKey, assetIdKey] of uploads) {
      const file = documents[fileKey];
      if (!file) continue;
      const asset = await uploadMerchantCloudinaryAsset(file, folder);
      uploadedPaths.push(asset.publicId);
      result[resultKey] = asset.publicId;
      result[assetIdKey] = asset.assetId;
    }
  } catch (uploadError) {
    if (uploadedPaths.length) {
      try {
        await removeMerchantDocuments(uploadedPaths);
      } catch (cleanupError) {
        throw new Error(`${uploadError.message} Temporary document cleanup also failed: ${cleanupError.message}`);
      }
    }
    throw uploadError;
  }

  return result;
}

export async function removeMerchantDocuments(paths) {
  const existingPaths = paths.filter(Boolean);
  if (!existingPaths.length) return;
  if (!supabase) throw new Error("Secure merchant document storage is not configured.");
  for (const path of existingPaths) {
    if (isMerchantCloudinaryPublicId(path)) {
      const kind = path.includes("/identity/") ? "identity" : path.includes("/business/") ? "business" : null;
      if (!kind) throw new Error("Invalid Cloudinary verification document identifier.");
      await deleteMerchantCloudinaryAsset(path, kind);
    } else {
      const { error } = await supabase.storage.from(MERCHANT_DOCUMENT_BUCKET).remove([path]);
      if (error) throw error;
    }
  }
}
