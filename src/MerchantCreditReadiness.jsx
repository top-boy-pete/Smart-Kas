import { useEffect, useMemo, useState } from "react";
import { Download, FileText, Printer, RefreshCw, ShieldCheck, X } from "lucide-react";
import { formatNaira } from "./data.js";
import { getNigeriaDateKey, loadMerchantCreditReadinessProfile } from "./lib/merchant-finances.js";

function demoProfile(now) {
  const endDate = getNigeriaDateKey(now);
  const currentMonth = new Date(`${endDate.slice(0, 7)}-01T00:00:00.000Z`);
  const examples = [
    { sales: 980000, transactions: 34, delivered: 31, active: 2, issues: 1, payouts: 720000, costs: 185000, income: 12000 },
    { sales: 1140000, transactions: 39, delivered: 36, active: 2, issues: 1, payouts: 850000, costs: 214000, income: 0 },
    { sales: 1060000, transactions: 37, delivered: 34, active: 2, issues: 1, payouts: 790000, costs: 198000, income: 18000 },
    { sales: 1320000, transactions: 45, delivered: 42, active: 2, issues: 1, payouts: 1010000, costs: 244000, income: 0 },
    { sales: 1250000, transactions: 43, delivered: 40, active: 2, issues: 1, payouts: 930000, costs: 231000, income: 25000 },
    { sales: 1430000, transactions: 48, delivered: 45, active: 2, issues: 1, payouts: 1090000, costs: 272000, income: 15000 },
  ];
  const monthlyHistory = examples.map((month, index) => {
    const date = new Date(currentMonth);
    date.setUTCMonth(date.getUTCMonth() - (examples.length - index - 1));
    const monthKey = date.toISOString().slice(0, 10);
    const costs = month.costs;
    return {
      month: monthKey,
      grossSales: month.sales,
      refunds: 16000,
      transactions: month.transactions,
      deliveredOrders: month.delivered,
      inProgressOrders: month.active,
      orderIssues: month.issues,
      payouts: month.payouts,
      costs,
      otherIncome: month.income,
      cashFlow: month.payouts + month.income - costs - 16000,
    };
  });
  const grossSales = monthlyHistory.reduce((sum, month) => sum + month.grossSales, 0);
  const refunds = monthlyHistory.reduce((sum, month) => sum + month.refunds, 0);
  const completedPayouts = monthlyHistory.reduce((sum, month) => sum + month.payouts, 0);
  const recordedCosts = monthlyHistory.reduce((sum, month) => sum + month.costs, 0);
  const otherIncome = monthlyHistory.reduce((sum, month) => sum + month.otherIncome, 0);
  return {
    periodStart: monthlyHistory[0].month,
    periodEnd: endDate,
    monthsInPeriod: monthlyHistory.length,
    grossSales,
    refunds,
    netSales: grossSales - refunds,
    averageMonthlyNetSales: (grossSales - refunds) / monthlyHistory.length,
    activeSalesMonths: monthlyHistory.filter(month => month.grossSales > 0).length,
    transactionCount: monthlyHistory.reduce((sum, month) => sum + month.transactions, 0),
    uniqueCustomers: 89,
    repeatCustomers: 31,
    repeatCustomerRate: 34.8,
    deliveredOrders: 228,
    inProgressOrders: 12,
    orderIssues: 6,
    fulfillmentRate: 97.4,
    completedPayouts,
    recordedCosts,
    otherIncome,
    monthlyHistory,
  };
}

function formatMonth(month) {
  return new Intl.DateTimeFormat("en-NG", {
    timeZone: "UTC", month: "short", year: "numeric",
  }).format(new Date(`${month}T00:00:00.000Z`));
}

function formatDate(date) {
  return new Intl.DateTimeFormat("en-NG", {
    timeZone: "UTC", day: "numeric", month: "short", year: "numeric",
  }).format(new Date(`${date}T00:00:00.000Z`));
}

function ReadinessStat({ label, value, detail }) {
  return <div className="stat-card"><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>;
}

export default function MerchantCreditReadiness({ demoMode, accountName, onOpenFinancials }) {
  const [profile, setProfile] = useState(() => demoMode ? demoProfile(new Date()) : null);
  const [loading, setLoading] = useState(!demoMode);
  const [error, setError] = useState("");
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [consentOpen, setConsentOpen] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [printReady, setPrintReady] = useState(false);

  useEffect(() => {
    if (demoMode) {
      setLoading(false);
      setError("");
      return undefined;
    }
    let active = true;
    setLoading(true);
    setError("");
    setProfile(null);
    loadMerchantCreditReadinessProfile()
      .then(result => { if (active) setProfile(result); })
      .catch(loadError => { if (active) setError(`Could not load your credit-readiness profile: ${loadError.message}`); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [demoMode, refreshVersion]);

  const monthlyHistory = profile?.monthlyHistory || [];
  const maxSales = Math.max(1, ...monthlyHistory.map(month => month.grossSales));
  const periodLabel = profile
    ? `${formatDate(profile.periodStart)} – ${formatDate(profile.periodEnd)}`
    : "";
  const shareSummary = useMemo(() => profile ? [
    `${profile.monthsInPeriod}-month marketplace sales and transaction totals`,
    "Aggregate repeat-customer count (no customer identities)",
    "Recorded fulfilment outcomes and payout totals",
    "Merchant-entered operating cost and cash-flow estimates",
  ] : [], [profile]);

  useEffect(() => {
    if (!consentOpen) return undefined;
    function closeOnEscape(event) {
      if (event.key === "Escape") setConsentOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [consentOpen]);

  function prepareShareableProfile() {
    if (!consentChecked || !profile) return;
    setPrintReady(true);
    setConsentOpen(false);
    window.setTimeout(() => {
      window.print();
      setPrintReady(false);
      setConsentChecked(false);
    }, 100);
  }

  return <>
    <div className="merchant-credit-page">
      <section className="side-panel merchant-credit-header-panel">
        <div className="side-panel-header merchant-credit-heading">
          <div><h2><ShieldCheck size={16} /> Credit-readiness profile</h2><span className="subheading">A six-month view of verified marketplace activity</span></div>
          <div className="merchant-credit-actions">
            <button type="button" className="secondary-button" onClick={() => setRefreshVersion(current => current + 1)} disabled={loading}>
              <RefreshCw size={14} /> Refresh
            </button>
            <button type="button" className="primary-button" onClick={() => {
              setConsentChecked(false);
              setConsentOpen(true);
            }} disabled={loading || !profile}>
              <Download size={14} /> Prepare shareable profile
            </button>
          </div>
        </div>
        {demoMode && <p className="merchant-demo-note merchant-credit-demo-note">Preview only: these profile figures are examples and are not linked to a real merchant or lender.</p>}
        {error && <p className="form-error merchant-workspace-error" role="alert">{error}</p>}
        {loading && <p className="merchant-empty merchant-credit-loading">Building your profile from verified marketplace records…</p>}
        {profile && <>
          <div className="merchant-credit-period"><span>Profile period</span><strong>{periodLabel}</strong></div>
          <div className="merchant-credit-metrics">
            <ReadinessStat label="Sales consistency" value={`${profile.activeSalesMonths} / ${profile.monthsInPeriod} months`} detail={`${formatNaira(profile.averageMonthlyNetSales)} average net sales per month`} />
            <ReadinessStat label="Paid transactions" value={profile.transactionCount.toLocaleString("en-NG")} detail="Captured marketplace orders in the period" />
            <ReadinessStat label="Returning customers" value={`${profile.repeatCustomers} of ${profile.uniqueCustomers}`} detail={profile.repeatCustomerRate === null ? "No repeat-customer rate yet" : `${profile.repeatCustomerRate}% placed more than one paid order`} />
            <ReadinessStat label="Order fulfilment" value={profile.fulfillmentRate === null ? "Not available" : `${profile.fulfillmentRate}% delivered`} detail={`${profile.deliveredOrders} delivered · ${profile.inProgressOrders} in progress · ${profile.orderIssues} issues`} />
            <ReadinessStat label="Completed payouts" value={formatNaira(profile.completedPayouts)} detail="Recorded completed marketplace settlements" />
            <ReadinessStat label="Recorded costs" value={formatNaira(profile.recordedCosts)} detail="Merchant-entered expenses and supplier payments" />
          </div>
        </>}
      </section>

      {profile && <section className="side-panel merchant-credit-history-panel">
        <div className="side-panel-header"><div><h2>Six-month business activity</h2><span className="subheading">Monthly marketplace sales, fulfilment, payouts, and reported cash costs</span></div></div>
        <div className="merchant-credit-sales-chart" role="img" aria-label="Monthly gross marketplace sales for the last six months">
          {monthlyHistory.map(month => <div className="merchant-credit-sales-month" key={month.month} title={`${formatMonth(month.month)}: ${formatNaira(month.grossSales)}`}>
            <span>{formatNaira(month.grossSales)}</span>
            <div className="merchant-credit-sales-track"><i style={{ height: `${month.grossSales / maxSales * 100}%` }} /></div>
            <small>{formatMonth(month.month)}</small>
          </div>)}
        </div>
        <div className="inventory-wrap"><table className="inventory-table merchant-credit-history-table">
          <thead><tr><th>Month</th><th>Net sales</th><th>Transactions</th><th>Delivered</th><th>In progress</th><th>Issues</th><th>Payouts</th><th>Recorded costs</th><th>Est. cash flow</th></tr></thead>
          <tbody>{monthlyHistory.map(month => <tr key={month.month}>
            <td>{formatMonth(month.month)}</td>
            <td>{formatNaira(month.grossSales - month.refunds)}</td>
            <td>{month.transactions}</td>
            <td>{month.deliveredOrders}</td>
            <td>{month.inProgressOrders}</td>
            <td>{month.orderIssues}</td>
            <td>{formatNaira(month.payouts)}</td>
            <td>{formatNaira(month.costs)}</td>
            <td className={month.cashFlow < 0 ? "merchant-financial-negative" : "merchant-financial-positive"}>{formatNaira(month.cashFlow)}</td>
          </tr>)}</tbody>
        </table></div>
      </section>}

      <section className="side-panel merchant-credit-guidance">
        <div className="side-panel-header"><div><h2>What this profile means</h2><span className="subheading">Transparent signals, not a credit decision</span></div></div>
        <div className="merchant-credit-guidance-content">
          <p>Sales, customer counts, and fulfilment outcomes come from paid Kasua marketplace orders. Repeat-customer figures are aggregated; customer names and identities are never included. Payouts reflect completed settlement records.</p>
          <p>Costs and other business activities are entered by you, so they are not independently verified. Cash-flow estimates are not bank-statement data. This profile is not a credit score, lending recommendation, or guarantee of financing.</p>
          <p>Kasua does not currently send profiles to financial institutions. You choose whether to create and manually share a copy.</p>
          {onOpenFinancials && <button className="text-button" type="button" onClick={onOpenFinancials}>Review your financial ledger <FileText size={13} /></button>}
        </div>
      </section>
    </div>
    {consentOpen && profile && <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setConsentOpen(false); }}>
      <section className="modal merchant-credit-consent-dialog" role="dialog" aria-modal="true" aria-label="Share credit-readiness profile">
        <header className="modal-header"><h2>Prepare a shareable profile</h2><button className="icon-button" type="button" aria-label="Close consent dialog" onClick={() => setConsentOpen(false)}><X size={18} /></button></header>
        <div className="merchant-credit-consent-body">
          <p>This creates a print-ready report for you to save as PDF and share with a financial institution you choose. It includes:</p>
          <ul>{shareSummary.map(item => <li key={item}>{item}</li>)}</ul>
          <p className="merchant-credit-consent-limit">The report does not include customer identities or line-item histories. Costs are merchant-entered and may not be independently verified. Kasua will not transmit this report to a lender; you control the saved copy.</p>
          <label className="consent-row"><input type="checkbox" checked={consentChecked} onChange={event => setConsentChecked(event.target.checked)} /><span>I consent to creating this one-time profile export for sharing with an institution I choose. This does not authorize future automatic sharing.</span></label>
          <div className="merchant-credit-consent-actions">
            <button type="button" className="secondary-button" onClick={() => setConsentOpen(false)}>Cancel</button>
            <button type="button" className="primary-button" disabled={!consentChecked} onClick={prepareShareableProfile}><Printer size={14} /> Print / Save as PDF</button>
          </div>
        </div>
      </section>
    </div>}
    {printReady && profile && <CreditProfilePrintReport profile={profile} accountName={accountName} />}
  </>;
}

function CreditProfilePrintReport({ profile, accountName }) {
  return <article className="merchant-credit-print-page">
    <header className="merchant-credit-print-brand"><strong>KASUA</strong><span>Merchant credit-readiness profile</span></header>
    <h1>Merchant activity profile</h1>
    <p className="merchant-credit-print-period">{formatDate(profile.periodStart)} – {formatDate(profile.periodEnd)} · Prepared for {accountName}</p>
    <div className="merchant-credit-print-summary">
      <div><span>Net sales</span><strong>{formatNaira(profile.netSales)}</strong></div>
      <div><span>Paid transactions</span><strong>{profile.transactionCount}</strong></div>
      <div><span>Active sales months</span><strong>{profile.activeSalesMonths} / {profile.monthsInPeriod}</strong></div>
      <div><span>Returning customers</span><strong>{profile.repeatCustomers} of {profile.uniqueCustomers}</strong></div>
      <div><span>Delivered orders</span><strong>{profile.deliveredOrders}</strong></div>
      <div><span>Completed payouts</span><strong>{formatNaira(profile.completedPayouts)}</strong></div>
    </div>
    <div className="inventory-wrap"><table className="merchant-credit-print-table">
      <thead><tr><th>Month</th><th>Net sales</th><th>Transactions</th><th>Delivered</th><th>Issues</th><th>Payouts</th><th>Reported costs</th><th>Est. cash flow</th></tr></thead>
      <tbody>{profile.monthlyHistory.map(month => <tr key={month.month}>
        <td>{formatMonth(month.month)}</td><td>{formatNaira(month.grossSales - month.refunds)}</td><td>{month.transactions}</td>
        <td>{month.deliveredOrders}</td><td>{month.orderIssues}</td><td>{formatNaira(month.payouts)}</td>
        <td>{formatNaira(month.costs)}</td><td>{formatNaira(month.cashFlow)}</td>
      </tr>)}</tbody>
    </table></div>
    <p className="merchant-credit-print-note">Marketplace totals are derived from captured Kasua order records. Repeat customers are aggregated; no customer identities are included. Payouts are completed settlement records. Costs are merchant-entered and are not independently verified. This profile is not a credit score, lending recommendation, or guarantee of financing. Generated by Kasua; shared only at the merchant's discretion.</p>
  </article>;
}
