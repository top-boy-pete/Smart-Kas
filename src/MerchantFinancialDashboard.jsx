import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Plus, RefreshCw, TrendingUp } from "lucide-react";
import { formatNaira } from "./data.js";
import {
  addMerchantExpense, buildFinancialStatementCsv, getFinancialDateRange,
  getNigeriaDateKey, loadMerchantFinancialActivity, merchantExpenseCategories,
  summarizeFinancialActivity,
} from "./lib/merchant-finances.js";

const periods = [
  { id: "daily", label: "Today" },
  { id: "weekly", label: "This week" },
  { id: "monthly", label: "This month" },
];

function demoActivities(now) {
  const today = getNigeriaDateKey(now);
  const dateOffset = days => {
    const date = new Date(`${today}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  };
  const at = (date, hour) => `${date}T${String(hour).padStart(2, "0")}:15:00+01:00`;
  return [
    { id: "demo-sale-1", type: "sale", date: today, occurredAt: at(today, 9), reference: "KA-DEMO-241", description: "Paid order", amount: 48500, status: "delivered" },
    { id: "demo-sale-2", type: "sale", date: today, occurredAt: at(today, 12), reference: "KA-DEMO-238", description: "Paid order", amount: 27600, status: "preparing" },
    { id: "demo-payout-1", type: "payout", date: today, occurredAt: at(today, 13), reference: "DEMO-PAYOUT-031", description: "Completed payout", amount: 42000, status: "paid" },
    { id: "demo-expense-1", type: "expense", date: today, occurredAt: at(today, 8), reference: "", description: "Stock purchases: Morning stock", amount: -12500, status: "recorded" },
    { id: "demo-sale-3", type: "sale", date: dateOffset(-1), occurredAt: at(dateOffset(-1), 11), reference: "KA-DEMO-229", description: "Paid order", amount: 18300, status: "at_hub" },
    { id: "demo-refund-1", type: "refund", date: dateOffset(-1), occurredAt: at(dateOffset(-1), 14), reference: "KA-DEMO-229", description: "Successful refund", amount: -1800, status: "succeeded" },
    { id: "demo-expense-2", type: "expense", date: dateOffset(-2), occurredAt: at(dateOffset(-2), 7), reference: "", description: "Transportation: Market transport", amount: -3500, status: "recorded" },
    { id: "demo-sale-4", type: "sale", date: dateOffset(-4), occurredAt: at(dateOffset(-4), 10), reference: "KA-DEMO-217", description: "Paid order", amount: 31200, status: "delivered" },
    { id: "demo-payout-2", type: "payout", date: dateOffset(-4), occurredAt: at(dateOffset(-4), 15), reference: "DEMO-PAYOUT-028", description: "Completed payout", amount: 25000, status: "paid" },
  ];
}

function formatPeriodRange(range) {
  const date = value => new Intl.DateTimeFormat("en-NG", {
    timeZone: "UTC", day: "numeric", month: "short", year: "numeric",
  }).format(new Date(`${value}T00:00:00.000Z`));
  return range.startDate === range.endDate
    ? date(range.startDate)
    : `${date(range.startDate)} – ${date(range.endDate)}`;
}

function buildSalesBuckets(period, range, activities) {
  let buckets;
  if (period === "daily") {
    buckets = Array.from({ length: 8 }, (_, index) => ({
      key: String(index),
      label: `${index * 3 % 12 || 12}${index * 3 < 12 ? "a" : "p"}`,
      sales: 0,
    }));
    for (const activity of activities) {
      if (!["sale", "refund"].includes(activity.type) || !activity.occurredAt) continue;
      const hour = Number(new Intl.DateTimeFormat("en-GB", {
        timeZone: "Africa/Lagos", hour: "2-digit", hourCycle: "h23",
      }).format(new Date(activity.occurredAt)));
      const index = Math.floor(hour / 3);
      buckets[index].sales += activity.amount;
    }
    return buckets;
  }

  const count = Math.floor(
    (new Date(`${range.endDate}T00:00:00.000Z`) - new Date(`${range.startDate}T00:00:00.000Z`)) / 86400000,
  ) + 1;
  buckets = Array.from({ length: count }, (_, index) => {
    const date = new Date(`${range.startDate}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + index);
    const key = date.toISOString().slice(0, 10);
    return {
      key,
      label: new Intl.DateTimeFormat("en-NG", { timeZone: "UTC", day: "numeric", month: "short" }).format(date),
      sales: 0,
    };
  });
  const byDate = new Map(buckets.map(bucket => [bucket.key, bucket]));
  for (const activity of activities) {
    if (["sale", "refund"].includes(activity.type) && byDate.has(activity.date)) {
      byDate.get(activity.date).sales += activity.amount;
    }
  }
  return buckets;
}

function FinancialStat({ label, value, detail }) {
  return <div className="stat-card"><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>;
}

export default function MerchantFinancialDashboard({ demoMode }) {
  const [period, setPeriod] = useState("daily");
  const [periodOffset, setPeriodOffset] = useState(0);
  const [activities, setActivities] = useState(() => demoMode ? demoActivities(new Date()) : []);
  const [loading, setLoading] = useState(!demoMode);
  const [error, setError] = useState("");
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [expenseFormOpen, setExpenseFormOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    category: "stock", description: "", amount: "", date: getNigeriaDateKey(),
  });
  const [expenseBusy, setExpenseBusy] = useState(false);
  const [expenseError, setExpenseError] = useState("");
  const [notice, setNotice] = useState("");
  const range = useMemo(() => getFinancialDateRange(period, new Date(), periodOffset), [period, periodOffset]);

  useEffect(() => {
    if (demoMode) {
      setLoading(false);
      setError("");
      return undefined;
    }
    let active = true;
    setLoading(true);
    setError("");
    setActivities([]);
    loadMerchantFinancialActivity(range.startDate, range.endDate)
      .then(rows => { if (active) setActivities(rows); })
      .catch(loadError => { if (active) setError(`Could not load financial activity: ${loadError.message}`); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [demoMode, range.startDate, range.endDate, refreshVersion]);

  const periodActivities = useMemo(
    () => activities.filter(activity => activity.date >= range.startDate && activity.date <= range.endDate),
    [activities, range.startDate, range.endDate],
  );
  const summary = useMemo(() => summarizeFinancialActivity(periodActivities), [periodActivities]);
  const buckets = useMemo(
    () => buildSalesBuckets(period, range, periodActivities),
    [period, range, periodActivities],
  );
  const maxSales = Math.max(1, ...buckets.map(bucket => Math.max(0, bucket.sales)));

  function downloadStatement() {
    const csv = buildFinancialStatementCsv({ period, range, activities: periodActivities, summary });
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `kasua-financial-statement-${period}-${range.endDate}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function submitExpense(event) {
    event.preventDefault();
    setExpenseBusy(true);
    setExpenseError("");
    setNotice("");
    try {
      const categoryLabel = merchantExpenseCategories.find(item => item.value === expenseForm.category)?.label;
      const description = expenseForm.description.trim();
      const amountMinorUnits = Math.round(Number(expenseForm.amount) * 100);
      if (!Number.isSafeInteger(amountMinorUnits) || amountMinorUnits <= 0) {
        throw new Error("Enter an expense amount greater than zero.");
      }
      if (demoMode) {
        const amount = amountMinorUnits / 100;
        const activity = {
          id: `demo-expense-${Date.now()}`,
          type: "expense",
          date: expenseForm.date,
          occurredAt: `${expenseForm.date}T12:00:00+01:00`,
          reference: "",
          description: `${categoryLabel}: ${description}`,
          amount: -amount,
          status: "recorded",
        };
        setActivities(current => [activity, ...current]);
      } else {
        await addMerchantExpense({ ...expenseForm, description });
        setRefreshVersion(current => current + 1);
      }
      setExpenseForm(current => ({ ...current, description: "", amount: "" }));
      setExpenseFormOpen(false);
      const inSelectedPeriod = expenseForm.date >= range.startDate && expenseForm.date <= range.endDate;
      setNotice(demoMode
        ? "Preview expense added for this session only."
        : inSelectedPeriod
          ? "Expense recorded. Your financial summary is refreshing."
          : "Expense recorded. Choose a period that includes its date to see it in this report.");
    } catch (saveError) {
      setExpenseError(saveError.message || "Could not record this expense.");
    } finally {
      setExpenseBusy(false);
    }
  }

  const transactionRows = [...periodActivities].sort((a, b) => {
    const timeDifference = new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime();
    return timeDifference || b.id.localeCompare(a.id);
  });
  const displayDate = value => new Intl.DateTimeFormat("en-NG", {
    timeZone: "UTC", dateStyle: "medium",
  }).format(new Date(`${value}T00:00:00.000Z`));

  return <div className="merchant-financial-page">
    <section className="side-panel merchant-financial-panel">
      <div className="side-panel-header merchant-financial-header">
        <div><h2>Financial dashboard</h2><span className="subheading">Sales, recorded costs, payouts, and cash-flow estimates</span></div>
        <div className="merchant-financial-actions">
          <button type="button" className="secondary-button" onClick={() => setRefreshVersion(current => current + 1)} disabled={loading}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button type="button" className="primary-button" onClick={downloadStatement} disabled={loading}>
            <Download size={14} /> Download statement
          </button>
        </div>
      </div>
      <div className="merchant-financial-controls">
        <div className="merchant-period-picker" role="group" aria-label="Financial reporting period">
          {periods.map(option => <button
            type="button"
            key={option.id}
            className={period === option.id ? "active" : ""}
            aria-pressed={period === option.id}
            onClick={() => { setPeriod(option.id); setPeriodOffset(0); setNotice(""); }}
          >{option.label}</button>)}
        </div>
        <div className="merchant-financial-period-nav">
          <button type="button" aria-label="Previous period" title="Previous period" onClick={() => { setPeriodOffset(current => current - 1); setNotice(""); }}><ChevronLeft size={15} /></button>
          <span className="merchant-financial-date">{formatPeriodRange(range)}</span>
          <button type="button" aria-label="Next period" title="Next period" disabled={periodOffset === 0} onClick={() => { setPeriodOffset(current => Math.min(0, current + 1)); setNotice(""); }}><ChevronRight size={15} /></button>
        </div>
      </div>
      {demoMode && <p className="merchant-demo-note merchant-financial-demo-note">Preview figures are examples. Expenses added here are kept only for this session.</p>}
      {error && <p className="form-error merchant-workspace-error" role="alert">{error}</p>}
      {notice && <p className="merchant-financial-notice" role="status">{notice}</p>}
      <div className="merchant-financial-metrics">
        <FinancialStat label="Net sales revenue" value={loading ? "…" : formatNaira(summary.revenue)} detail="Paid order sales less successful refunds" />
        <FinancialStat label="Transactions" value={loading ? "…" : summary.transactionCount} detail={`Average gross order ${formatNaira(summary.averageTransaction)}`} />
        <FinancialStat label="Recorded expenses" value={loading ? "…" : formatNaira(summary.expenseTotal)} detail="Costs entered for this period" />
        <FinancialStat label="Estimated profit" value={loading ? "…" : formatNaira(summary.estimatedProfit)} detail="Revenue less recorded expenses" />
        <FinancialStat label="Completed payouts" value={loading ? "…" : formatNaira(summary.payoutTotal)} detail="Cash received from recorded settlements" />
        <FinancialStat label="Estimated cash flow" value={loading ? "…" : formatNaira(summary.estimatedCashFlow)} detail="Payouts less refunds and expenses" />
      </div>
      <p className="merchant-financial-caveat">Estimates use paid order values, successful refunds, completed payout records, and expenses you enter. Profit is not a full accounting profit: record stock purchases and other costs, and account separately for fees, taxes, and unrecorded transactions.</p>
    </section>

    <section className="side-panel merchant-financial-chart-panel">
      <div className="side-panel-header"><div><h2><TrendingUp size={15} /> Sales trend</h2><span className="subheading">Net sales by {period === "daily" ? "time of day" : "day"}</span></div></div>
      {loading ? <p className="merchant-empty">Loading sales activity…</p> : periodActivities.length === 0
        ? <p className="merchant-empty">Sales and transactions for this period will appear here.</p>
        : <div className={`merchant-sales-chart ${period === "monthly" ? "monthly" : ""}`} role="img" aria-label={`${period} sales trend`}>
          {buckets.map(bucket => <div className="merchant-sales-bar-column" key={bucket.key} title={`${bucket.label}: ${formatNaira(bucket.sales)}`}>
            <span className="merchant-sales-bar-value">{bucket.sales > 0 ? formatNaira(bucket.sales) : ""}</span>
            <div className="merchant-sales-bar-track"><span style={{ height: `${Math.max(0, bucket.sales) / maxSales * 100}%` }} /></div>
            <small>{bucket.label}</small>
          </div>)}
        </div>}
    </section>

    <section className="side-panel merchant-financial-ledger">
      <div className="side-panel-header">
        <div><h2>Transactions & expenses</h2><span className="subheading">Financial activity in the selected period</span></div>
        <button type="button" className="secondary-button merchant-add-expense-button" onClick={() => {
          setExpenseFormOpen(current => !current);
          setExpenseError("");
        }}><Plus size={14} /> Record expense</button>
      </div>
      {expenseFormOpen && <form className="merchant-expense-form" onSubmit={submitExpense}>
        <label className="form-field"><span>Expense category</span><select value={expenseForm.category} onChange={event => setExpenseForm(current => ({ ...current, category: event.target.value }))}>
          {merchantExpenseCategories.map(category => <option key={category.value} value={category.value}>{category.label}</option>)}
        </select></label>
        <label className="form-field"><span>Description</span><input value={expenseForm.description} onChange={event => setExpenseForm(current => ({ ...current, description: event.target.value }))} minLength="2" maxLength="160" placeholder="e.g. Morning stock purchase" required /></label>
        <label className="form-field"><span>Amount (NGN)</span><input type="number" inputMode="decimal" min="0.01" max="10000000000" step="0.01" value={expenseForm.amount} onChange={event => setExpenseForm(current => ({ ...current, amount: event.target.value }))} required /></label>
        <label className="form-field"><span>Date</span><input type="date" value={expenseForm.date} max={getNigeriaDateKey()} onChange={event => setExpenseForm(current => ({ ...current, date: event.target.value }))} required /></label>
        {expenseError && <p className="form-error merchant-expense-error" role="alert">{expenseError}</p>}
        <div className="merchant-expense-actions">
          <button type="button" className="secondary-button" onClick={() => setExpenseFormOpen(false)} disabled={expenseBusy}>Cancel</button>
          <button type="submit" className="primary-button" disabled={expenseBusy}>{expenseBusy ? "Saving…" : "Save expense"}</button>
        </div>
      </form>}
      {loading ? <p className="merchant-empty">Loading financial activity…</p> : transactionRows.length === 0
        ? <p className="merchant-empty merchant-ledger-empty">No financial activity recorded for this period.</p>
        : <div className="inventory-wrap"><table className="inventory-table merchant-financial-table">
          <thead><tr><th>Date</th><th>Activity</th><th>Reference</th><th>Amount</th><th>Status</th></tr></thead>
          <tbody>{transactionRows.map(activity => <tr key={`${activity.type}-${activity.id}`}>
            <td>{displayDate(activity.date)}</td>
            <td>{activity.description}</td>
            <td>{activity.reference || "—"}</td>
            <td className={activity.amount < 0 ? "merchant-financial-negative" : "merchant-financial-positive"}>{formatNaira(activity.amount)}</td>
            <td><span className={`merchant-order-status status-${activity.status}`}>{activity.status.replace(/_/g, " ")}</span></td>
          </tr>)}</tbody>
        </table></div>}
    </section>
  </div>;
}
