import { useMemo, useState } from "react";
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, BadgeCheck,
  Bell, Boxes, ChartNoAxesCombined, Check, ChevronRight, CircleDollarSign,
  ClipboardList, FileWarning, LayoutDashboard, MapPin, MessageSquareWarning,
  PackageCheck, Search, ShieldAlert, ShieldCheck, Store, Truck, Users, X,
} from "lucide-react";

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

function Overview({ setSection }) {
  return <>
    <SectionHeading eyebrow="Market operations · Masaka" title="Operations overview" detail="A single view of marketplace activity, hub exceptions, and customer issues." action={<button className="admin-quiet-button" type="button" onClick={() => setSection("Reports & audit")}><Activity size={15} /> View reports</button>} />
    <div className="admin-metrics">
      <Metric label="Consumers" value="1,284" change="+36 this month" icon={Users} />
      <Metric label="Merchants" value="186" change="12 awaiting review" icon={Store} tone="orange" />
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

function AccountsView({ search, setSearch }) {
  const [type, setType] = useState("All accounts");
  const visibleAccounts = useMemo(() => accounts.filter(account => (type === "All accounts" || account.role === type) && `${account.id} ${account.name} ${account.email} ${account.area}`.toLowerCase().includes(search.toLowerCase())), [type, search]);
  return <>
    <SectionHeading eyebrow="People and access" title="Accounts" detail="Consumer and merchant records. Sensitive customer details are masked in this preview." />
    <div className="admin-toolbar"><div className="admin-tabs">{["All accounts", "Consumer", "Merchant"].map(option => <button key={option} className={type === option ? "active" : ""} type="button" onClick={() => setType(option)}>{option}</button>)}</div><SearchField value={search} onChange={setSearch} placeholder="Search by ID, name, or area" /></div>
    <section className="admin-section admin-full-section"><Table columns={["Account", "Name", "Email", "Area / stall", "Status", ""]} rows={visibleAccounts.map(account => ({ id: account.id, cells: [<strong>{account.id}</strong>, account.name, account.email, account.area, <StatusTag tone={account.status === "Active" || account.status === "Verified" ? "green" : account.status === "Restricted" ? "red" : "warning"}>{account.status}</StatusTag>, <button className="admin-row-button" type="button" title="Account actions are not connected" disabled>•••</button>] }))} emptyMessage="No accounts match this filter." /></section>
  </>;
}

function MerchantReviewView() {
  return <>
    <SectionHeading eyebrow="Trust operations" title="Merchant review" detail="Review identity, business, stall, and location checks before granting selling access." />
    <div className="admin-review-summary"><div><BadgeCheck size={17} /><span><strong>12</strong> applications pending</span></div><div><Clock3 size={17} /><span><strong>2.4 days</strong> median review time</span></div><div><ShieldCheck size={17} /><span><strong>3</strong> appeals due today</span></div></div>
    <section className="admin-section admin-full-section"><Table columns={["Applicant", "Market / stall", "Submitted", "Checks", "Status", "Action"]} rows={accounts.filter(account => account.status === "Pending review").map(account => ({ id: account.id, cells: [<strong>{account.name}</strong>, account.area, "Today · 10:24", "Identity · Stall · Location", <StatusTag tone="warning">Pending review</StatusTag>, <button className="admin-row-button" type="button" disabled title="Review workflow is not connected">Review</button>] }))} emptyMessage="No merchant applications are waiting." /></section>
    <p className="admin-hint"><ShieldAlert size={15} /> Approval, rejection, and document access must be enforced by audited server-side staff permissions.</p>
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

function ComplaintsView() {
  const [priority, setPriority] = useState("All complaints");
  const rows = complaints.filter(item => priority === "All complaints" || item.priority === priority);
  return <>
    <SectionHeading eyebrow="Customer care" title="Complaints & disputes" detail="Order-linked cases, response deadlines, evidence, escalation, and customer updates." />
    <div className="admin-toolbar"><div className="admin-tabs">{["All complaints", "High", "Normal", "Review"].map(option => <button key={option} className={priority === option ? "active" : ""} type="button" onClick={() => setPriority(option)}>{option}</button>)}</div><button className="admin-quiet-button" type="button" disabled title="Support ticket workflow is not connected"><MessageSquareWarning size={15} /> New ticket</button></div>
    <section className="admin-section admin-full-section"><Table columns={["Case", "Issue", "Order", "Customer", "Priority", "Age", "Action"]} rows={rows.map(item => ({ id: item.id, cells: [<strong>{item.id}</strong>, item.topic, item.order, item.customer, <StatusTag tone={item.priority === "High" ? "red" : item.priority === "Normal" ? "blue" : "warning"}>{item.priority}</StatusTag>, item.age, <button className="admin-row-button" type="button" disabled title="Case assignment is not connected">Assign</button>] }))} emptyMessage="No complaints in this view." /></section>
    <p className="admin-hint"><ShieldAlert size={15} /> Complaint decisions need evidence, recorded reasons, response deadlines, and an appeal path.</p>
  </>;
}

function CatalogView() {
  return <>
    <SectionHeading eyebrow="Catalog quality" title="Catalog moderation" detail="Listing checks, duplicate candidates, product condition, authenticity documents, and appeals." />
    <section className="admin-section admin-full-section"><Table columns={["Offer", "Product", "Merchant", "Flag", "Status", "Action"]} rows={products.map(product => ({ id: product.id, cells: [<strong>{product.id}</strong>, product.product, product.merchant, product.issue, <StatusTag tone={product.status === "Flagged" ? "red" : "warning"}>{product.status}</StatusTag>, <button className="admin-row-button" type="button" disabled title="Moderation workflow is not connected">Review</button>] }))} /></section>
    <p className="admin-hint"><FileWarning size={15} /> Duplicate detection should create review candidates only; never auto-merge materially different products.</p>
  </>;
}

function FinanceRiskView() {
  return <>
    <SectionHeading eyebrow="Restricted operations" title="Finance & risk" detail="Read-only controls for payment reconciliation, refund queues, payout oversight, and risk investigations." />
    <div className="admin-metrics compact"><Metric label="Payment reconciliation" value="3" change="Unmatched references" icon={CircleDollarSign} tone="orange" /><Metric label="Refund requests" value="5" change="2 need review" icon={ArrowRight} tone="blue" /><Metric label="Payout holds" value="2" change="No release action enabled" icon={ShieldAlert} tone="red" /><Metric label="Risk alerts" value="4" change="Human review required" icon={AlertTriangle} /></div>
    <p className="admin-hint"><ShieldCheck size={15} /> No payment, refund, payout, suspension, or fraud action can be triggered from this prototype.</p>
  </>;
}

function ReportsView() {
  return <>
    <SectionHeading eyebrow="Performance & accountability" title="Reports & audit" detail="Marketplace health, merchant visibility, concentration, operational metrics, and consequential-action history." />
    <div className="admin-overview-grid"><section className="admin-section"><div className="admin-section-title"><div><span className="admin-eyebrow">Fairness monitor</span><h2>Merchant visibility</h2></div><span className="admin-period">Sample</span></div><div className="admin-market-pulse"><div className="pulse-line"><span>Top 10% merchant impression share</span><strong>41%</strong></div><div className="pulse-line"><span>New merchant discovery rate</span><strong>18%</strong></div><div className="pulse-line"><span>Eligible small-merchant exposure</span><strong>26%</strong></div><p>These are illustrative values only. Exposure is not a promise of equal sales.</p></div></section><section className="admin-section"><div className="admin-section-title"><div><span className="admin-eyebrow">AI oversight</span><h2>Model/service health</h2></div><span className="admin-period">Not connected</span></div><div className="admin-market-pulse"><div className="pulse-line"><span>Active services</span><strong>0</strong></div><div className="pulse-line"><span>Human overrides</span><strong>—</strong></div><div className="pulse-line"><span>Fallback events</span><strong>—</strong></div><p>No AI service is connected to production data.</p></div></section></div>
    <section className="admin-section admin-full-section"><div className="admin-section-title"><div><span className="admin-eyebrow">Security trail</span><h2>Recent audit events</h2></div><StatusTag tone="warning">Sample events</StatusTag></div><Table columns={["Time", "Staff role", "Action", "Target", "Approval"]} rows={[{ id: "AU-201", cells: ["12:42", "Hub operator", "Recorded quantity mismatch", "SH-0831", "Not required"] }, { id: "AU-198", cells: ["12:31", "Merchant reviewer", "Requested additional documents", "ME-0218", "Logged"] }, { id: "AU-194", cells: ["11:58", "Dispatch coordinator", "Assigned route", "RT-NORTH-04", "Logged"] }]} /></section>
  </>;
}

export default function AdminView({ onExit }) {
  const [section, setSection] = useState("Overview");
  const [globalSearch, setGlobalSearch] = useState("");
  const CurrentIcon = navItems.find(item => item.name === section)?.icon || LayoutDashboard;
  const sectionContent = {
    Overview: <Overview setSection={setSection} />,
    Accounts: <AccountsView search={globalSearch} setSearch={setGlobalSearch} />,
    "Merchant review": <MerchantReviewView />,
    Orders: <OrdersView />,
    "Hub & logistics": <LogisticsView />,
    Complaints: <ComplaintsView />,
    "Catalog moderation": <CatalogView />,
    "Finance & risk": <FinanceRiskView />,
    "Reports & audit": <ReportsView />,
  }[section];

  return <div className="admin-app">
    <header className="admin-topbar"><div className="admin-brand"><img src="/smk.jpeg" alt="Smart Kasua" /><span>Control center</span></div><div className="admin-topbar-right"><span className="admin-live"><i /> Admin preview</span><button className="admin-icon-action" type="button" aria-label="Open logistics notifications" onClick={() => setSection("Hub & logistics")}><Bell size={17} /><b>4</b></button><button className="admin-exit" type="button" onClick={onExit}><X size={15} /> Exit preview</button></div></header>
    <div className="admin-frame">
      <aside className="admin-sidebar"><div className="admin-sidebar-heading">OPERATIONS</div><nav aria-label="Administration sections">{navItems.map(item => { const NavIcon = item.icon; return <button key={item.name} type="button" className={`admin-nav-item ${section === item.name ? "active" : ""}`} onClick={() => setSection(item.name)}><NavIcon size={16} /><span>{item.name}</span>{item.name === "Complaints" && <b>3</b>}</button>; })}</nav><div className="admin-staff-card"><div className="admin-staff-avatar">KS</div><div><strong>Kasua staff</strong><span>Read-only preview</span></div></div></aside>
      <main className="admin-main"><div className="admin-main-top"><div className="admin-breadcrumb"><CurrentIcon size={15} /><span>Control center</span><ChevronRight size={13} /><strong>{section}</strong></div></div><div className="admin-demo-notice"><AlertTriangle size={15} /><span><strong>Prototype with sample data.</strong> No customer records, payments, notifications, or admin actions are connected. Actions requiring staff permissions are disabled.</span></div>{sectionContent}</main>
    </div>
  </div>;
}
