import { useEffect, useMemo, useState } from "react";
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, BadgeCheck,
  Bell, Boxes, ChartNoAxesCombined, Check, CheckSquare, ChevronRight, CircleDollarSign,
  ClipboardCheck, ClipboardList, Clock3, FileText, FileWarning, LayoutDashboard, LogOut, MapPin, Menu,
  MessageSquareWarning, PackageCheck, Search, ShieldAlert, ShieldCheck, Store,
  Truck, Users, X,
} from "lucide-react";
import {
  loadAuditEvents, loadComplaints, loadFinancialApprovals, loadMerchantApplications,
  reviewFinancialApproval, reviewMerchantApplication, setMerchantReviewCheck,
  submitFinancialApproval, updateComplaint,
} from "./lib/admin.js";

const navItems = [
  { name: "Overview", icon: LayoutDashboard },
  { name: "Accounts", icon: Users },
  { name: "Merchant review", icon: BadgeCheck },
  { name: "Orders", icon: ClipboardList },
  { name: "Hub & logistics", icon: Truck },
  { name: "Complaints", icon: MessageSquareWarning },
  { name: "Catalog moderation", icon: Boxes },
  { name: "Finance & risk", icon: CircleDollarSign },
  { name: "Reports & audit", icon: ChartNoAxesCombined },
];

const accounts = [
  { id: "CU-1042", name: "Amina Yusuf", email: "amina@example.test", role: "Consumer", area: "Masaka North", status: "Active" },
  { id: "CU-1039", name: "Bala Ibrahim", email: "bala@example.test", role: "Consumer", area: "Masaka Central", status: "Active" },
  { id: "ME-0218", name: "Hauwa's Fresh Stall", email: "hauwa@example.test", role: "Merchant", area: "Main Market · Stall 18", status: "Pending review" },
  { id: "ME-0217", name: "Bala Grains & More", email: "bala.grains@example.test", role: "Merchant", area: "North Market · Stall 4", status: "Verified" },
  { id: "CU-1036", name: "Grace Musa", email: "grace@example.test", role: "Consumer", area: "Masaka South", status: "Restricted" },
];

const complaints = [
  { id: "CS-0441", topic: "Order arrived incomplete", order: "KA-2081", customer: "CU-1042", priority: "High", age: "18 min" },
  { id: "CS-0439", topic: "Delivery delay", order: "KA-2076", customer: "CU-1039", priority: "Normal", age: "42 min" },
  { id: "CS-0435", topic: "Product condition concern", order: "KA-2068", customer: "CU-1014", priority: "Review", age: "2 hr" },
];

const attentionItems = [
  { icon: AlertTriangle, tone: "warning", title: "Delivery delay reported", detail: "North route · 3 orders past expected window", time: "8 min ago" },
  { icon: Boxes, tone: "warning", title: "Hub quantity mismatch", detail: "Shipment SH-0831 · 2 lines need recount", time: "21 min ago" },
  { icon: ShieldAlert, tone: "critical", title: "Merchant review required", detail: "New application · Main Market, Stall 18", time: "36 min ago" },
  { icon: MessageSquareWarning, tone: "neutral", title: "Customer complaint opened", detail: "CS-0441 · Incomplete order KA-2081", time: "18 min ago" },
];

const orders = [
  { id: "KA-2084", customer: "CU-1048", merchants: "2", payment: "Pending", state: "Awaiting payment", area: "Masaka Central", updated: "3 min ago" },
  { id: "KA-2081", customer: "CU-1042", merchants: "4", payment: "Captured", state: "Partially fulfilled", area: "Masaka North", updated: "8 min ago" },
  { id: "KA-2078", customer: "CU-0988", merchants: "2", payment: "Captured", state: "At quality hub", area: "Masaka Central", updated: "16 min ago" },
  { id: "KA-2076", customer: "CU-1039", merchants: "3", payment: "Captured", state: "Delivery delayed", area: "Masaka North", updated: "42 min ago" },
  { id: "KA-2071", customer: "CU-0952", merchants: "1", payment: "Captured", state: "Delivered", area: "Masaka South", updated: "1 hr ago" },
];

const hubEvents = [
  { time: "12:42", event: "Inbound collection received", ref: "SH-0834", location: "Main Market handoff", state: "Received" },
  { time: "12:31", event: "Quantity mismatch flagged", ref: "SH-0831", location: "Masaka Hub · Bay 2", state: "Needs recount" },
  { time: "12:14", event: "Shipment verified", ref: "SH-0829", location: "Masaka Hub · Bay 1", state: "Passed" },
  { time: "11:58", event: "Rider handoff recorded", ref: "SH-0824", location: "North dispatch", state: "In transit" },
];

const products = [
  { id: "OF-7192", product: "Smoked catfish · medium", merchant: "Mama T's Fish", issue: "Authenticity documents requested", status: "Needs review" },
  { id: "OF-7188", product: "Local rice · 5kg", merchant: "Bala Grains & More", issue: "Possible duplicate candidate", status: "Flagged" },
  { id: "OF-7182", product: "Palm oil · 1 litre", merchant: "Musa's Provisions", issue: "Listing information incomplete", status: "Needs changes" },
];

const sectionRoles = {
  "Merchant review": ["merchant_reviewer"],
  Complaints: ["support_agent"],
  "Finance & risk": ["finance_reviewer", "finance_approver"],
  "Reports & audit": ["audit_viewer"],
};

const reviewCheckDetails = {
  identity: ["Identity and business ownership reviewed", "Review the applicant's identity and ownership evidence."],
  market: ["Market and stall details confirmed", "Confirm the market association and stall number."],
  location: ["Physical stall and location verified", "Confirm the stall location and handoff point."],
  policy: ["Merchant policies accepted", "Confirm pricing, product, and fulfillment policy acceptance."],
};

function displayDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function formatStatus(value) {
  const label = value.replaceAll("_", " ");
  return label[0].toUpperCase() + label.slice(1);
}

function StatusTag({ children, tone = "neutral" }) {
  return <span className={`admin-status ${tone}`}>{children}</span>;
}

function SectionHeading({ eyebrow, title, detail, action }) {
  return <div className="admin-section-heading"><div><span className="admin-eyebrow">{eyebrow}</span><h1>{title}</h1><p>{detail}</p></div>{action}</div>;
}

function Metric({ label, value, change, icon: MetricIcon, tone = "green" }) {
  return <article className="admin-metric"><div className={`admin-metric-icon ${tone}`}><MetricIcon size={17} /></div><span>{label}</span><strong>{value}</strong><small>{change}</small></article>;
}

function Table({ columns, rows, emptyMessage }) {
  return <div className="admin-table-wrap"><table className="admin-table"><thead><tr>{columns.map(column => <th key={column}>{column}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row, rowIndex) => <tr key={row.id || rowIndex}>{row.cells.map((cell, index) => <td key={`${row.id || rowIndex}-${index}`}>{cell}</td>)}</tr>) : <tr><td className="admin-empty" colSpan={columns.length}>{emptyMessage}</td></tr>}</tbody></table></div>;
}

function SearchField({ value, onChange, placeholder }) {
  return <label className="admin-search"><Search size={15} /><input value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} aria-label={placeholder} /></label>;
}

function Overview({ setSection, merchantTotal, pendingMerchantTotal, isDemo, complaintTotal, canViewAudit }) {
  if (!isDemo) return <>
    <SectionHeading eyebrow="Staff operations" title="Operations overview" detail="Live workload totals are scoped to your assigned staff permissions." action={canViewAudit && <button className="admin-quiet-button" type="button" onClick={() => setSection("Reports & audit")}><Activity size={15} /> View audit</button>} />
    <div className="admin-metrics">
      {merchantTotal !== null && <Metric label="Merchant applications" value={merchantTotal} change={`${pendingMerchantTotal} awaiting review`} icon={Store} tone="orange" />}
      {complaintTotal !== null && <Metric label="Complaint cases" value={complaintTotal} change={`${complaintTotal} in your support queue`} icon={MessageSquareWarning} tone="blue" />}
    </div>
    <p className="admin-hint"><ShieldCheck size={15} /> Staff queue data is loaded from Supabase using your assigned role. Actions are recorded in the audit trail.</p>
  </>;
  return <>
    <SectionHeading eyebrow="Market operations · Masaka" title="Operations overview" detail="A single view of marketplace activity, hub exceptions, and customer issues." action={<button className="admin-quiet-button" type="button" onClick={() => setSection("Reports & audit")}><Activity size={15} /> View reports</button>} />
    <div className="admin-metrics">
      <Metric label="Consumers" value="1,284" change="+36 this month" icon={Users} />
      <Metric label="Merchants" value={merchantTotal} change={`${pendingMerchantTotal} awaiting review`} icon={Store} tone="orange" />
      <Metric label="Open orders" value="47" change="7 need attention" icon={ClipboardList} tone="blue" />
      <Metric label="Hub exceptions" value="6" change="2 past target" icon={Boxes} tone="red" />
    </div>
    <div className="admin-overview-grid">
      <section className="admin-section"><div className="admin-section-title"><div><span className="admin-eyebrow">Live queue</span><h2>Needs attention</h2></div><span className="admin-count">4</span></div><div className="admin-alert-list">{attentionItems.map(item => { const AlertIcon = item.icon; return <div className="admin-alert-row" key={item.title}><span className={`admin-alert-icon ${item.tone}`}><AlertIcon size={16} /></span><div className="admin-alert-copy"><strong>{item.title}</strong><span>{item.detail}</span></div><time>{item.time}</time></div>; })}</div></section>
      <section className="admin-section"><div className="admin-section-title"><div><span className="admin-eyebrow">Demand signal</span><h2>Market pulse</h2></div><span className="admin-period">This week</span></div><div className="admin-market-pulse"><div className="pulse-line"><span>Produce</span><strong>+8.4%</strong><ArrowUpRight size={15} /></div><div className="pulse-line"><span>Grains & rice</span><strong>+3.1%</strong><ArrowUpRight size={15} /></div><div className="pulse-line"><span>Protein</span><strong>-1.6%</strong><ArrowDownRight size={15} /></div><p>Based on demo search and order events. No live trend data is connected.</p></div></section>
    </div>
    <section className="admin-section admin-full-section"><div className="admin-section-title"><div><span className="admin-eyebrow">Fulfillment</span><h2>Latest order exceptions</h2></div><button className="admin-link-button" type="button" onClick={() => setSection("Orders")} >All orders <ArrowRight size={14} /></button></div><Table columns={["Order", "Customer", "Merchants", "State", "Area", "Updated"]} rows={orders.slice(0, 3).map(order => ({ id: order.id, cells: [<strong>{order.id}</strong>, order.customer, order.merchants, <StatusTag tone={order.state.includes("delay") || order.state.includes("Partially") ? "warning" : "blue"}>{order.state}</StatusTag>, order.area, order.updated] }))} />
    </section>
  </>;
}

function AccountsView({ search, setSearch, accountRecords }) {
  const [type, setType] = useState("All accounts");
  const visibleAccounts = useMemo(() => accountRecords.filter(account => (type === "All accounts" || account.role === type) && `${account.id} ${account.name} ${account.email} ${account.area}`.toLowerCase().includes(search.toLowerCase())), [type, search, accountRecords]);
  return <>
    <SectionHeading eyebrow="People and access" title="Accounts" detail="Consumer and merchant records. Sensitive customer details are masked in this preview." />
    <div className="admin-toolbar"><div className="admin-tabs">{["All accounts", "Consumer", "Merchant"].map(option => <button key={option} className={type === option ? "active" : ""} type="button" onClick={() => setType(option)}>{option}</button>)}</div><SearchField value={search} onChange={setSearch} placeholder="Search by ID, name, or area" /></div>
    <section className="admin-section admin-full-section"><Table columns={["Account", "Name", "Email", "Area / stall", "Status", ""]} rows={visibleAccounts.map(account => ({ id: account.id, cells: [<strong>{account.id}</strong>, account.name, account.email, account.area, <StatusTag tone={account.status === "Active" || account.status === "Verified" ? "green" : account.status === "Restricted" ? "red" : "warning"}>{account.status}</StatusTag>, <button className="admin-row-button" type="button" title="Account actions are not connected" disabled>•••</button>] }))} emptyMessage="No accounts match this filter." /></section>
  </>;
}

function MerchantReviewView({ applications, onSelect, selectedApplication, onCheck, onApprove, onRequestChanges, onClose, isDemo, actionBusy }) {
  const [decisionReason, setDecisionReason] = useState("");
  const pendingCount = applications.filter(application => ["Pending review", "Needs changes"].includes(application.status)).length;
  const checksComplete = selectedApplication?.checks.every(check => check.complete) ?? false;
  const canRequestChanges = decisionReason.trim().length >= 3;
  return <>
    <SectionHeading eyebrow="Trust operations" title="Merchant review" detail="Review identity, business, stall, and location checks before granting selling access." />
    <div className="admin-review-summary"><div><BadgeCheck size={17} /><span><strong>{pendingCount}</strong> applications awaiting review</span></div>{isDemo && <><div><Clock3 size={17} /><span><strong>2.4 days</strong> median review time</span></div><div><ShieldCheck size={17} /><span><strong>3</strong> appeals due today</span></div></>}</div>
    <section className="admin-section admin-full-section"><Table columns={["Applicant", "Market / stall", "Submitted", "Checks", "Status", "Action"]} rows={applications.map(application => ({ id: application.id, cells: [<strong>{application.name}</strong>, application.area, application.submitted, `${application.checks.filter(check => check.complete).length}/${application.checks.length} checks complete`, <StatusTag tone={application.status === "Verified" ? "green" : application.status === "Rejected" ? "red" : "warning"}>{application.status}</StatusTag>, ["Pending review", "Needs changes"].includes(application.status) ? <button className="admin-row-button" type="button" onClick={() => { setDecisionReason(""); onSelect(application.id); }}>Review</button> : <span className="admin-reviewed-mark"><Check size={13} /> Reviewed</span>] }))} emptyMessage="No merchant applications are waiting." /></section>
    {selectedApplication && <section className="admin-section admin-review-workbench"><div className="admin-section-title"><div><span className="admin-eyebrow">{isDemo ? "Sample application" : "Application"} · {selectedApplication.id}</span><h2>{selectedApplication.name}</h2><span className="admin-subtext">{selectedApplication.area} · submitted {selectedApplication.submitted}</span></div><button className="admin-icon-action light" type="button" aria-label="Close review" onClick={onClose}><X size={16} /></button></div><p>{selectedApplication.landmark}</p><section className="admin-merchant-evidence" aria-label="Merchant verification evidence"><div><strong><FileText size={15} /> Identity evidence</strong><span>{formatStatus(selectedApplication.identityDocumentType || "not submitted")}</span>{selectedApplication.identityDocumentUrl ? <a href={selectedApplication.identityDocumentUrl} target="_blank" rel="noreferrer">Download identity document <ArrowUpRight size={13} /></a> : <small>No identity document is available.</small>}</div><div><strong><FileText size={15} /> Business evidence</strong><span>{formatStatus(selectedApplication.businessEvidenceType || "not submitted")}</span>{selectedApplication.businessDocumentUrl ? <a href={selectedApplication.businessDocumentUrl} target="_blank" rel="noreferrer">Download business evidence <ArrowUpRight size={13} /></a> : <small>No business evidence is available.</small>}</div><div className="admin-policy-evidence"><strong><ShieldCheck size={15} /> Merchant policies</strong><span>{selectedApplication.acceptedPolicyVersion || "Not accepted"}</span><small>{selectedApplication.acceptedPolicyAt ? `Accepted ${displayDate(selectedApplication.acceptedPolicyAt)}` : "No acceptance timestamp recorded."}</small></div></section><div className="admin-review-checks">{selectedApplication.checks.map(check => <label className="admin-review-check" key={check.id}><input type="checkbox" checked={check.complete} disabled={actionBusy} onChange={event => onCheck(selectedApplication.id, check.id, event.target.checked, check.notes || "")} /><span><strong>{check.label}</strong><small>{check.notes || check.detail}</small></span><CheckSquare size={16} /></label>)}</div><label className="admin-workflow-field"><span>Decision reason or evidence note</span><textarea value={decisionReason} onChange={event => setDecisionReason(event.target.value)} maxLength={2000} placeholder="Record the evidence checked, or explain what the applicant must change." /></label><div className="admin-review-footer"><span>{checksComplete ? "All review checks are complete." : "Complete all checks before approving this application."}</span><div><button className="admin-secondary-action" type="button" disabled={actionBusy || !canRequestChanges} onClick={() => onRequestChanges(selectedApplication.id, decisionReason)}>{actionBusy ? "Saving..." : "Request changes"}</button><button className="admin-approve-action" type="button" disabled={actionBusy || !checksComplete} onClick={() => onApprove(selectedApplication.id, decisionReason)}><Check size={14} /> {actionBusy ? "Saving..." : "Approve merchant"}</button></div></div>{isDemo && <p className="admin-preview-footnote">Preview only. This does not change Supabase data or grant seller access.</p>}</section>}
    <p className="admin-hint"><ShieldAlert size={15} /> Approval requires all four checks; decisions and evidence notes are written atomically to the audit trail.</p>
  </>;
}

function OrdersView() {
  const [filter, setFilter] = useState("All");
  const visibleOrders = orders.filter(order => filter === "All"
    || (filter === "Payment pending" && order.payment === "Pending")
    || (filter === "Partial fulfillment" && order.state === "Partially fulfilled")
    || (filter === "Exceptions" && (order.state.includes("delay") || order.state === "Awaiting payment")));
  return <>
    <SectionHeading eyebrow="Multi-merchant fulfillment" title="Orders" detail="Master orders, merchant suborders, payment state, shipment state, and event history." />
    <div className="admin-filter-row">{["All", "Payment pending", "Partial fulfillment", "Exceptions"].map(option => <button key={option} className={`admin-filter ${filter === option ? "active" : ""}`} type="button" onClick={() => setFilter(option)}>{option}</button>)}</div>
    <section className="admin-section admin-full-section"><Table columns={["Master order", "Customer", "Suborders", "Payment", "Fulfillment", "Area", "Updated"]} rows={visibleOrders.map(order => ({ id: order.id, cells: [<strong>{order.id}</strong>, order.customer, order.merchants, <StatusTag tone={order.payment === "Pending" ? "warning" : "green"}>{order.payment}</StatusTag>, <StatusTag tone={order.state.includes("delay") || order.state.includes("Partially") ? "warning" : "blue"}>{order.state}</StatusTag>, order.area, order.updated] }))} emptyMessage="No orders match this filter." /></section>
    <p className="admin-hint"><CircleDollarSign size={15} /> Financial actions are intentionally unavailable in this UI preview.</p>
  </>;
}

function LogisticsView() {
  return <>
    <SectionHeading eyebrow="Distribution operations" title="Hub & logistics" detail="Inbound collection, goods receiving, quality checks, consolidation, dispatch, and delivery exceptions." />
    <div className="admin-metrics compact"><Metric label="Awaiting receipt" value="11" change="3 expected before 14:00" icon={PackageCheck} tone="blue" /><Metric label="Quality check" value="8" change="2 discrepancies" icon={ShieldCheck} tone="orange" /><Metric label="On route" value="19" change="4 delivery windows at risk" icon={Truck} /><Metric label="Failed attempt" value="2" change="Needs customer contact" icon={MapPin} tone="red" /></div>
    <section className="admin-section admin-full-section"><div className="admin-section-title"><div><span className="admin-eyebrow">Event stream</span><h2>Logistics notifications</h2></div><span className="admin-period">Sample feed</span></div><Table columns={["Time", "Event", "Reference", "Location", "State"]} rows={hubEvents.map(event => ({ id: event.ref, cells: [event.time, event.event, <strong>{event.ref}</strong>, event.location, <StatusTag tone={event.state === "Needs recount" ? "warning" : "green"}>{event.state}</StatusTag>] }))} /></section>
  </>;
}

function ComplaintsView({ complaintCases, onUpdate, isDemo, actionBusy }) {
  const [priority, setPriority] = useState("All complaints");
  const [selectedId, setSelectedId] = useState(null);
  const [status, setStatus] = useState("investigating");
  const [selectedPriority, setSelectedPriority] = useState("normal");
  const [staffNote, setStaffNote] = useState("");
  const [claimForSelf, setClaimForSelf] = useState(false);
  const rows = complaintCases.filter(item => priority === "All complaints" || item.priority === priority);
  const selectedCase = complaintCases.find(item => item.id === selectedId);
  function selectCase(item) {
    setSelectedId(item.id);
    setStatus(item.rawStatus || "investigating");
    setSelectedPriority((item.rawPriority || "normal"));
    setStaffNote("");
    setClaimForSelf(false);
  }
  function saveCase(event) {
    event.preventDefault();
    if (!selectedCase || staffNote.trim().length < 3) return;
    onUpdate(selectedCase.id, status, selectedPriority, claimForSelf, staffNote.trim());
  }
  return <>
    <SectionHeading eyebrow="Customer care" title="Complaints & disputes" detail="Review order-linked cases, assign ownership, record internal notes, and move cases through resolution." />
    <div className="admin-toolbar"><div className="admin-tabs">{["All complaints", "High", "Normal", "Low"].map(option => <button key={option} className={priority === option ? "active" : ""} type="button" onClick={() => setPriority(option)}>{option}</button>)}</div></div>
    <section className="admin-section admin-full-section"><Table columns={["Case", "Issue", "Order", "Customer", "Priority", "Status", "Action"]} rows={rows.map(item => ({ id: item.id, cells: [<strong>{item.id.slice(0, 8)}</strong>, item.topic, item.order, item.customer, <StatusTag tone={item.priority === "High" ? "red" : item.priority === "Normal" ? "blue" : "neutral"}>{item.priority}</StatusTag>, <StatusTag tone={item.status === "Resolved" || item.status === "Closed" ? "green" : "warning"}>{item.status}</StatusTag>, <button className="admin-row-button" type="button" onClick={() => selectCase(item)}>Open</button>] }))} emptyMessage="No complaints in this view." /></section>
    {selectedCase && <section className="admin-section admin-review-workbench"><div className="admin-section-title"><div><span className="admin-eyebrow">Case · {selectedCase.id}</span><h2>{selectedCase.topic}</h2><span className="admin-subtext">{selectedCase.customer} · {selectedCase.order} · {selectedCase.age}</span></div><button className="admin-icon-action light" type="button" aria-label="Close case" onClick={() => setSelectedId(null)}><X size={16} /></button></div><p>{selectedCase.description}</p><div className="admin-case-timeline">{selectedCase.events.map(event => <div key={event.id}><strong>{formatStatus(event.event_type)}</strong><span>{event.event_note}</span><small>{displayDate(event.created_at)}</small></div>)}</div><form className="admin-workflow-form" onSubmit={saveCase}><label className="admin-workflow-field"><span>Status</span><select value={status} onChange={event => setStatus(event.target.value)}><option value="open">Open</option><option value="investigating">Investigating</option><option value="waiting_on_customer">Waiting on customer</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select></label><label className="admin-workflow-field"><span>Priority</span><select value={selectedPriority} onChange={event => setSelectedPriority(event.target.value)}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option></select></label><label className="admin-review-check"><input type="checkbox" checked={claimForSelf} onChange={event => setClaimForSelf(event.target.checked)} /><span><strong>Assign this case to me</strong><small>Owner assignment is recorded in the update.</small></span></label><label className="admin-workflow-field"><span>Internal note / resolution reason</span><textarea value={staffNote} onChange={event => setStaffNote(event.target.value)} minLength={3} maxLength={2000} required placeholder="Record evidence reviewed, customer follow-up, or resolution." /></label><button className="admin-approve-action" type="submit" disabled={isDemo || actionBusy || staffNote.trim().length < 3}>{actionBusy ? "Saving..." : "Save case update"}</button></form>{isDemo && <p className="admin-preview-footnote">Preview only. Complaint actions are not connected in demo mode.</p>}</section>}
    <p className="admin-hint"><ShieldAlert size={15} /> Case updates require an internal reason. Customer events and staff-only notes are separately scoped.</p>
  </>;
}

function CatalogView() {
  return <>
    <SectionHeading eyebrow="Catalog quality" title="Catalog moderation" detail="Listing checks, duplicate candidates, product condition, authenticity documents, and appeals." />
    <section className="admin-section admin-full-section"><Table columns={["Offer", "Product", "Merchant", "Flag", "Status", "Action"]} rows={products.map(product => ({ id: product.id, cells: [<strong>{product.id}</strong>, product.product, product.merchant, product.issue, <StatusTag tone={product.status === "Flagged" ? "red" : "warning"}>{product.status}</StatusTag>, <button className="admin-row-button" type="button" disabled title="Moderation workflow is not connected">Review</button>] }))} /></section>
    <p className="admin-hint"><FileWarning size={15} /> Duplicate detection should create review candidates only; never auto-merge materially different products.</p>
  </>;
}

function FinanceRiskView({ approvals, staffRoles, currentUserId, onSubmit, onReview, actionBusy, isDemo }) {
  const [actionType, setActionType] = useState("refund");
  const [reference, setReference] = useState("");
  const [amount, setAmount] = useState("");
  const [requestReason, setRequestReason] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [decisionReason, setDecisionReason] = useState("");
  const selectedApproval = approvals.find(item => item.id === selectedId);
  const canRequest = staffRoles.includes("finance_reviewer");
  const canApprove = staffRoles.includes("finance_approver");
  function submitRequest(event) {
    event.preventDefault();
    const naira = Number(amount);
    const minorUnits = Math.round(naira * 100);
    if (!Number.isFinite(naira) || naira <= 0 || minorUnits <= 0 || !Number.isSafeInteger(minorUnits)) return;
    onSubmit(actionType, reference.trim(), minorUnits, requestReason.trim(), () => {
      setReference("");
      setAmount("");
      setRequestReason("");
    });
  }
  function submitDecision(decision) {
    if (!selectedApproval || decisionReason.trim().length < 3) return;
    Promise.resolve(onReview(selectedApproval.id, decision, decisionReason.trim())).then(saved => {
      if (saved) {
        setSelectedId(null);
        setDecisionReason("");
      }
    });
  }
  const money = minorUnits => new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(minorUnits / 100);
  return <>
    <SectionHeading eyebrow="Restricted operations" title="Finance & risk" detail="Financial requests require a separate approver. Approval records do not execute refunds, payouts, or payment changes." />
    {isDemo ? <div className="admin-metrics compact"><Metric label="Payment reconciliation" value="3" change="Sample unmatched references" icon={CircleDollarSign} tone="orange" /><Metric label="Refund requests" value="5" change="Sample review queue" icon={ArrowRight} tone="blue" /><Metric label="Payout holds" value="2" change="No release action enabled" icon={ShieldAlert} tone="red" /><Metric label="Risk alerts" value="4" change="Human review required" icon={AlertTriangle} /></div> : <>
      {canRequest && <form className="admin-section admin-workflow-form" onSubmit={submitRequest}><div className="admin-section-title"><div><span className="admin-eyebrow">Dual-control workflow</span><h2>Request a financial action</h2></div></div><div className="admin-workflow-grid"><label className="admin-workflow-field"><span>Action</span><select value={actionType} onChange={event => setActionType(event.target.value)}><option value="refund">Refund</option><option value="payout_release">Payout release</option><option value="payment_adjustment">Payment adjustment</option></select></label><label className="admin-workflow-field"><span>Payment / payout reference</span><input value={reference} onChange={event => setReference(event.target.value)} maxLength={200} required /></label><label className="admin-workflow-field"><span>Amount (NGN)</span><input type="number" min="0.01" step="0.01" value={amount} onChange={event => setAmount(event.target.value)} required /></label><label className="admin-workflow-field wide"><span>Reason and evidence summary</span><textarea value={requestReason} onChange={event => setRequestReason(event.target.value)} minLength={3} maxLength={2000} required /></label></div><button className="admin-approve-action" type="submit" disabled={actionBusy}>{actionBusy ? "Submitting..." : "Submit for independent approval"}</button></form>}
      <section className="admin-section admin-full-section"><div className="admin-section-title"><div><span className="admin-eyebrow">Approval queue</span><h2>Financial action requests</h2></div></div><Table columns={["Requested", "Action", "Reference", "Amount", "Requester", "Status", "Decision"]} rows={approvals.map(item => ({ id: item.id, cells: [displayDate(item.created_at), formatStatus(item.action_type), item.target_reference, money(item.amount_minor_units), item.requester_name, <StatusTag tone={item.status === "approved" ? "green" : item.status === "rejected" ? "red" : "warning"}>{formatStatus(item.status)}</StatusTag>, item.status === "pending" && canApprove && item.requested_by !== currentUserId ? <button className="admin-row-button" type="button" onClick={() => { setSelectedId(item.id); setDecisionReason(""); }}>Review</button> : item.review_reason || "—"] }))} emptyMessage="No financial approval requests." /></section>
      {selectedApproval && <section className="admin-section admin-review-workbench"><div className="admin-section-title"><div><span className="admin-eyebrow">Independent approval</span><h2>{formatStatus(selectedApproval.action_type)} · {money(selectedApproval.amount_minor_units)}</h2><span className="admin-subtext">{selectedApproval.target_reference} · requested by {selectedApproval.requester_name}</span></div><button className="admin-icon-action light" type="button" aria-label="Close approval" onClick={() => setSelectedId(null)}><X size={16} /></button></div><p>{selectedApproval.request_reason}</p><label className="admin-workflow-field"><span>Approval / rejection reason</span><textarea value={decisionReason} onChange={event => setDecisionReason(event.target.value)} minLength={3} maxLength={2000} required /></label><div className="admin-review-footer"><span>Requesters cannot approve their own actions.</span><div><button className="admin-secondary-action" type="button" disabled={actionBusy || decisionReason.trim().length < 3} onClick={() => submitDecision("rejected")}>Reject</button><button className="admin-approve-action" type="button" disabled={actionBusy || decisionReason.trim().length < 3} onClick={() => submitDecision("approved")}>Approve request</button></div></div><p className="admin-preview-footnote">Approval is a recorded control only. No payment or payout is executed here.</p></section>}
    </>}
    <p className="admin-hint"><ShieldCheck size={15} /> Finance reviewers can request actions; a different finance approver must record a reason. No direct financial execution is exposed.</p>
  </>;
}

function ReportsView({ auditEvents, isDemo }) {
  return <>
    <SectionHeading eyebrow="Performance & accountability" title="Reports & audit" detail="Marketplace health, merchant visibility, concentration, operational metrics, and consequential-action history." />
    {isDemo && <div className="admin-overview-grid"><section className="admin-section"><div className="admin-section-title"><div><span className="admin-eyebrow">Fairness monitor</span><h2>Merchant visibility</h2></div><span className="admin-period">Sample</span></div><div className="admin-market-pulse"><div className="pulse-line"><span>Top 10% merchant impression share</span><strong>41%</strong></div><div className="pulse-line"><span>New merchant discovery rate</span><strong>18%</strong></div><div className="pulse-line"><span>Eligible small-merchant exposure</span><strong>26%</strong></div><p>These are illustrative values only. Exposure is not a promise of equal sales.</p></div></section><section className="admin-section"><div className="admin-section-title"><div><span className="admin-eyebrow">AI oversight</span><h2>Model/service health</h2></div><span className="admin-period">Not connected</span></div><div className="admin-market-pulse"><div className="pulse-line"><span>Active services</span><strong>0</strong></div><div className="pulse-line"><span>Human overrides</span><strong>—</strong></div><div className="pulse-line"><span>Fallback events</span><strong>—</strong></div><p>No AI service is connected to production data.</p></div></section></div>}
    <section className="admin-section admin-full-section"><div className="admin-section-title"><div><span className="admin-eyebrow">Security trail</span><h2>Recent audit events</h2></div><StatusTag tone={auditEvents.some(event => event.sample) ? "warning" : "green"}>{auditEvents.some(event => event.sample) ? "Sample events" : "Live events"}</StatusTag></div><Table columns={["Time", "Staff role", "Action", "Target", "Details"]} rows={auditEvents.map(event => ({ id: event.id, cells: [event.time || displayDate(event.created_at), event.role || event.actor_role, event.action, event.target || `${event.entity_type} · ${event.entity_id}`, event.approval || JSON.stringify(event.details)] }))} emptyMessage="No audit events are visible to your account." /></section>
  </>;
}

export default function AdminView({ onExit, account, isDemo = false }) {
  const [section, setSection] = useState("Overview");
  const [sidebarOpen, setSidebarOpen] = useState(() => window.matchMedia("(min-width: 761px)").matches);
  const [globalSearch, setGlobalSearch] = useState("");
  const [merchantApplications, setMerchantApplications] = useState(() => isDemo ? accounts.filter(account => account.role === "Merchant").map(account => ({
    id: account.id,
    name: account.name,
    area: account.area,
    submitted: account.status === "Pending review" ? "Today · 10:24" : "Yesterday · 15:08",
    status: account.status,
    landmark: "",
    checks: Object.entries(reviewCheckDetails).map(([id, [label, detail]]) => ({ id, label, detail, complete: false })),
  })) : []);
  const [complaintCases, setComplaintCases] = useState(() => isDemo ? complaints.map(item => ({
    id: item.id,
    topic: item.topic,
    order: item.order,
    customer: item.customer,
    priority: item.priority,
    rawPriority: item.priority.toLowerCase(),
    rawStatus: "open",
    status: "Open",
    age: item.age,
    description: item.topic,
    events: [],
  })) : []);
  const [financialApprovals, setFinancialApprovals] = useState([]);
  const [selectedMerchantId, setSelectedMerchantId] = useState(null);
  const [auditEvents, setAuditEvents] = useState(() => isDemo ? [
    { id: "AU-201", time: "12:42", role: "Hub operator", action: "Recorded quantity mismatch", target: "SH-0831", approval: "Not required", sample: true },
    { id: "AU-198", time: "12:31", role: "Merchant reviewer", action: "Requested additional documents", target: "ME-0218", approval: "Logged", sample: true },
    { id: "AU-194", time: "11:58", role: "Dispatch coordinator", action: "Assigned route", target: "RT-NORTH-04", approval: "Logged", sample: true },
  ] : []);
  const [accountNotice, setAccountNotice] = useState("");
  const [toast, setToast] = useState("");
  const [dataError, setDataError] = useState("");
  const [isLoading, setIsLoading] = useState(!isDemo);
  const [actionBusy, setActionBusy] = useState(false);
  useEffect(() => {
    const desktopQuery = window.matchMedia("(min-width: 761px)");
    const syncSidebar = event => setSidebarOpen(event.matches);
    desktopQuery.addEventListener("change", syncSidebar);
    return () => desktopQuery.removeEventListener("change", syncSidebar);
  }, []);
  const staffRoles = account?.staffRoles || [];
  const roleKey = staffRoles.slice().sort().join(",");
  const selectedApplication = merchantApplications.find(application => application.id === selectedMerchantId);
  const accountRecords = accounts.map(account => {
    const application = merchantApplications.find(item => item.id === account.id);
    return application ? { ...account, status: application.status } : account;
  });

  async function refreshData() {
    const [merchantRows, complaintRows, approvalRows, auditRows] = await Promise.all([
      staffRoles.includes("merchant_reviewer") ? loadMerchantApplications() : Promise.resolve(null),
      staffRoles.includes("support_agent") ? loadComplaints() : Promise.resolve(null),
      staffRoles.some(role => ["finance_reviewer", "finance_approver"].includes(role)) ? loadFinancialApprovals() : Promise.resolve(null),
      staffRoles.includes("audit_viewer") ? loadAuditEvents() : Promise.resolve(null),
    ]);
    if (merchantRows) setMerchantApplications(merchantRows.map(row => ({
      id: row.user_id,
      name: row.full_name,
      area: `${row.market_name} · Stall ${row.stall_number}`,
      submitted: displayDate(row.submitted_at),
      status: row.verification_status === "pending" ? "Pending review" : formatStatus(row.verification_status),
      landmark: row.landmark,
      identityDocumentType: row.identity_document_type,
      identityDocumentUrl: row.identity_document_url,
      businessEvidenceType: row.business_evidence_type,
      businessDocumentUrl: row.business_document_url,
      acceptedPolicyVersion: row.accepted_policy_version,
      acceptedPolicyAt: row.accepted_policy_at,
      checks: row.checks.map(check => {
        const [label, detail] = reviewCheckDetails[check.id];
        return { id: check.id, label, detail, complete: check.complete, notes: check.notes };
      }),
    })));
    if (complaintRows) setComplaintCases(complaintRows.map(row => ({
      id: row.id,
      topic: row.subject,
      order: row.order_reference || "—",
      customer: row.customer_name,
      priority: formatStatus(row.priority),
      rawPriority: row.priority,
      rawStatus: row.status,
      status: formatStatus(row.status),
      age: displayDate(row.created_at),
      description: row.description,
      assignedTo: row.assigned_to,
      events: row.events,
    })));
    if (approvalRows) setFinancialApprovals(approvalRows);
    if (auditRows) setAuditEvents(auditRows);
  }

  useEffect(() => {
    if (isDemo) return undefined;
    let active = true;
    setIsLoading(true);
    setDataError("");
    refreshData()
      .catch(error => { if (active) setDataError(error.message || "Could not load staff data."); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [isDemo, roleKey]);

  async function runAction(action, successMessage) {
    setActionBusy(true);
    setDataError("");
    setAccountNotice("");
    try {
      await action();
      setToast(successMessage);
    } catch (error) {
      setDataError(error.message || "The action could not be completed.");
      setActionBusy(false);
      return false;
    }
    try {
      await refreshData();
    } catch (error) {
      setDataError(`Action saved, but staff data could not be refreshed: ${error.message}`);
    } finally {
      setActionBusy(false);
    }
    return true;
  }

  function updateMerchantCheck(applicationId, checkId, complete, notes) {
    if (isDemo) {
      setMerchantApplications(current => current.map(application => application.id !== applicationId ? application : {
        ...application,
        checks: application.checks.map(check => check.id === checkId ? { ...check, complete } : check),
      }));
      return;
    }
    void runAction(() => setMerchantReviewCheck(applicationId, checkId, complete, notes), "Review evidence saved and audited.");
  }

  function recordMerchantDecision(applicationId, decision, reason) {
    const application = merchantApplications.find(item => item.id === applicationId);
    if (!application) return;
    if (isDemo) {
      const status = decision === "verified" ? "Verified" : "Needs changes";
      setMerchantApplications(current => current.map(item => item.id === applicationId ? { ...item, status } : item));
      setAuditEvents(current => [{ id: `AU-${Date.now()}`, time: "Just now", role: "Merchant reviewer", action: status === "Verified" ? "Approved merchant application" : "Requested merchant application changes", target: applicationId, approval: "Recorded in preview", sample: true }, ...current]);
      setAccountNotice(`${application.name}: ${status.toLowerCase()} (preview only)`);
      setSelectedMerchantId(null);
      return;
    }
    void runAction(() => reviewMerchantApplication(applicationId, decision, reason), "Merchant decision saved and audited.");
    setSelectedMerchantId(null);
  }

  function saveComplaint(id, status, priority, claimForSelf, note) {
    void runAction(() => updateComplaint(id, status, priority, claimForSelf, note), "Complaint update saved and audited.");
  }

  function submitApproval(actionType, reference, amountMinorUnits, reason, clearForm) {
    return runAction(() => submitFinancialApproval(actionType, reference, amountMinorUnits, reason), "Financial action submitted for independent approval.")
      .then(saved => { if (saved) clearForm(); return saved; });
  }

  function decideApproval(id, decision, reason) {
    return runAction(() => reviewFinancialApproval(id, decision, reason), `Financial request ${decision}. No funds were moved.`);
  }

  const allowedNavItems = isDemo ? navItems : navItems.filter(item => item.name === "Overview" || sectionRoles[item.name]?.some(role => staffRoles.includes(role)));
  const CurrentIcon = navItems.find(item => item.name === section)?.icon || LayoutDashboard;
  const sectionContent = {
    Overview: <Overview setSection={setSection} merchantTotal={isDemo ? accountRecords.filter(account => account.role === "Merchant" && account.status === "Verified").length : staffRoles.includes("merchant_reviewer") ? merchantApplications.length : null} pendingMerchantTotal={merchantApplications.filter(application => ["Pending review", "Needs changes"].includes(application.status)).length} complaintTotal={staffRoles.includes("support_agent") ? complaintCases.length : isDemo ? complaints.length : null} canViewAudit={isDemo || staffRoles.includes("audit_viewer")} isDemo={isDemo} />,
    Accounts: <AccountsView search={globalSearch} setSearch={setGlobalSearch} accountRecords={accountRecords} />,
    "Merchant review": <MerchantReviewView applications={merchantApplications} onSelect={setSelectedMerchantId} selectedApplication={selectedApplication} onCheck={updateMerchantCheck} onApprove={(id, reason) => recordMerchantDecision(id, "verified", reason)} onRequestChanges={(id, reason) => recordMerchantDecision(id, "needs_changes", reason)} onClose={() => setSelectedMerchantId(null)} isDemo={isDemo} actionBusy={actionBusy} />,
    Orders: <OrdersView />,
    "Hub & logistics": <LogisticsView />,
    Complaints: <ComplaintsView complaintCases={complaintCases} onUpdate={saveComplaint} isDemo={isDemo} actionBusy={actionBusy} />,
    "Catalog moderation": <CatalogView />,
    "Finance & risk": <FinanceRiskView approvals={financialApprovals} staffRoles={staffRoles} currentUserId={account?.id} onSubmit={submitApproval} onReview={decideApproval} actionBusy={actionBusy} isDemo={isDemo} />,
    "Reports & audit": <ReportsView auditEvents={auditEvents} isDemo={isDemo} />,
  }[section];

  return <div className="admin-app">
    <header className="admin-topbar"><div className="admin-brand"><button className="admin-menu-toggle" type="button" aria-label="Toggle administration menu" aria-controls="admin-sidebar" aria-expanded={sidebarOpen} onClick={() => setSidebarOpen(open => !open)}><Menu size={19} /></button><img src="/smk.jpeg" alt="Smart Kasua" /><span>Control center</span></div><div className="admin-topbar-right">{isDemo && <button className="admin-icon-action" type="button" aria-label="Open logistics notifications" onClick={() => setSection("Hub & logistics")}><Bell size={17} /><b>4</b></button>}</div></header>
    <div className={`admin-frame ${sidebarOpen ? "" : "sidebar-closed"}`}>
      <aside className="admin-sidebar" id="admin-sidebar"><div className="admin-sidebar-heading">OPERATIONS</div><nav aria-label="Administration sections">{allowedNavItems.map(item => { const NavIcon = item.icon; return <button key={item.name} type="button" className={`admin-nav-item ${section === item.name ? "active" : ""}`} onClick={() => { setSection(item.name); if (window.matchMedia("(max-width: 760px)").matches) setSidebarOpen(false); }}><NavIcon size={16} /><span>{item.name}</span>{item.name === "Complaints" && <b>{complaintCases.length}</b>}</button>; })}</nav><div className="admin-staff-card"><div className="admin-staff-avatar">{(account?.name || "KS").slice(0, 1).toUpperCase()}</div><div><strong>{isDemo ? "Kasua staff" : account?.name}</strong><span>{isDemo ? "Read-only preview" : staffRoles.map(formatStatus).join(" · ")}</span></div></div><button className="admin-logout" type="button" onClick={onExit}><LogOut size={15} /> {isDemo ? "Exit preview" : "Sign out"}</button></aside>
      <main className="admin-main"><div className="admin-main-top"><div className="admin-breadcrumb"><CurrentIcon size={15} /><span>Control center</span><ChevronRight size={13} /><strong>{section}</strong></div></div>{isDemo ? <div className="admin-demo-notice"><AlertTriangle size={15} /><span><strong>Prototype with sample data.</strong> No live records are read or changed in preview mode.</span></div> : <div className="admin-demo-notice"><ShieldCheck size={15} /><span><strong>Role-scoped staff workspace.</strong> Database policies authorize every read and write; financial requests require a separate approver.</span></div>}{isLoading && <div className="admin-demo-notice" role="status">Loading authorized staff data...</div>}{dataError && <div className="admin-demo-notice" role="alert">{dataError}</div>}{accountNotice && <div className="admin-demo-notice success"><Check size={15} /><span>{accountNotice}</span></div>}{toast && <div className="admin-demo-notice" role="status">{toast}</div>}{sectionContent}</main>
    </div>
  </div>;
}
