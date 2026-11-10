import { supabase } from "./supabase.js";
import { MERCHANT_DOCUMENT_BUCKET } from "./merchant-onboarding.js";

async function callAdminRpc(functionName, parameters = {}) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.rpc(functionName, parameters);
  if (error) throw error;
  return data;
}

export async function loadStaffRoles(userId) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase
    .from("staff_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw error;
  return data.map(item => item.role);
}

export async function loadMerchantApplications() {
  const rows = await callAdminRpc("admin_list_merchant_applications");
  return Promise.all(rows.map(async row => {
    const [identityDocumentUrl, businessDocumentUrl] = await Promise.all([
      createMerchantDocumentUrl(row.identity_document_path),
      createMerchantDocumentUrl(row.business_document_path),
    ]);
    return { ...row, identity_document_url: identityDocumentUrl, business_document_url: businessDocumentUrl };
  }));
}

async function createMerchantDocumentUrl(path) {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from(MERCHANT_DOCUMENT_BUCKET)
    .createSignedUrl(path, 600, { download: true });
  if (error) throw error;
  return data.signedUrl;
}

export async function setMerchantReviewCheck(userId, checkKey, complete, notes = "") {
  return callAdminRpc("admin_set_merchant_review_check", {
    target_user_id: userId,
    target_check_key: checkKey,
    completed: complete,
    reviewer_note: notes,
  });
}

export async function reviewMerchantApplication(userId, decision, reason = "") {
  return callAdminRpc("admin_review_merchant_application", {
    target_user_id: userId,
    decision,
    decision_reason: reason,
  });
}

export async function loadComplaints() {
  return callAdminRpc("admin_list_complaints");
}

export async function updateComplaint(id, status, priority, claimForSelf, note) {
  return callAdminRpc("admin_update_complaint", {
    target_complaint_id: id,
    new_status: status,
    new_priority: priority,
    claim_for_self: claimForSelf,
    staff_note: note,
  });
}

export async function loadFinancialApprovals() {
  return callAdminRpc("admin_list_financial_approvals");
}

export async function submitFinancialApproval(actionType, reference, amountMinorUnits, reason) {
  return callAdminRpc("admin_submit_financial_approval", {
    request_action_type: actionType,
    request_target_reference: reference,
    request_amount_minor_units: amountMinorUnits,
    request_reason: reason,
  });
}

export async function reviewFinancialApproval(id, decision, reason) {
  return callAdminRpc("admin_review_financial_approval", {
    target_request_id: id,
    decision,
    decision_reason: reason,
  });
}

export async function loadAuditEvents() {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase
    .from("audit_events")
    .select("id, area, actor_user_id, actor_role, action, entity_type, entity_id, details, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data;
}
