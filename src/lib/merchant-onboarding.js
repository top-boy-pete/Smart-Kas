import { supabase } from "./supabase.js";

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

export async function uploadMerchantDocuments(userId, documents) {
  if (!supabase) throw new Error("Secure merchant document storage is not configured.");
  validateMerchantDocuments(documents, false);

  const uploadedPaths = [];
  const result = {};
  const uploads = [
    ["identityFile", "identity", "identityDocumentPath"],
    ["businessFile", "business", "businessDocumentPath"],
  ];

  try {
    for (const [fileKey, folder, resultKey] of uploads) {
      const file = documents[fileKey];
      if (!file) continue;
      const path = `${userId}/${folder}/${crypto.randomUUID()}.${documentExtensions[file.type]}`;
      const { error } = await supabase.storage
        .from(MERCHANT_DOCUMENT_BUCKET)
        .upload(path, file, { cacheControl: "0", contentType: file.type, upsert: false });
      if (error) throw error;
      uploadedPaths.push(path);
      result[resultKey] = path;
    }
  } catch (uploadError) {
    if (uploadedPaths.length) {
      const { error: cleanupError } = await supabase.storage.from(MERCHANT_DOCUMENT_BUCKET).remove(uploadedPaths);
      if (cleanupError) {
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
  const { error } = await supabase.storage.from(MERCHANT_DOCUMENT_BUCKET).remove(existingPaths);
  if (error) throw error;
}
