export const merchantExpenseCategories = [
  { value: "stock", label: "Stock purchases" },
  { value: "transport", label: "Transportation" },
  { value: "rent", label: "Stall rent" },
  { value: "utilities", label: "Utilities" },
  { value: "packaging", label: "Packaging" },
  { value: "labour", label: "Labour" },
  { value: "other", label: "Other" },
];

export function getNigeriaDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function shiftDate(dateKey, days) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function getFinancialDateRange(period, now = new Date(), offset = 0) {
  const currentDate = getNigeriaDateKey(now);
  if (period === "daily") {
    const date = shiftDate(currentDate, offset);
    return { startDate: date, endDate: date };
  }
  if (period === "weekly") {
    const weekday = new Date(`${currentDate}T00:00:00.000Z`).getUTCDay();
    const startDate = shiftDate(currentDate, -((weekday + 6) % 7) + offset * 7);
    return {
      startDate,
      endDate: offset === 0 ? currentDate : shiftDate(startDate, 6),
    };
  }
  if (period === "monthly") {
    const firstOfCurrentMonth = new Date(`${currentDate.slice(0, 7)}-01T00:00:00.000Z`);
    firstOfCurrentMonth.setUTCMonth(firstOfCurrentMonth.getUTCMonth() + offset);
    const startDate = firstOfCurrentMonth.toISOString().slice(0, 10);
    return {
      startDate,
      endDate: offset === 0
        ? currentDate
        : shiftDate(new Date(Date.UTC(
          firstOfCurrentMonth.getUTCFullYear(),
          firstOfCurrentMonth.getUTCMonth() + 1,
          1,
        )).toISOString().slice(0, 10), -1),
    };
  }
  throw new Error("Choose a daily, weekly, or monthly reporting period.");
}

export function summarizeFinancialActivity(activities) {
  const sales = activities.filter(activity => activity.type === "sale");
  const refunds = activities.filter(activity => activity.type === "refund");
  const expenses = activities.filter(activity => activity.type === "expense");
  const payouts = activities.filter(activity => activity.type === "payout");
  const salesGross = sales.reduce((sum, activity) => sum + activity.amount, 0);
  const refunded = refunds.reduce((sum, activity) => sum + Math.abs(activity.amount), 0);
  const expenseTotal = expenses.reduce((sum, activity) => sum + Math.abs(activity.amount), 0);
  const payoutTotal = payouts.reduce((sum, activity) => sum + activity.amount, 0);
  const revenue = salesGross - refunded;

  return {
    salesGross,
    refunded,
    revenue,
    transactionCount: sales.length,
    averageTransaction: sales.length ? salesGross / sales.length : 0,
    expenseTotal,
    payoutTotal,
    estimatedProfit: revenue - expenseTotal,
    estimatedCashFlow: payoutTotal - refunded - expenseTotal,
  };
}

function csvCell(value) {
  const text = String(value ?? "");
  const isNumericValue = /^-?\d+(?:\.\d+)?$/.test(text);
  const spreadsheetSafe = typeof value === "string" && !isNumericValue && /^[\s]*[=+\-@]/.test(text)
    ? `'${text}`
    : text;
  return `"${spreadsheetSafe.replace(/"/g, '""')}"`;
}

export function buildFinancialStatementCsv({ period, range, activities, summary }) {
  const rows = [
    ["Kasua merchant financial statement"],
    ["Period", period],
    ["From", range.startDate],
    ["To", range.endDate],
    ["Net sales revenue (NGN)", summary.revenue.toFixed(2)],
    ["Transactions", summary.transactionCount],
    ["Recorded expenses (NGN)", summary.expenseTotal.toFixed(2)],
    ["Estimated profit (NGN)", summary.estimatedProfit.toFixed(2)],
    ["Completed payouts (NGN)", summary.payoutTotal.toFixed(2)],
    ["Estimated cash flow (NGN)", summary.estimatedCashFlow.toFixed(2)],
    [],
    ["Date", "Type", "Reference", "Description", "Amount (NGN)", "Status"],
    ...activities.map(activity => [
      activity.date,
      activity.type,
      activity.reference,
      activity.description,
      activity.amount.toFixed(2),
      activity.status,
    ]),
  ];
  return `\uFEFF${rows.map(row => row.map(csvCell).join(",")).join("\r\n")}`;
}
