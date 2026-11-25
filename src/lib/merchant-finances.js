import { supabase } from "./supabase.js";

export {
  buildFinancialStatementCsv, getFinancialDateRange, getNigeriaDateKey,
  merchantExpenseCategories, summarizeFinancialActivity,
} from "./merchant-finance-utils.js";

function requireSupabase() {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

export async function loadMerchantFinancialActivity(startDate, endDate) {
  const client = requireSupabase();
  const [marketplace, business] = await Promise.all([
    client.rpc("merchant_list_own_financial_activity", {
      target_start_date: startDate,
      target_end_date: endDate,
    }),
    client.rpc("merchant_list_own_business_activities", {
      target_start_date: startDate,
      target_end_date: endDate,
    }),
  ]);
  if (marketplace.error) throw marketplace.error;
  if (business.error) throw business.error;
  return [...marketplace.data, ...business.data].map(activity => ({
    id: activity.activity_id,
    type: activity.activity_type,
    date: activity.transaction_date,
    occurredAt: activity.occurred_at,
    reference: activity.reference || "",
    description: activity.description,
    amount: Number(activity.amount_minor_units) / 100,
    status: activity.status,
  })).sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt));
}

function amountToMinorUnits(amount) {
  const parsedAmount = Number(amount);
  const amountMinorUnits = Math.round(parsedAmount * 100);
  if (!Number.isSafeInteger(amountMinorUnits) || amountMinorUnits <= 0 || amountMinorUnits > 1000000000000) {
    throw new Error("Enter an amount greater than zero and within the supported limit.");
  }
  if (Math.abs(parsedAmount * 100 - amountMinorUnits) > 0.000001) {
    throw new Error("Enter an amount with no more than two decimal places.");
  }
  return amountMinorUnits;
}

export async function addMerchantExpense({ category, description, amount, date }) {
  const amountMinorUnits = amountToMinorUnits(amount);
  const { data, error } = await requireSupabase().rpc("merchant_add_own_expense", {
    expense_category: category,
    expense_description: description.trim(),
    expense_amount_minor_units: amountMinorUnits,
    expense_date: date,
  });
  if (error) throw error;
  return data;
}

export async function addMerchantBusinessActivity({
  type, description, amount, date, counterparty = "", reference = "",
}) {
  const amountMinorUnits = amountToMinorUnits(amount);
  const { data, error } = await requireSupabase().rpc("merchant_add_own_business_activity", {
    entry_type: type,
    entry_description: description.trim(),
    entry_amount_minor_units: amountMinorUnits,
    entry_date: date,
    entry_counterparty: counterparty.trim() || null,
    entry_reference: reference.trim() || null,
  });
  if (error) throw error;
  return data;
}

export async function loadMerchantFinancialOrderItems(suborderId) {
  const { data, error } = await requireSupabase().rpc("merchant_list_own_financial_order_items", {
    target_suborder_id: suborderId,
  });
  if (error) throw error;
  return data.map(item => ({
    name: item.product_name,
    quantity: Number(item.quantity),
    unitPrice: Number(item.unit_price_minor_units) / 100,
    total: Number(item.line_total_minor_units) / 100,
  }));
}
