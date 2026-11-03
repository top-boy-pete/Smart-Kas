import { supabase } from "./supabase.js";

async function callCartRpc(functionName, parameters = {}) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.rpc(functionName, parameters);
  if (error) throw error;
  return data;
}

export async function loadCustomerCart(userId) {
  return callCartRpc("load_customer_cart", { target_customer_id: userId });
}

export async function mergeGuestCart(userId, items) {
  return callCartRpc("merge_guest_cart", { target_customer_id: userId, guest_items: items });
}

export async function saveCustomerCart(userId, items) {
  return callCartRpc("save_customer_cart", { target_customer_id: userId, cart_items: items });
}
