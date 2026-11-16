import { supabase } from "./supabase.js";

function requireSupabase() {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

export async function loadMerchantOrders() {
  const { data, error } = await requireSupabase().rpc("merchant_list_own_orders");
  if (error) throw error;
  return data.map(order => ({
    id: order.suborder_id,
    reference: order.public_reference,
    status: order.status,
    subtotal: Number(order.subtotal_minor_units) / 100,
    deliveryFee: Number(order.delivery_fee_minor_units) / 100,
    createdAt: order.created_at,
    acceptedAt: order.accepted_at,
    area: order.delivery_area || "",
    landmark: order.delivery_landmark || "",
    items: (order.line_items || []).map(item => ({
      name: item.name,
      quantity: item.quantity_requested,
      acceptedQuantity: item.quantity_accepted,
      price: Number(item.unit_price_minor_units) / 100,
    })),
    shipmentStatus: order.shipment_status,
    handoffNote: order.merchant_handoff_note || "",
  }));
}

export async function updateMerchantOrderStatus(orderId, status, handoffNote = "") {
  const { error } = await requireSupabase().rpc("merchant_update_order_status", {
    target_suborder_id: orderId,
    requested_status: status,
    handoff_note: handoffNote.trim() || null,
  });
  if (error) throw error;
}

export async function loadMerchantPayouts() {
  const { data, error } = await requireSupabase().rpc("merchant_list_own_payouts");
  if (error) throw error;
  return data.map(payout => ({
    id: payout.payout_id,
    amount: Number(payout.amount_minor_units) / 100,
    status: payout.status,
    reference: payout.payout_reference || "",
    periodStart: payout.period_start,
    periodEnd: payout.period_end,
    failureReason: payout.failure_reason || "",
    createdAt: payout.created_at,
    paidAt: payout.paid_at,
  }));
}
