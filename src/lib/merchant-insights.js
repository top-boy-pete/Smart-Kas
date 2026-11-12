import { supabase } from "./supabase.js";

function requireSupabase() {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

export async function loadMerchantInsights() {
  const { data, error } = await requireSupabase().rpc("merchant_list_own_insights");
  if (error) throw error;
  return data.map(row => ({
    offerId: row.offer_id,
    productId: row.product_id,
    name: row.product_name,
    category: row.category_name || "Uncategorized",
    unit: row.product_unit,
    size: row.product_size,
    price: Number(row.current_price_minor_units) / 100,
    stock: row.available_quantity,
    units7d: Number(row.units_ordered_7d),
    units30d: Number(row.units_ordered_30d),
    orders30d: Number(row.orders_30d),
    gross30d: Number(row.gross_sales_minor_units_30d) / 100,
    comparisonCount: Number(row.comparison_count),
    comparisonMin: row.comparison_min_minor_units == null ? null : Number(row.comparison_min_minor_units) / 100,
    comparisonMedian: row.comparison_median_minor_units == null ? null : Number(row.comparison_median_minor_units) / 100,
    comparisonMax: row.comparison_max_minor_units == null ? null : Number(row.comparison_max_minor_units) / 100,
  }));
}

export async function loadMerchantQuestions() {
  const { data, error } = await requireSupabase().rpc("merchant_list_own_questions");
  if (error) throw error;
  return data.map(row => ({
    id: row.question_id,
    offerId: row.offer_id,
    productName: row.product_name,
    question: row.question,
    answer: row.answer || "",
    status: row.status,
    createdAt: row.created_at,
    answeredAt: row.answered_at,
  }));
}

export async function askMerchantQuestion(offerId, question) {
  const { error } = await requireSupabase().rpc("customer_ask_merchant_question", {
    target_offer_id: offerId,
    question_text: question.trim(),
  });
  if (error) throw error;
}

export async function answerMerchantQuestion(questionId, answer) {
  const { error } = await requireSupabase().rpc("merchant_answer_customer_question", {
    target_question_id: questionId,
    answer_text: answer.trim(),
  });
  if (error) throw error;
}

export async function loadCustomerMerchantQuestions() {
  const { data, error } = await requireSupabase().rpc("customer_list_own_merchant_questions");
  if (error) throw error;
  return data.map(row => ({
    id: row.question_id,
    productName: row.product_name,
    question: row.question,
    answer: row.answer || "",
    status: row.status,
    createdAt: row.created_at,
    answeredAt: row.answered_at,
  }));
}
