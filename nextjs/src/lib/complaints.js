import { supabase } from "./supabase.js";

export async function createComplaint(customerId, subject, description) {
  if (!supabase) throw new Error("Support is unavailable because Supabase is not configured.");
  const { data, error } = await supabase.from("complaint_cases").insert({
    customer_id: customerId,
    subject: subject.trim(),
    description: description.trim(),
  }).select("id, subject, status, created_at, updated_at").single();
  if (error) throw error;
  return data;
}

export async function loadCustomerComplaints(customerId) {
  if (!supabase) throw new Error("Support is unavailable because Supabase is not configured.");
  const { data, error } = await supabase
    .from("complaint_cases")
    .select("id, subject, status, created_at, updated_at")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}
