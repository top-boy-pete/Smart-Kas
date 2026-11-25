import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFinancialStatementCsv, getFinancialDateRange, summarizeFinancialActivity,
} from "./merchant-finance-utils.js";

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
