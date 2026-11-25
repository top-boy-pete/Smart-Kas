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
  const { data, error } = await requireSupabase().rpc("merchant_list_own_financial_activity", {
    target_start_date: startDate,
    target_end_date: endDate,
  });
  if (error) throw error;
  return data.map(activity => ({
    id: activity.activity_id,
    type: activity.activity_type,
    date: activity.transaction_date,
    occurredAt: activity.occurred_at,
    reference: activity.reference || "",
    description: activity.description,
    amount: Number(activity.amount_minor_units) / 100,
    status: activity.status,
  }));
}

export async function addMerchantExpense({ category, description, amount, date }) {
  const parsedAmount = Number(amount);
  const amountMinorUnits = Math.round(parsedAmount * 100);
  if (!Number.isSafeInteger(amountMinorUnits) || amountMinorUnits <= 0 || amountMinorUnits > 1000000000000) {
    throw new Error("Enter an expense amount greater than zero and within the supported limit.");
  }
  if (Math.abs(parsedAmount * 100 - amountMinorUnits) > 0.000001) {
    throw new Error("Enter an expense amount with no more than two decimal places.");
  }
  const { data, error } = await requireSupabase().rpc("merchant_add_own_expense", {
    expense_category: category,
    expense_description: description.trim(),
    expense_amount_minor_units: amountMinorUnits,
    expense_date: date,
  });
  if (error) throw error;
  return data;
}
