import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft, ChevronRight, Download, FileText, Plus, Printer, Receipt,
  RefreshCw, TrendingUp, X,
} from "lucide-react";
import { formatNaira } from "./data.js";
import {
  addMerchantBusinessActivity, addMerchantExpense, buildFinancialStatementCsv,
  getFinancialDateRange, getNigeriaDateKey, loadMerchantFinancialActivity,
  loadMerchantFinancialOrderItems, merchantExpenseCategories, summarizeFinancialActivity,
} from "./lib/merchant-finances.js";

const periods = [
  { id: "daily", label: "Today" },
  { id: "weekly", label: "This week" },
  { id: "monthly", label: "This month" },
];
const activityTypes = [
  { value: "expense", label: "Operating expense" },
  { value: "supplier_payment", label: "Supplier payment" },
  { value: "other_income", label: "Other income" },
  { value: "other_expense", label: "Other expense" },
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

export default function MerchantFinancialDashboard({ demoMode, accountName }) {
  const [period, setPeriod] = useState("daily");
  const [periodOffset, setPeriodOffset] = useState(0);
  const [activities, setActivities] = useState(() => demoMode ? demoActivities(new Date()) : []);
  const [loading, setLoading] = useState(!demoMode);
  const [error, setError] = useState("");
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [expenseFormOpen, setExpenseFormOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    type: "expense", category: "stock", description: "", amount: "",
    date: getNigeriaDateKey(), counterparty: "", reference: "",
  });
  const [expenseBusy, setExpenseBusy] = useState(false);
  const [expenseError, setExpenseError] = useState("");
  const [notice, setNotice] = useState("");
  const [documentToShow, setDocumentToShow] = useState(null);
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

  async function submitLedgerActivity(event) {
    event.preventDefault();
    setExpenseBusy(true);
    setExpenseError("");
    setNotice("");
    try {
      const categoryLabel = merchantExpenseCategories.find(item => item.value === expenseForm.category)?.label;
      const description = expenseForm.description.trim();
      const enteredAmount = Number(expenseForm.amount);
      const amountMinorUnits = Math.round(enteredAmount * 100);
      if (!Number.isSafeInteger(amountMinorUnits) || amountMinorUnits <= 0 || amountMinorUnits > 1000000000000) {
        throw new Error("Enter an amount greater than zero.");
      }
      if (Math.abs(enteredAmount * 100 - amountMinorUnits) > 0.000001) {
        throw new Error("Enter an amount with no more than two decimal places.");
      }
      if (demoMode) {
        const amount = amountMinorUnits / 100;
        const activityTypeLabel = activityTypes.find(item => item.value === expenseForm.type)?.label;
        const counterparty = expenseForm.counterparty.trim();
        const activity = {
          id: `demo-${expenseForm.type}-${Date.now()}`,
          type: expenseForm.type,
          date: expenseForm.date,
          occurredAt: `${expenseForm.date}T12:00:00+01:00`,
          reference: expenseForm.reference.trim(),
          description: expenseForm.type === "expense"
            ? `${categoryLabel}: ${description}`
            : `${activityTypeLabel}: ${counterparty ? `${counterparty} · ` : ""}${description}`,
          amount: expenseForm.type === "other_income" ? amount : -amount,
          status: "recorded",
        };
        setActivities(current => [activity, ...current]);
      } else if (expenseForm.type === "expense") {
        await addMerchantExpense({ ...expenseForm, description });
        setRefreshVersion(current => current + 1);
      } else {
        await addMerchantBusinessActivity({
          ...expenseForm,
          description,
        });
        setRefreshVersion(current => current + 1);
      }
      setExpenseForm(current => ({
        ...current, description: "", amount: "", counterparty: "", reference: "",
      }));
      setExpenseFormOpen(false);
      const inSelectedPeriod = expenseForm.date >= range.startDate && expenseForm.date <= range.endDate;
      setNotice(demoMode
        ? "Preview ledger entry added for this session only."
        : inSelectedPeriod
          ? "Ledger entry recorded. Your financial summary is refreshing."
          : "Ledger entry recorded. Choose a period that includes its date to see it in this report.");
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
  const isExpenseEntry = expenseForm.type === "expense";

  return <>
    <div className="merchant-financial-page">
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
      {demoMode && <p className="merchant-demo-note merchant-financial-demo-note">Preview figures are examples. Ledger entries added here are kept only for this session.</p>}
      {error && <p className="form-error merchant-workspace-error" role="alert">{error}</p>}
      {notice && <p className="merchant-financial-notice" role="status">{notice}</p>}
      <div className="merchant-financial-metrics">
        <FinancialStat label="Net sales revenue" value={loading ? "…" : formatNaira(summary.revenue)} detail="Paid order sales less successful refunds" />
        <FinancialStat label="Transactions" value={loading ? "…" : summary.transactionCount} detail={`Average gross order ${formatNaira(summary.averageTransaction)}`} />
        <FinancialStat label="Other income" value={loading ? "…" : formatNaira(summary.otherIncome)} detail="Business income entered for this period" />
        <FinancialStat label="Recorded costs" value={loading ? "…" : formatNaira(summary.expenseTotal)} detail="Expenses and supplier payments" />
        <FinancialStat label="Estimated profit" value={loading ? "…" : formatNaira(summary.estimatedProfit)} detail="Sales + other income less costs" />
        <FinancialStat label="Completed payouts" value={loading ? "…" : formatNaira(summary.payoutTotal)} detail="Cash received from recorded settlements" />
        <FinancialStat label="Estimated cash flow" value={loading ? "…" : formatNaira(summary.estimatedCashFlow)} detail="Payouts + other income less cash outflows" />
      </div>
      <p className="merchant-financial-caveat">Estimates use recorded marketplace activity and entries you add. Supplier payments and other expenses reduce costs; other income increases profit and cash flow. Do not record the same cost as both a supplier payment and an expense. Fees, taxes, and unrecorded transactions are not included.</p>
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
        <div><h2>Digital merchant ledger</h2><span className="subheading">Marketplace activity, supplier payments, expenses, and other entries</span></div>
        <button type="button" className="secondary-button merchant-add-expense-button" onClick={() => {
          setExpenseFormOpen(current => !current);
          setExpenseError("");
        }}><Plus size={14} /> Record activity</button>
      </div>
      {expenseFormOpen && <form className="merchant-expense-form" onSubmit={submitLedgerActivity}>
        <label className="form-field"><span>Activity type</span><select value={expenseForm.type} onChange={event => setExpenseForm(current => ({ ...current, type: event.target.value }))}>
          {activityTypes.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
        </select></label>
        {isExpenseEntry && <label className="form-field"><span>Expense category</span><select value={expenseForm.category} onChange={event => setExpenseForm(current => ({ ...current, category: event.target.value }))}>
          {merchantExpenseCategories.map(category => <option key={category.value} value={category.value}>{category.label}</option>)}
        </select></label>}
        {!isExpenseEntry && <label className="form-field"><span>{expenseForm.type === "supplier_payment" ? "Supplier name" : "Person or business (optional)"}</span><input value={expenseForm.counterparty} onChange={event => setExpenseForm(current => ({ ...current, counterparty: event.target.value }))} minLength={expenseForm.type === "supplier_payment" || expenseForm.counterparty ? "2" : undefined} maxLength="120" required={expenseForm.type === "supplier_payment"} placeholder={expenseForm.type === "supplier_payment" ? "Who received the payment?" : "Who was involved?"} /></label>}
        <label className="form-field"><span>Description</span><input value={expenseForm.description} onChange={event => setExpenseForm(current => ({ ...current, description: event.target.value }))} minLength="2" maxLength="160" placeholder={expenseForm.type === "supplier_payment" ? "e.g. Vegetables for resale" : "e.g. Market transport"} required /></label>
        <label className="form-field"><span>Amount (NGN)</span><input type="number" inputMode="decimal" min="0.01" max="10000000000" step="0.01" value={expenseForm.amount} onChange={event => setExpenseForm(current => ({ ...current, amount: event.target.value }))} required /></label>
        <label className="form-field"><span>Date</span><input type="date" value={expenseForm.date} max={getNigeriaDateKey()} onChange={event => setExpenseForm(current => ({ ...current, date: event.target.value }))} required /></label>
        {!isExpenseEntry && <label className="form-field"><span>Payment/reference number (optional)</span><input value={expenseForm.reference} onChange={event => setExpenseForm(current => ({ ...current, reference: event.target.value }))} maxLength="120" placeholder="Receipt or transfer reference" /></label>}
        {expenseForm.type === "supplier_payment" && <p className="merchant-expense-guidance">Supplier payments are recorded as costs and cash outflows. Do not enter the same purchase again as an expense.</p>}
        {expenseForm.type === "other_income" && <p className="merchant-expense-guidance">Other income is included in estimated profit and cash flow, but remains separate from marketplace sales.</p>}
        {expenseError && <p className="form-error merchant-expense-error" role="alert">{expenseError}</p>}
        <div className="merchant-expense-actions">
          <button type="button" className="secondary-button" onClick={() => setExpenseFormOpen(false)} disabled={expenseBusy}>Cancel</button>
          <button type="submit" className="primary-button" disabled={expenseBusy}>{expenseBusy ? "Saving…" : "Save ledger entry"}</button>
        </div>
      </form>}
      {loading ? <p className="merchant-empty">Loading financial activity…</p> : transactionRows.length === 0
        ? <p className="merchant-empty merchant-ledger-empty">No financial activity recorded for this period.</p>
        : <div className="inventory-wrap"><table className="inventory-table merchant-financial-table">
          <thead><tr><th>Date</th><th>Activity</th><th>Reference</th><th>Amount</th><th>Status</th><th>Documents</th></tr></thead>
          <tbody>{transactionRows.map(activity => <tr key={`${activity.type}-${activity.id}`}>
            <td>{displayDate(activity.date)}</td>
            <td>{activity.description}</td>
            <td>{activity.reference || "—"}</td>
            <td className={activity.amount < 0 ? "merchant-financial-negative" : "merchant-financial-positive"}>{formatNaira(activity.amount)}</td>
            <td><span className={`merchant-order-status status-${activity.status}`}>{activity.status.replace(/_/g, " ")}</span></td>
            <td><div className="merchant-ledger-document-actions">
              {activity.type === "sale"
                ? <>
                  <button type="button" onClick={() => setDocumentToShow({ activity, kind: "invoice" })}><FileText size={13} /> Invoice</button>
                  <button type="button" onClick={() => setDocumentToShow({ activity, kind: "receipt" })}><Receipt size={13} /> Receipt</button>
                </>
                : <button type="button" onClick={() => setDocumentToShow({
                  activity,
                  kind: ["payout", "supplier_payment"].includes(activity.type) ? "receipt" : "record",
                })}><FileText size={13} /> {["payout", "supplier_payment"].includes(activity.type) ? "Receipt" : "View record"}</button>}
            </div></td>
          </tr>)}</tbody>
        </table></div>}
    </section>
    </div>
    {documentToShow && <MerchantLedgerDocument
      activity={documentToShow.activity}
      kind={documentToShow.kind}
      merchantName={accountName}
      demoMode={demoMode}
      onClose={() => setDocumentToShow(null)}
    />}
  </>;
}

function MerchantLedgerDocument({ activity, kind, merchantName, demoMode, onClose }) {
  const [items, setItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(activity.type === "sale" && !demoMode);
  const [itemError, setItemError] = useState("");

  useEffect(() => {
    function onEscape(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [onClose]);

  useEffect(() => {
    if (activity.type !== "sale" || demoMode) return undefined;
    let active = true;
    setItems([]);
    setItemError("");
    setLoadingItems(true);
    loadMerchantFinancialOrderItems(activity.id)
      .then(rows => { if (active) setItems(rows); })
      .catch(error => { if (active) setItemError(`Could not load invoice items: ${error.message}`); })
      .finally(() => { if (active) setLoadingItems(false); });
    return () => { active = false; };
  }, [activity.id, activity.type, demoMode]);

  const date = new Intl.DateTimeFormat("en-NG", {
    timeZone: "UTC", dateStyle: "long",
  }).format(new Date(`${activity.date}T00:00:00.000Z`));
  const isSale = activity.type === "sale";
  const isRefund = activity.type === "refund";
  const title = kind === "invoice" ? "Sales invoice" : kind === "receipt" ? "Payment receipt" : isRefund ? "Refund record" : "Merchant ledger record";
  const reference = activity.reference || `LEDGER-${activity.id.slice(0, 8).toUpperCase()}`;
  const displayItems = isSale && items.length
    ? items
    : [{ name: isSale ? "Marketplace order summary" : activity.description, quantity: 1, unitPrice: Math.abs(activity.amount), total: Math.abs(activity.amount) }];
  const recordNote = isSale
    ? kind === "invoice"
      ? "Invoice summary for the recorded marketplace order. The order reference identifies the source transaction."
      : "Payment was recorded as captured by the Kasua marketplace. This receipt reflects the ledger entry."
    : activity.type === "supplier_payment"
      ? "Merchant-entered supplier payment record. Keep the supplier's original receipt or transfer confirmation."
      : activity.type === "payout"
        ? "Payout marked paid in the Kasua settlement ledger."
        : "Merchant-entered ledger record. This document is not independent proof of payment.";

  return <div className="modal-backdrop merchant-document-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="modal merchant-document-dialog" role="dialog" aria-modal="true" aria-label={title}>
      <header className="modal-header"><h2>{title}</h2><button className="icon-button" type="button" aria-label="Close document" onClick={onClose}><X size={18} /></button></header>
      <div className="merchant-document-page">
        <div className="merchant-document-brand"><strong>KASUA</strong><span>Merchant business record</span></div>
        <div className="merchant-document-title"><div><span>{kind === "invoice" ? "INVOICE" : isRefund ? "REFUND RECORD" : "RECEIPT"}</span><h2>{title}</h2></div><strong>{kind === "invoice" ? "INVOICE" : isRefund ? "REFUND" : "RECEIPT"}</strong></div>
        <div className="merchant-document-details">
          <div><span>Merchant</span><strong>{merchantName}</strong></div>
          <div><span>Document reference</span><strong>{reference}</strong></div>
          <div><span>Transaction date</span><strong>{date}</strong></div>
          <div><span>Transaction status</span><strong>{activity.status.replace(/_/g, " ")}</strong></div>
        </div>
        {loadingItems && <p className="merchant-document-loading">Loading marketplace order details…</p>}
        {itemError && <p className="form-error" role="alert">{itemError}</p>}
        <div className="inventory-wrap"><table className="merchant-document-items">
          <thead><tr><th>Description</th><th>Quantity</th><th>Unit amount</th><th>Total</th></tr></thead>
          <tbody>{displayItems.map((item, index) => <tr key={`${item.name}-${index}`}>
            <td>{item.name}</td><td>{item.quantity}</td><td>{formatNaira(item.unitPrice)}</td><td>{formatNaira(item.total)}</td>
          </tr>)}</tbody>
        </table></div>
        <div className="merchant-document-total"><span>{isRefund ? "Refund amount" : kind === "invoice" ? "Amount due" : "Amount recorded"}</span><strong>{formatNaira(Math.abs(activity.amount))}</strong></div>
        <p className="merchant-document-note">{recordNote}</p>
        <footer className="merchant-document-footer"><span>Generated from the Kasua merchant ledger</span><span>{reference}</span></footer>
      </div>
      <div className="merchant-document-actions">
        {itemError && <span className="merchant-document-error">Resolve the item error before printing.</span>}
        <button type="button" className="secondary-button" onClick={onClose}>Close</button>
        <button type="button" className="primary-button" onClick={() => window.print()} disabled={loadingItems || Boolean(itemError)}><Printer size={14} /> Print / Save as PDF</button>
      </div>
    </section>
  </div>;
}
