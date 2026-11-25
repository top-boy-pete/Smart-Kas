import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFinancialStatementCsv, getFinancialDateRange, summarizeFinancialActivity,
} from "./merchant-finance-utils.js";
import { normalizeCreditReadinessProfile } from "./merchant-credit-profile-utils.js";

test("financial reporting periods use the current Nigeria date and Monday week start", () => {
  const now = new Date("2026-11-25T10:00:00.000Z");
  assert.deepEqual(getFinancialDateRange("daily", now), {
    startDate: "2026-11-25",
    endDate: "2026-11-25",
  });
  assert.deepEqual(getFinancialDateRange("weekly", now), {
    startDate: "2026-11-23",
    endDate: "2026-11-25",
  });
  assert.deepEqual(getFinancialDateRange("monthly", now), {
    startDate: "2026-11-01",
    endDate: "2026-11-25",
  });
  assert.deepEqual(getFinancialDateRange("weekly", now, -1), {
    startDate: "2026-11-16",
    endDate: "2026-11-22",
  });
  assert.deepEqual(getFinancialDateRange("monthly", now, -1), {
    startDate: "2026-10-01",
    endDate: "2026-10-31",
  });
});

test("financial totals separate net sales, recorded expenses, payouts, and cash flow", () => {
  const summary = summarizeFinancialActivity([
    { type: "sale", amount: 100 },
    { type: "sale", amount: 50 },
    { type: "refund", amount: -10 },
    { type: "expense", amount: -20 },
    { type: "payout", amount: 30 },
  ]);
  assert.equal(summary.revenue, 140);
  assert.equal(summary.transactionCount, 2);
  assert.equal(summary.averageTransaction, 75);
  assert.equal(summary.expenseTotal, 20);
  assert.equal(summary.estimatedProfit, 120);
  assert.equal(summary.estimatedCashFlow, 0);
});

test("supplier payments and other income update costs and net estimates", () => {
  const summary = summarizeFinancialActivity([
    { type: "sale", amount: 100 },
    { type: "supplier_payment", amount: -20 },
    { type: "other_expense", amount: -5 },
    { type: "other_income", amount: 40 },
    { type: "payout", amount: 50 },
  ]);
  assert.equal(summary.expenseTotal, 25);
  assert.equal(summary.otherIncome, 40);
  assert.equal(summary.estimatedProfit, 115);
  assert.equal(summary.estimatedCashFlow, 65);
});

test("financial statement CSV includes period totals and protects user-entered formulas", () => {
  const summary = summarizeFinancialActivity([
    { type: "expense", amount: -10 },
  ]);
  const csv = buildFinancialStatementCsv({
    period: "daily",
    range: { startDate: "2026-11-25", endDate: "2026-11-25" },
    activities: [{
      type: "expense",
      date: "2026-11-25",
      reference: "",
      description: "=1+1",
      amount: -10,
      status: "recorded",
    }],
    summary,
  });
  assert.match(csv, /Estimated profit \(NGN\)/);
  assert.match(csv, /"'=1\+1"/);
  assert.match(csv, /"-10\.00"/);
});

test("credit profile normalizes aggregate minor units and monthly activity", () => {
  const profile = normalizeCreditReadinessProfile({
    period_start: "2026-06-01",
    period_end: "2026-11-25",
    months_in_period: 1,
    gross_sales_minor_units: "125050",
    refund_minor_units: "500",
    net_sales_minor_units: "124550",
    average_monthly_net_sales_minor_units: "124550",
    active_sales_months: 1,
    transaction_count: 4,
    unique_customers: 3,
    repeat_customers: 1,
    repeat_customer_rate: 33.3,
    delivered_orders: 3,
    in_progress_orders: 1,
    order_issues: 0,
    fulfillment_rate: 100,
    completed_payout_minor_units: "80000",
    recorded_cost_minor_units: "10000",
    other_income_minor_units: "0",
    monthly_history: [{
      month: "2026-11-01",
      gross_sales_minor_units: "125050",
      refund_minor_units: "500",
      transaction_count: 4,
      delivered_orders: 3,
      in_progress_orders: 1,
      order_issues: 0,
      payout_minor_units: "80000",
      cost_minor_units: "10000",
      other_income_minor_units: "0",
      cashflow_minor_units: "69500",
    }],
  });
  assert.equal(profile.grossSales, 1250.5);
  assert.equal(profile.netSales, 1245.5);
  assert.equal(profile.repeatCustomerRate, 33.3);
  assert.equal(profile.monthlyHistory[0].cashFlow, 695);
});

test("credit profile rejects incomplete history and unsafe monetary values", () => {
  assert.throws(() => normalizeCreditReadinessProfile({
    period_start: "2026-06-01",
    period_end: "2026-11-25",
    months_in_period: 1,
    monthly_history: [],
  }), /history does not match/);
  assert.throws(() => normalizeCreditReadinessProfile({
    period_start: "2026-06-01",
    period_end: "2026-11-25",
    months_in_period: 1,
    gross_sales_minor_units: "9007199254740992",
    monthly_history: [{}],
  }), /gross sales/);
});
