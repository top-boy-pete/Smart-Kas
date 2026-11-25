function integerValue(value, label) {
  if ((typeof value !== "string" && typeof value !== "number")
    || (typeof value === "string" && !/^-?\d+$/.test(value))) {
    throw new Error(`Invalid ${label} in credit-readiness profile.`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error(`Invalid ${label} in credit-readiness profile.`);
  return parsed;
}

function amountFromMinorUnits(value, label) {
  return integerValue(value, label) / 100;
}

function countValue(value, label) {
  const count = integerValue(value, label);
  if (count < 0) {
    throw new Error(`Invalid ${label} in credit-readiness profile.`);
  }
  return count;
}

function rateValue(value, label) {
  if (value === null || value === undefined) return null;
  const rate = Number(value);
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
    throw new Error(`Invalid ${label} in credit-readiness profile.`);
  }
  return rate;
}

export function normalizeCreditReadinessProfile(profile) {
  if (!profile || typeof profile !== "object" || !Array.isArray(profile.monthly_history)
    || !/^\d{4}-\d{2}-\d{2}$/.test(profile.period_start)
    || !/^\d{4}-\d{2}-\d{2}$/.test(profile.period_end)) {
    throw new Error("The credit-readiness profile response is incomplete.");
  }
  const monthsInPeriod = countValue(profile.months_in_period, "period length");
  if (profile.monthly_history.length !== monthsInPeriod) {
    throw new Error("The credit-readiness profile history does not match its reporting period.");
  }
  return {
    periodStart: profile.period_start,
    periodEnd: profile.period_end,
    monthsInPeriod,
    grossSales: amountFromMinorUnits(profile.gross_sales_minor_units, "gross sales"),
    refunds: amountFromMinorUnits(profile.refund_minor_units, "refund total"),
    netSales: amountFromMinorUnits(profile.net_sales_minor_units, "net sales"),
    averageMonthlyNetSales: amountFromMinorUnits(
      profile.average_monthly_net_sales_minor_units,
      "average monthly sales",
    ),
    activeSalesMonths: countValue(profile.active_sales_months, "active sales months"),
    transactionCount: countValue(profile.transaction_count, "transaction count"),
    uniqueCustomers: countValue(profile.unique_customers, "customer count"),
    repeatCustomers: countValue(profile.repeat_customers, "repeat customer count"),
    repeatCustomerRate: rateValue(profile.repeat_customer_rate, "repeat customer rate"),
    deliveredOrders: countValue(profile.delivered_orders, "delivered order count"),
    inProgressOrders: countValue(profile.in_progress_orders, "in-progress order count"),
    orderIssues: countValue(profile.order_issues, "order issue count"),
    fulfillmentRate: rateValue(profile.fulfillment_rate, "fulfilment rate"),
    completedPayouts: amountFromMinorUnits(profile.completed_payout_minor_units, "completed payouts"),
    recordedCosts: amountFromMinorUnits(profile.recorded_cost_minor_units, "recorded costs"),
    otherIncome: amountFromMinorUnits(profile.other_income_minor_units, "other income"),
    monthlyHistory: profile.monthly_history.map(month => ({
      month: month.month,
      grossSales: amountFromMinorUnits(month.gross_sales_minor_units, "monthly gross sales"),
      refunds: amountFromMinorUnits(month.refund_minor_units, "monthly refunds"),
      transactions: countValue(month.transaction_count, "monthly transaction count"),
      deliveredOrders: countValue(month.delivered_orders, "monthly delivered orders"),
      inProgressOrders: countValue(month.in_progress_orders, "monthly in-progress orders"),
      orderIssues: countValue(month.order_issues, "monthly order issues"),
      payouts: amountFromMinorUnits(month.payout_minor_units, "monthly payouts"),
      costs: amountFromMinorUnits(month.cost_minor_units, "monthly costs"),
      otherIncome: amountFromMinorUnits(month.other_income_minor_units, "monthly other income"),
      cashFlow: amountFromMinorUnits(month.cashflow_minor_units, "monthly cash flow"),
    })),
  };
}
