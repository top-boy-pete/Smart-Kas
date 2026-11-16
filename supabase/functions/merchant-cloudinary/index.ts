import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const encoder = new TextEncoder();
const assetIdPattern = /^[0-9a-f-]{36}\/(product|identity|business)\/[0-9a-f-]{36}$/i;

function corsHeaders(origin: string | null) {
  const allowedOrigins = (Deno.env.get("CLOUDINARY_ALLOWED_ORIGINS") || "")
    .split(",")
    .map(value => value.trim())
    .filter(Boolean);
  if (origin && !allowedOrigins.includes(origin)) return null;
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function jsonResponse(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function requireCloudinaryConfig() {
  const cloudName = Deno.env.get("CLOUDINARY_CLOUD_NAME");
  const apiKey = Deno.env.get("CLOUDINARY_API_KEY");
  const apiSecret = Deno.env.get("CLOUDINARY_API_SECRET");
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary server credentials are not configured.");
  }
  return { cloudName, apiKey, apiSecret };
}

async function signCloudinaryParameters(parameters: Record<string, string>, apiSecret: string) {
  const canonical = Object.entries(parameters)
    .filter(([, value]) => value !== "")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  const digest = await crypto.subtle.digest("SHA-1", encoder.encode(`${canonical}${apiSecret}`));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

function isAssetForKind(publicId: string, userId: string, kind: string) {
  return assetIdPattern.test(publicId) && publicId.startsWith(`${userId}/${kind}/`);
}

Deno.serve(async request => {
  const origin = request.headers.get("Origin");
  const cors = corsHeaders(origin);
  if (!cors) return new Response("Origin is not allowed.", { status: 403 });
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405, cors);

  try {
    const authorization = request.headers.get("Authorization");
    const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return jsonResponse({ error: "Authentication is required." }, 401, cors);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !supabaseAnonKey) throw new Error("Supabase function environment is incomplete.");
    const client = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    });
    const { data: userData, error: authError } = await client.auth.getUser(token);
    if (authError || !userData.user) return jsonResponse({ error: "Your session is invalid or expired." }, 401, cors);

    const body = await request.json();
    const action = body?.action;
    const { cloudName, apiKey, apiSecret } = requireCloudinaryConfig();

    if (action === "sign-upload") {
      const kind = body?.kind;
      if (!["product", "identity", "business"].includes(kind)) {
        return jsonResponse({ error: "Unsupported merchant asset type." }, 400, cors);
      }
      const { data: authorized, error } = await client.rpc("merchant_cloudinary_can_upload", { asset_kind: kind });
      if (error) throw error;
      if (authorized !== true) return jsonResponse({ error: "This account cannot upload that merchant asset." }, 403, cors);

      const publicId = `${userData.user.id}/${kind}/${crypto.randomUUID()}`;
      const timestamp = Math.floor(Date.now() / 1000);
      const deliveryType = kind === "product" ? "upload" : "authenticated";
      const uploadPreset = kind === "product"
        ? Deno.env.get("CLOUDINARY_PRODUCT_UPLOAD_PRESET")
        : Deno.env.get("CLOUDINARY_DOCUMENT_UPLOAD_PRESET");
      if (!uploadPreset) throw new Error(`The Cloudinary ${kind} upload preset is not configured.`);

      const parameters = {
        overwrite: "false",
        public_id: publicId,
        timestamp: String(timestamp),
        type: deliveryType,
        upload_preset: uploadPreset,
      };
      return jsonResponse({
        apiKey,
        cloudName,
        deliveryType,
        publicId,
        signature: await signCloudinaryParameters(parameters, apiSecret),
        timestamp,
        uploadPreset,
      }, 200, cors);
    }

    if (action === "delete-asset") {
      const kind = body?.kind;
      const publicId = body?.publicId;
      if (!["product", "identity", "business"].includes(kind)
        || typeof publicId !== "string"
        || !isAssetForKind(publicId, userData.user.id, kind)) {
        return jsonResponse({ error: "Invalid merchant asset identifier." }, 400, cors);
      }
      const { data: authorized, error } = await client.rpc("merchant_cloudinary_can_delete", {
        asset_kind: kind,
        asset_public_id: publicId,
      });
      if (error) throw error;
      if (authorized !== true) return jsonResponse({ error: "This account cannot delete that merchant asset." }, 403, cors);

      const timestamp = Math.floor(Date.now() / 1000);
      const deliveryType = kind === "product" ? "upload" : "authenticated";
      const parameters = {
        invalidate: "true",
        public_id: publicId,
        timestamp: String(timestamp),
        type: deliveryType,
      };
      const form = new URLSearchParams({ ...parameters, api_key: apiKey, signature: await signCloudinaryParameters(parameters, apiSecret) });
      const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/destroy`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form,
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !["ok", "not found"].includes(result?.result)) {
        throw new Error(result?.error?.message || `Cloudinary asset deletion failed with status ${response.status}.`);
      }
      return jsonResponse({ deleted: true }, 200, cors);
    }

    if (action === "document-download") {
      const publicId = body?.publicId;
      const assetId = body?.assetId;
      if (typeof publicId !== "string" || typeof assetId !== "string"
        || !assetIdPattern.test(publicId)
        || !(publicId.includes("/identity/") || publicId.includes("/business/"))) {
        return jsonResponse({ error: "Invalid verification document reference." }, 400, cors);
      }
      const { data: authorized, error } = await client.rpc("merchant_cloudinary_can_view_document", {
        target_public_id: publicId,
        target_asset_id: assetId,
      });
      if (error) throw error;
      if (authorized !== true) return jsonResponse({ error: "You cannot access this verification document." }, 403, cors);

      const timestamp = Math.floor(Date.now() / 1000);
      const expiresAt = timestamp + 300;
      const parameters = {
        asset_id: assetId,
        attachment: "true",
        expires_at: String(expiresAt),
        timestamp: String(timestamp),
      };
      const signature = await signCloudinaryParameters(parameters, apiSecret);
      const query = new URLSearchParams({ ...parameters, api_key: apiKey, signature });
      return jsonResponse({
        url: `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/asset/download?${query.toString()}`,
      }, 200, cors);
    }

    return jsonResponse({ error: "Unsupported Cloudinary action." }, 400, cors);
  } catch (error) {
    console.error("Merchant Cloudinary operation failed:", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Cloudinary operation failed." }, 500, cors);
  }
});
