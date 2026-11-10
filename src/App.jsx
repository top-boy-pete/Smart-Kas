import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight, ArrowUpRight, BadgeCheck, Bike, Check, ChevronDown, ChevronRight,
  CircleHelp, ClipboardList, Coins, Fish, Grid2X2, House, Leaf, MapPin, MapPinCheck, Package,
  LogIn, LogOut, PackageCheck, Plus, RefreshCw, Route, ScanEye, ShieldCheck, ShoppingBag,
  ShoppingBasket, Star, Store, Sun, UserPlus, UserRound, Wallet, Wheat, X,
} from "lucide-react";
import { categories, demoOrder, formatNaira, readStored, starterInventory, starterProducts } from "./data.js";
import AdminView from "./AdminView.jsx";
import { loadStaffRoles } from "./lib/admin.js";
import { loadCustomerCart, mergeGuestCart, saveCustomerCart } from "./lib/cart.js";
import { loadPublicProducts } from "./lib/catalog.js";
import { createComplaint, loadCustomerComplaints } from "./lib/complaints.js";
import { demoMode, loadAccountProfile, supabase, supabaseConfigured } from "./lib/supabase.js";

const paymentMethods = [
  { id: "wallet", title: "Kasua wallet", detail: "Wallet balance" },
  { id: "paystack", title: "Paystack", detail: "Card or bank" },
  { id: "flutterwave", title: "Flutterwave", detail: "Card or transfer" },
  { id: "ussd", title: "USSD", detail: "Works on any phone" },
];
const deliveryFee = 500;

function useDemoState(initialValue) {
  return useState(initialValue);
}

function useLocalCart(persistLocally) {
  const [cart, setCart] = useState(() => {
    const stored = readStored("kasua-cart", []);
    return Array.isArray(stored)
      ? stored.filter(line => typeof line.productId === "string" && Number.isInteger(line.quantity) && line.quantity > 0)
      : [];
  });
  useEffect(() => {
    if (persistLocally) window.localStorage.setItem("kasua-cart", JSON.stringify(cart));
  }, [cart, persistLocally]);
  return [cart, setCart];
}

function IconButton({ label, children, className = "", onClick, disabled = false }) {
  return <button className={`icon-button ${className}`} type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled}>{children}</button>;
}

function Brand({ className = "", onClick }) {
  return <a className={`brand ${className}`} href="#top" aria-label="Kasua home" onClick={event => { if (onClick) { event.preventDefault(); onClick(); } }}><img className="brand-logo" src="/smk.jpeg" alt="Smart Kasua" /></a>;
}

function AuthHeader({ onHome }) {
  return <header className="auth-header"><Brand onClick={onHome} /></header>;
}

function Dialog({ title, children, onClose, wide = false }) {
  useEffect(() => {
    function onEscape(event) { if (event.key === "Escape") onClose(); }
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [onClose]);
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section className={`modal ${wide ? "modal-wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-header"><h2>{title}</h2><IconButton label="Close dialog" onClick={onClose}><X size={18} /></IconButton></header>
        {children}
      </section>
    </div>
  );
}

function ComplaintDialog({ onClose, onSubmit }) {
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSubmit(subject, description);
    } catch (submissionError) {
      setError(submissionError.message || "Could not open your support case.");
    } finally {
      setBusy(false);
    }
  }
  return <Dialog title="Contact Kasua support" onClose={onClose}>
    <form className="dialog-form" onSubmit={submit}>
      <label className="form-field"><span>What do you need help with?</span><input value={subject} onChange={event => setSubject(event.target.value)} minLength={3} maxLength={160} required /></label>
      <label className="form-field"><span>Describe the issue</span><textarea value={description} onChange={event => setDescription(event.target.value)} minLength={3} maxLength={5000} rows={5} required /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary-button wide-button" type="submit" disabled={busy}>{busy ? "Submitting..." : "Submit support case"}</button>
    </form>
  </Dialog>;
}

function Header({ search, setSearch, cartCount, walletBalance, onWallet, onCart, account, onLogout, demoMode, isGuest = false, onLogin, onRegister }) {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Brand />
        <button className="location-button" type="button">
          <MapPin className="pin" size={17} /><span><strong>Deliver to</strong><small>Masaka, Nasarawa <ChevronDown size={12} /></small></span>
        </button>
        <label className="searchbox"><input value={search} onChange={event => setSearch(event.target.value)} type="search" placeholder="Search tomatoes, rice, traders..." aria-label="Search marketplace" /></label>
        <div className="top-actions">
          {isGuest ? <><button className="text-button header-auth-action" type="button" onClick={onLogin}><LogIn size={17} /><span>Sign in</span></button><button className="primary-button header-auth-action" type="button" onClick={onRegister}><UserPlus size={17} /><span>Create account</span></button></> : <><button className="wallet-link" type="button" onClick={onWallet} disabled={!demoMode} title={demoMode ? "Kasua wallet demo balance" : "Kasua wallet is not connected"}><Wallet size={16} /><span>{demoMode ? formatNaira(walletBalance) : "Wallet unavailable"}</span></button><button className="icon-button" type="button" aria-label="View basket" onClick={onCart}><ShoppingBasket size={17} /><span className="cart-count">{cartCount}</span></button><button className="avatar" type="button" onClick={onLogout} aria-label={`Sign out ${account.name}`} title={`Sign out ${account.name}`}>{account.name.slice(0, 1).toUpperCase()}</button></>}
          {isGuest && <button className="icon-button" type="button" aria-label={`View basket, ${cartCount} items`} onClick={onCart}><ShoppingBasket size={17} /><span className="cart-count">{cartCount}</span></button>}
        </div>
      </div>
    </header>
  );
}

function LandingPage({ onRegister, onLogin }) {
  return <main className="landing-page" id="top">
    <header className="landing-header"><Brand /><nav aria-label="Main navigation"><button className="text-button" type="button" onClick={onLogin}>Login</button><button className="primary-button" type="button" onClick={onRegister}>Create account <ArrowRight size={15} /></button></nav></header>
    <section className="landing-hero"><div className="landing-hero-copy"><div className="hero-kicker"><BadgeCheck size={14} /> Masaka's trusted local market</div><h1>Good food, from your market to your door.</h1><p>Shop verified traders, get your goods checked at the local hub, and have your order delivered across Masaka.</p><div className="landing-actions"><button className="primary-button" type="button" onClick={onRegister}>Get started <ArrowRight size={15} /></button><button className="landing-secondary" type="button" onClick={onLogin}>I already have an account</button></div><div className="landing-location"><MapPin size={15} /> Masaka, Nasarawa State</div></div></section>
    <section className="landing-benefits" aria-label="Kasua marketplace benefits"><div><ShieldCheck size={19} /><span><strong>Checked at the hub</strong><small>Quality checks before dispatch</small></span></div><div><Store size={19} /><span><strong>Local traders</strong><small>Buy directly from Masaka stalls</small></span></div><div><Bike size={19} /><span><strong>Market to your door</strong><small>Order delivery in one place</small></span></div></section>
  </main>;
}

function RegisterPage({ onRegister, onLogin, onHome, demoMode }) {
  const [accountType, setAccountType] = useState("consumer");
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "", phone: "", stall: "", market: "", stallNumber: "", landmark: "", confirmsAccuracy: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  function update(event) {
    const { name, value, checked, type } = event.target;
    setForm(current => ({ ...current, [name]: type === "checkbox" ? checked : value }));
  }
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    if (!demoMode && form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      setBusy(false);
      return;
    }
    const account = { role: accountType, name: form.name.trim(), email: form.email.trim().toLowerCase(), password: form.password, phone: form.phone.trim(), verificationStatus: accountType === "merchant" ? "pending" : "active" };
    if (accountType === "merchant") account.application = { stall: form.stall.trim(), market: form.market.trim(), stallNumber: form.stallNumber.trim(), landmark: form.landmark.trim() };
    try {
      const result = await onRegister(account);
      if (result?.error) setError(result.error);
    } catch (submissionError) {
      setError(submissionError.message || "Could not complete registration.");
    } finally {
      setBusy(false);
    }
  }
  return <div className="auth-page" id="top">
    <AuthHeader onHome={onHome} />
    <main className="account-gate">
    <section className="account-panel">
      <div className="eyebrow"><ShieldCheck size={14} /> Create your Kasua account</div>
      <h1>{accountType === "merchant" ? "Apply to sell on Kasua" : "Register as a consumer"}</h1>
      <p className="account-intro">Each account has one role. Merchant access is enabled only after identity, stall and location checks.</p>
      <div className="role-picker" aria-label="Account type"><button type="button" className={accountType === "consumer" ? "active" : ""} disabled={busy} onClick={() => setAccountType("consumer")}><ShoppingBag size={15} /> Consumer</button><button type="button" className={accountType === "merchant" ? "active" : ""} disabled={busy} onClick={() => setAccountType("merchant")}><Store size={15} /> Merchant</button></div>
      <form className="account-form" onSubmit={submit}>
        <div className="form-field"><label htmlFor="account-name">{accountType === "merchant" ? "Legal name" : "Your name"}</label><input id="account-name" name="name" autoComplete="name" value={form.name} onChange={update} required disabled={busy} /></div>
        {demoMode ? <div className="form-field"><label htmlFor="account-phone">Mobile number</label><input id="account-phone" name="phone" type="tel" autoComplete="tel" value={form.phone} onChange={update} required disabled={busy} placeholder="e.g. 080 1234 5678" /></div> : <>
          <div className="form-field"><label htmlFor="account-email">Email address</label><input id="account-email" name="email" type="email" autoComplete="email" value={form.email} onChange={update} required disabled={busy} /></div>
          <div className="form-row"><div className="form-field"><label htmlFor="account-password">Password</label><input id="account-password" name="password" type="password" autoComplete="new-password" minLength="12" value={form.password} onChange={update} required disabled={busy} /></div><div className="form-field"><label htmlFor="account-confirm-password">Confirm password</label><input id="account-confirm-password" name="confirmPassword" type="password" autoComplete="new-password" minLength="12" value={form.confirmPassword} onChange={update} required disabled={busy} /></div></div>
          {accountType === "merchant" && <div className="form-field"><label htmlFor="merchant-contact-phone">Business contact number (not verified)</label><input id="merchant-contact-phone" name="phone" type="tel" autoComplete="tel" value={form.phone} onChange={update} required disabled={busy} placeholder="e.g. 080 1234 5678" /></div>}
        </>}
        {accountType === "merchant" && <>
          <div className="form-field"><label htmlFor="merchant-stall">Business or stall name</label><input id="merchant-stall" name="stall" value={form.stall} onChange={update} required disabled={busy} /></div>
          <div className="form-row"><div className="form-field"><label htmlFor="merchant-market">Market</label><input id="merchant-market" name="market" value={form.market} onChange={update} required disabled={busy} placeholder="e.g. Masaka Main" /></div><div className="form-field"><label htmlFor="merchant-stall-number">Stall number</label><input id="merchant-stall-number" name="stallNumber" value={form.stallNumber} onChange={update} required disabled={busy} /></div></div>
          <div className="form-field"><label htmlFor="merchant-landmark">Stall location or nearby landmark</label><input id="merchant-landmark" name="landmark" value={form.landmark} onChange={update} required disabled={busy} /></div>
          <div className="verification-requirements"><strong>Required before selling</strong><span>Identity and business ownership review</span><span>Market association and stall confirmation</span><span>In-person stall inspection and location pin</span><span>Product and pricing policy review</span></div>
          <label className="consent-row"><input name="confirmsAccuracy" type="checkbox" checked={form.confirmsAccuracy} onChange={update} required disabled={busy} /><span>I confirm these details are accurate and consent to an in-person stall check.</span></label>
        </>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button wide-button" type="submit" disabled={busy}>{busy ? "Please wait..." : demoMode ? accountType === "merchant" ? "Submit merchant application" : "Create consumer account" : accountType === "merchant" ? "Create merchant account" : "Create consumer account"}</button>
        <p className="fine-print">{demoMode ? "Demo registration is stored in this browser. Do not use it for real customer or merchant data." : "Use a unique email and a password with at least 12 characters. Merchant access remains pending review."}</p>
      </form>
      <p className="auth-switch">Already registered? <button className="text-button" type="button" onClick={onLogin}>Login</button></p>
    </section>
    </main>
  </div>;
}

function LoginPage({ onLogin, onRegister, onHome, demoMode }) {
  const [role, setRole] = useState("consumer");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await onLogin(role, demoMode ? phone : email, password);
      if (result?.error) setError(result.error);
    } catch (loginError) {
      setError(loginError.message || "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }
  return <div className="auth-page" id="top">
    <AuthHeader onHome={onHome} />
    <main className="account-gate">
    <section className="account-panel">
      <div className="eyebrow"><ShieldCheck size={14} /> One account, one role</div>
      <h1>Login to Kasua</h1>
      <p className="account-intro">Choose the role for the account you registered.</p>
      <div className="role-picker" aria-label="Login as"><button type="button" className={role === "consumer" ? "active" : ""} disabled={busy} onClick={() => setRole("consumer")}><ShoppingBag size={15} /> Consumer</button><button type="button" className={role === "merchant" ? "active" : ""} disabled={busy} onClick={() => setRole("merchant")}><Store size={15} /> Merchant</button></div>
      <form className="account-form" onSubmit={submit}>{demoMode ? <div className="form-field"><label htmlFor="login-phone">Mobile number</label><input id="login-phone" name="phone" type="tel" autoComplete="tel" value={phone} onChange={event => setPhone(event.target.value)} required placeholder="e.g. 080 1234 5678" /></div> : <><div className="form-field"><label htmlFor="login-email">Email address</label><input id="login-email" name="email" type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} required /></div><div className="form-field"><label htmlFor="login-password">Password</label><input id="login-password" name="password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required /></div></>}{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button wide-button" type="submit" disabled={busy}>{busy ? "Please wait..." : `Login as ${role}`}</button><p className="fine-print">{demoMode ? "Demo login checks accounts stored in this browser only." : "Email/password sign-in is enabled for pre-release testing. Email ownership is not confirmed."}</p></form>
      <p className="auth-switch">New to Kasua? <button className="text-button" type="button" onClick={onRegister}>Register</button></p>
    </section>
    </main>
  </div>;
}

function StaffLoginPage({ onLogin, onHome }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await onLogin(email, password);
      if (result?.error) setError(result.error);
    } catch (loginError) {
      setError(loginError.message || "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }
  return <div className="auth-page" id="top">
    <AuthHeader onHome={onHome} />
    <main className="account-gate"><section className="account-panel">
      <div className="eyebrow"><ShieldCheck size={14} /> Authorized staff only</div>
      <h1>Staff sign in</h1>
      <p className="account-intro">Use your Kasua staff account. Access is granted only to roles assigned by an administrator.</p>
      <form className="account-form" onSubmit={submit}>
        <div className="form-field"><label htmlFor="staff-email">Email address</label><input id="staff-email" type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} required /></div>
        <div className="form-field"><label htmlFor="staff-password">Password</label><input id="staff-password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required /></div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button wide-button" type="submit" disabled={busy}>{busy ? "Please wait..." : "Sign in to control center"}</button>
      </form>
    </section></main>
  </div>;
}

function MerchantApplicationStatus({ account, onLogout, onResubmit }) {
  const [application, setApplication] = useState(account.application || { stall: "", market: "", stallNumber: "", landmark: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const needsChanges = account.verificationStatus === "needs_changes";
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await onResubmit(application);
      if (result?.error) setError(result.error);
    } catch (submissionError) {
      setError(submissionError.message || "Could not resubmit your application.");
    } finally {
      setBusy(false);
    }
  }
  return <div className="auth-page" id="top">
    <AuthHeader />
    <main className="account-gate">
    <section className="account-panel application-status">
      <div className="eyebrow"><ScanEye size={14} /> Merchant application</div>
      <h1>{needsChanges ? "Changes requested" : "Review in progress"}</h1>
      <p className="account-intro">Hi {account.name}, {account.application?.stall ? <>your application for <strong>{account.application.stall}</strong> is saved.</> : "your merchant application is not complete yet."} Merchant tools remain locked until Kasua completes these checks.</p>
      {needsChanges && <><p className="form-error" role="status">{account.reviewFeedback || "Please review and update your merchant application details."}</p><form className="account-form" onSubmit={submit}>
        <div className="form-field"><label htmlFor="resubmit-store">Store name</label><input id="resubmit-store" value={application.stall} onChange={event => setApplication(current => ({ ...current, stall: event.target.value }))} minLength={2} maxLength={120} required /></div>
        <div className="form-field"><label htmlFor="resubmit-market">Market</label><input id="resubmit-market" value={application.market} onChange={event => setApplication(current => ({ ...current, market: event.target.value }))} minLength={2} maxLength={120} required /></div>
        <div className="form-field"><label htmlFor="resubmit-stall">Stall number</label><input id="resubmit-stall" value={application.stallNumber} onChange={event => setApplication(current => ({ ...current, stallNumber: event.target.value }))} maxLength={40} required /></div>
        <div className="form-field"><label htmlFor="resubmit-landmark">Stall location / landmark</label><input id="resubmit-landmark" value={application.landmark} onChange={event => setApplication(current => ({ ...current, landmark: event.target.value }))} minLength={2} maxLength={240} required /></div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button wide-button" type="submit" disabled={busy}>{busy ? "Submitting..." : "Resubmit for review"}</button>
      </form></>}
      <div className="verification-requirements status-list"><strong>Verification stages</strong><span>1. Review merchant identity and business ownership</span><span>2. Confirm market, stall and association details</span><span>3. Inspect stall and confirm its location in person</span><span>4. Approve the account and enable selling</span></div>
      <p className="fine-print">{demoMode ? "This demo records a pending application in this browser. It does not verify identity or approve merchant access." : "Your application is stored securely. Only an authorized merchant reviewer can change its status."}</p>
      <button className="primary-button wide-button" type="button" onClick={onLogout}>Sign out</button>
    </section>
    </main>
  </div>;
}

function ProductCard({ product, onAdd, disabled = false }) {
  const image = `https://images.unsplash.com/${product.image}?auto=format&fit=crop&w=600&q=80`;
  return (
    <article className="product-card">
      <div className="product-image"><img src={image} alt={product.name} loading="lazy" /><span className="price-note"><BadgeCheck size={11} />{product.note}</span></div>
      <div className="product-info"><h3>{product.name}</h3><div className="seller-line"><BadgeCheck size={12} />{product.seller}{product.rating && <span>· ★ {product.rating}</span>}</div>
        <div className="product-bottom"><div className="product-price">{formatNaira(product.price)}<span className="product-unit">{product.unit}</span></div><button className="icon-button add-button" type="button" aria-label={`Add ${product.name} to basket`} disabled={disabled} onClick={() => onAdd(product)}><Plus size={17} /></button></div>
      </div>
    </article>
  );
}

function CategoryPicker({ activeCategory, onChange }) {
  const iconMap = { grid: Grid2X2, leaf: Leaf, wheat: Wheat, package: Package, fish: Fish, house: House };
  return <div className="categories" aria-label="Product categories">{categories.map(category => {
    const CategoryIcon = iconMap[category.icon];
    const label = category.label || category.name;
    return <button className={`category-chip ${activeCategory === category.name ? "active" : ""}`} key={category.name} type="button" aria-label={label} title={label} aria-pressed={activeCategory === category.name} onClick={() => onChange(category.name)}><CategoryIcon size={18} /><span>{label}</span></button>;
  })}</div>;
}

function MobileBottomNav({ activeItem, onNavigate }) {
  const items = [
    { id: "dashboard", label: "Dashboard", Icon: House },
    { id: "market", label: "Market", Icon: Store },
    { id: "orders", label: "Orders", Icon: ClipboardList },
    { id: "profile", label: "Profile", Icon: UserRound },
  ];
  return <nav className="mobile-bottom-nav" aria-label="Main navigation">
    {items.map(({ id, label, Icon }) => <button key={id} type="button" className={`mobile-nav-item ${activeItem === id ? "active" : ""}`} aria-current={activeItem === id ? "page" : undefined} onClick={() => onNavigate(id)}>
      <Icon size={20} aria-hidden="true" /><span>{label}</span>
    </button>)}
  </nav>;
}

function GuestNavDialog({ type, onClose, onLogin, onRegister }) {
  const isOrders = type === "orders";
  return <Dialog title={isOrders ? "Your orders" : "Your profile"} onClose={onClose}>
    <div className="mobile-nav-dialog">
      <div className="status-icon">{isOrders ? <ClipboardList size={18} /> : <UserRound size={18} />}</div>
      <div><strong>{isOrders ? "Sign in to view your orders" : "Sign in to your profile"}</strong><p>{isOrders ? "Your order history and delivery updates are saved to your Kasua account." : "Sign in to view your account details and shopping preferences."}</p></div>
      <button className="primary-button wide-button" type="button" onClick={onLogin}>Sign in</button>
      <button className="secondary-button wide-button" type="button" onClick={onRegister}>Create account</button>
    </div>
  </Dialog>;
}

const customerPriorityOptions = [
  { id: "value", label: "Good value", description: "Prioritize lower-priced goods", Icon: Coins },
  { id: "produce", label: "Fresh produce", description: "More fruits and vegetables", Icon: Leaf },
  { id: "staples", label: "Everyday staples", description: "Grains, rice and pantry basics", Icon: Wheat },
  { id: "protein", label: "Protein for meals", description: "Meat and fish picks", Icon: Fish },
];

function CustomerDashboard({ accountName, isGuest, products, purchaseHistory, priorities, onTogglePriority, onAdd, onMarket, catalogLoading }) {
  const purchaseCounts = useMemo(() => purchaseHistory.reduce((counts, purchase) => {
    for (const item of purchase.items) {
      if (item.category) counts[item.category] = (counts[item.category] || 0) + item.quantity;
    }
    return counts;
  }, {}), [purchaseHistory]);
  const recommendations = useMemo(() => {
    const categoryPriorities = { produce: ["Produce"], staples: ["Grains", "Pantry"], protein: ["Protein"] };
    const maxPrice = Math.max(0, ...products.map(product => product.price));
    const minPrice = Math.min(maxPrice, ...products.map(product => product.price));
    const priceRange = maxPrice - minPrice;
    return [...products].sort((first, second) => {
      function score(product) {
        let value = (purchaseCounts[product.category] || 0) * 2;
        for (const priority of priorities) {
          if (categoryPriorities[priority]?.includes(product.category)) value += 5;
          if (priority === "value" && priceRange > 0) value += ((maxPrice - product.price) / priceRange) * 2;
        }
        return value;
      }
      return score(second) - score(first) || first.price - second.price;
    }).slice(0, 4);
  }, [products, priorities, purchaseCounts]);
  const recentOrder = purchaseHistory[0];
  const purchasedItems = purchaseHistory.reduce((sum, purchase) => sum + purchase.items.reduce((count, item) => count + item.quantity, 0), 0);

  return <section className="customer-dashboard" aria-labelledby="customer-dashboard-title">
    <div className="dashboard-welcome">
      <div>
        <div className="eyebrow"><Sun size={14} /> Your Kasua dashboard</div>
        <h1 id="customer-dashboard-title">{isGuest ? "Make the market yours" : `Your shopping, ${accountName}`}</h1>
        <section className="hero"><div className="hero-content"><div className="hero-kicker"><BadgeCheck size={14} /> Checked at the Kasua hub</div><h2>Good food, from your market to your door.</h2><p>Shop Masaka's trusted traders. Every order is checked at our local quality hub before delivery.</p><a className="primary-button" href="#products">Explore today's market <ArrowUpRight size={15} /></a></div></section>
        </div>
      </div>

    <div className="dashboard-overview">
      <section className="dashboard-card priority-card" aria-labelledby="priority-heading">
        <div className="dashboard-card-heading"><div><span className="eyebrow">Make it yours</span><h2 id="priority-heading">Your shopping priorities</h2></div><Star size={18} /></div>
        <p>Pick what you care about. You can change these any time.</p>
        <div className="priority-options">{customerPriorityOptions.map(({ id, label, description, Icon }) => {
          const selected = priorities.includes(id);
          return <button key={id} type="button" className={`priority-option ${selected ? "selected" : ""}`} aria-pressed={selected} onClick={() => onTogglePriority(id)}>
            <span className="priority-icon"><Icon size={18} /></span><span className="priority-copy"><strong>{label}</strong><small>{description}</small></span><span className="priority-check" aria-hidden="true">{selected ? <Check size={15} /> : null}</span>
          </button>;
        })}</div>
        <p className="dashboard-note">Your priorities are saved on this device.</p>
      </section>

      <section className="dashboard-card recent-order-card" aria-labelledby="recent-order-heading">
        <div className="dashboard-card-heading"><div><span className="eyebrow">Your activity</span><h2 id="recent-order-heading">Recent shopping</h2></div><ShoppingBasket size={18} /></div>
        {recentOrder ? <>
          <div className="recent-order-summary"><span className="order-reference">Order {recentOrder.id}</span><strong>{recentOrder.items.reduce((sum, item) => sum + item.quantity, 0)} items</strong></div>
          <ul className="recent-order-items">{recentOrder.items.slice(0, 3).map((item, index) => <li key={`${item.name}-${index}`}>{item.name}<span>{item.quantity} × {formatNaira(item.price)}</span></li>)}</ul>
          {recentOrder.items.length > 3 && <p className="dashboard-note">and {recentOrder.items.length - 3} more items</p>}
        </> : <div className="dashboard-empty"><div className="status-icon"><ShoppingBag size={17} /></div><div><strong>Your shopping history starts here</strong><p>After your first order, you’ll see your recent purchases and more relevant suggestions here.</p></div></div>}
        <div className="dashboard-activity"><span><ClipboardList size={15} /> {purchaseHistory.length} orders</span><span><Package size={15} /> {purchasedItems} items purchased</span></div>
      </section>
    </div>

    <section className="dashboard-recommendations" aria-labelledby="recommendations-heading">
      <div className="section-heading"><div><span className="eyebrow">Picked for your priorities</span><h2 id="recommendations-heading">Goods to explore</h2><p>{purchaseHistory.length ? "Shaped by your recent purchases and selected priorities." : "Choose priorities above to tailor these picks to you."}</p></div><button className="text-button" type="button" onClick={onMarket}>See the full market <ArrowRight size={14} /></button></div>
      {catalogLoading ? <div className="empty-state" role="status">Loading market picks...</div> : <div className="product-grid">{recommendations.map(product => <ProductCard key={product.id} product={product} onAdd={onAdd} />)}{!recommendations.length && <div className="empty-state">Market picks will appear here when products are available.</div>}</div>}
    </section>
  </section>;
}

function BasketPanel({ cart, products, totals, onQuantity, onCheckout, onClear, isGuest = false, cartLoading = false }) {
  const availableLines = cart.filter(line => products.some(product => product.id === line.productId));
  const unavailableLines = cart.filter(line => !products.some(product => product.id === line.productId));
  const unavailableCount = unavailableLines.reduce((sum, line) => sum + line.quantity, 0);
  return (
    <section className="side-panel basket-panel" id="cart">
      <div className="side-panel-header"><h2>Your basket</h2><button className="text-button" type="button" disabled={cartLoading} onClick={onClear}>Clear</button></div>
      <div className="basket-content">
        {!availableLines.length ? <div className="delivery-status"><div className="status-icon"><ShoppingBasket size={17} /></div><div><strong>{cart.length ? "Basket items unavailable" : "Your basket is waiting"}</strong><p>{cart.length ? "These items may no longer be listed. Remove them to continue browsing." : "Add market-fresh picks to get started."}</p>{cart.length > 0 && <button className="text-button" type="button" disabled={cartLoading} onClick={() => unavailableLines.forEach(line => onQuantity(line.productId, -line.quantity))}>Remove unavailable items</button>}</div></div> : <>
          {unavailableCount > 0 && <p className="fine-print" role="status">{unavailableCount} basket item(s) are no longer available. <button className="text-button" type="button" disabled={cartLoading} onClick={() => unavailableLines.forEach(line => onQuantity(line.productId, -line.quantity))}>Remove unavailable</button></p>}
          <div className="basket-lines">{availableLines.map(line => {
            const product = products.find(item => item.id === line.productId);
            return <div className="basket-line" key={line.productId}><div><strong>{product.name}</strong><span>{formatNaira(product.price)} each</span></div><div className="quantity-control"><button type="button" aria-label={`Remove one ${product.name}`} disabled={cartLoading} onClick={() => onQuantity(product.id, -1)}>−</button><span>{line.quantity}</span><button type="button" aria-label={`Add one ${product.name}`} disabled={cartLoading || line.quantity >= 99} onClick={() => onQuantity(product.id, 1)}>+</button></div></div>;
          })}</div>
          <div className="order-lines"><div className="order-line"><span>Items subtotal</span><strong>{formatNaira(totals.subtotal)}</strong></div><div className="order-line"><span>Delivery</span><strong>{formatNaira(totals.delivery)}</strong></div><div className="order-line"><span>Service fee</span><strong>{formatNaira(totals.service)}</strong></div><div className="order-line total"><span>Estimated total</span><strong>{formatNaira(totals.total)}</strong></div></div>
          <button className="primary-button wide-button" type="button" disabled={cartLoading} onClick={onCheckout}>{isGuest ? "Sign in to continue" : "Continue to checkout"} <ArrowRight size={15} /></button><p className="fine-print">{cartLoading ? "Loading your saved basket..." : isGuest ? "Your basket is saved on this device. Sign in to continue; payment is not available yet." : "Final weights and market fees are confirmed at the hub."}</p>
        </>}
      </div>
    </section>
  );
}

function WalletPanel({ balance, notify }) {
  return <section className="wallet-panel" id="wallet"><div className="wallet-top"><span>Kasua wallet</span><ShieldCheck size={16} /></div><div className="wallet-balance">{formatNaira(balance)}</div><div className="wallet-actions"><button type="button" onClick={() => notify("Wallet funding will be connected to your payment provider")}>+ Add money</button><button type="button" onClick={() => notify("No recent wallet transactions")}>Activity</button></div></section>;
}

function DeliveryPanel({ order, onTrack }) {
  const stages = ["Trader", "Quality hub", "On the way", "Delivered"];
  return <section className="side-panel"><div className="side-panel-header"><h2>Kasua delivery</h2><Route size={16} className="green-icon" /></div><div className="delivery-body"><div className="delivery-status"><div className="status-icon"><ScanEye size={17} /></div><div><strong>{order.statusLabel}</strong><p>{order.id ? `Order ${order.id} · ${order.area}` : "Every order is checked before dispatch."}</p></div></div><div className="progress-track">{stages.map((stage, index) => <div className={`progress-step ${index <= order.status ? "done" : ""}`} key={stage}><span /></div>)}</div><div className="progress-labels">{stages.map(stage => <span key={stage}>{stage}</span>)}</div><button className="text-button track-link" type="button" onClick={onTrack}>Track latest order <ArrowUpRight size={13} /></button></div></section>;
}

function TrustPanel({ onVerify }) {
  return <section className="side-panel trust-panel"><div className="side-panel-header"><h2>Shop with confidence</h2></div><button className="trust-row trust-action" type="button" onClick={onVerify}><div className="trust-icon"><BadgeCheck size={15} /></div><div><strong>Verified local traders</strong><span>Stalls and locations checked</span></div><ChevronRight className="chev" size={15} /></button><div className="trust-row"><div className="trust-icon reward-icon"><Star size={15} /></div><div><strong>Earn Kasua rewards</strong><span>Rate a completed order to earn points</span></div><ChevronRight className="chev" size={15} /></div></section>;
}

function SupportPanel({ onComplaint, supportCases }) {
  return <section className="side-panel"><div className="side-panel-header"><h2>Need help?</h2><CircleHelp size={16} /></div><div className="basket-content"><p className="account-intro">Tell our support team about an account or order issue.</p><button className="text-button" type="button" onClick={onComplaint}>Open a support case <ArrowRight size={13} /></button>{supportCases.length > 0 && <div className="support-case-list"><strong>Your support cases</strong>{supportCases.map(item => <div key={item.id}><span>{item.subject}</span><small>{item.status.replaceAll("_", " ")} · {new Date(item.updated_at).toLocaleDateString("en-NG")}</small></div>)}</div>}</div></section>;
}

function CustomerOrdersPage({ accountName, isGuest, purchaseHistory, order, onRefreshOrder, onLogin, onRegister, demoMode }) {
  const orders = [...purchaseHistory];
  if (demoMode && order?.id && !orders.some(item => item.id === order.id)) orders.unshift(order);
  const stages = ["Order received", "Quality hub", "On the way", "Delivered"];
  return <section className="customer-page" aria-labelledby="orders-page-title">
    <div className="customer-page-heading"><div><span className="eyebrow"><ClipboardList size={14} /> Order history</span><h1 id="orders-page-title">Your orders</h1><p>Follow your deliveries and review past purchases.</p></div>{!isGuest && <span className="page-count">{orders.length} {orders.length === 1 ? "order" : "orders"}</span>}</div>
    {isGuest ? <section className="customer-page-card customer-page-empty"><div className="status-icon"><ShoppingBag size={18} /></div><div><h2>Sign in to view your orders</h2><p>Your order history and delivery updates are saved to your Kasua account.</p><div className="customer-page-actions"><button className="primary-button" type="button" onClick={onLogin}>Sign in</button><button className="secondary-button" type="button" onClick={onRegister}>Create account</button></div></div></section>
      : orders.length ? <div className="customer-order-list">{orders.map((item, index) => {
        const isCurrent = item.id === order?.id;
        const status = isCurrent ? order.status : item.status;
        const statusLabel = isCurrent ? order.statusLabel : item.statusLabel || "Order placed";
        const itemCount = item.items.reduce((sum, line) => sum + line.quantity, 0);
        const orderDate = item.createdAt ? new Date(item.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }) : item.updatedAt || "Recent";
        return <article className="customer-page-card customer-order-card" key={`${item.id}-${index}`}>
          <div className="customer-order-heading"><div><span className="eyebrow">{isCurrent ? "Latest delivery" : "Previous order"}</span><h2>Order {item.id}</h2><p>{orderDate} · {itemCount} {itemCount === 1 ? "item" : "items"} · {item.area || "Masaka"}</p></div><span className="order-status-pill">{statusLabel}</span></div>
          <ul className="customer-order-items">{item.items.map((line, lineIndex) => <li key={`${line.productId || line.name}-${lineIndex}`}><span>{line.name}<small>Quantity {line.quantity}</small></span><strong>{formatNaira(line.price * line.quantity)}</strong></li>)}</ul>
          {isCurrent && <><div className="order-progress" aria-label="Delivery progress">{stages.map((stage, stageIndex) => <div className={`order-progress-step ${stageIndex <= status ? "complete" : ""}`} key={stage}><span /><small>{stage}</small></div>)}</div><div className="customer-order-footer"><span>Last updated {order.updatedAt}</span><button className="text-button" type="button" onClick={onRefreshOrder}><RefreshCw size={14} /> Refresh status</button></div></>}
        </article>;
      })}</div> : <section className="customer-page-card customer-page-empty"><div className="status-icon"><ShoppingBag size={18} /></div><div><h2>No orders yet</h2><p>Your purchases will appear here once you place an order.</p></div></section>}
    {!isGuest && !demoMode && <p className="customer-page-note">Online order history will appear here when order services are connected.</p>}
    {!isGuest && <p className="customer-page-note">Signed in as {accountName}.</p>}
  </section>;
}

function CustomerProfilePage({ account, isGuest, priorities, onTogglePriority, onLogin, onRegister, onLogout }) {
  return <section className="customer-page" aria-labelledby="profile-page-title">
    <div className="customer-page-heading"><div><span className="eyebrow"><UserRound size={14} /> Account</span><h1 id="profile-page-title">Your profile</h1><p>Manage your Kasua account and shopping preferences.</p></div></div>
    {isGuest ? <section className="customer-page-card customer-page-empty"><div className="profile-summary"><span className="profile-avatar">G</span><div><h2>Browsing as a guest</h2><p>Sign in to keep your account and preferences together.</p></div></div><div className="customer-page-actions"><button className="primary-button" type="button" onClick={onLogin}>Sign in</button><button className="secondary-button" type="button" onClick={onRegister}>Create account</button></div></section>
      : <><section className="customer-page-card customer-profile-card"><div className="profile-summary"><span className="profile-avatar">{account.name.slice(0, 1).toUpperCase()}</span><div><h2>{account.name}</h2><p>Consumer account</p></div><span className="verified-profile"><ShieldCheck size={14} /> Active</span></div><div className="profile-details">{account.email && <div><span>Email address</span><strong>{account.email}</strong></div>}{account.phone && <div><span>Phone number</span><strong>{account.phone}</strong></div>}<div><span>Account type</span><strong>Consumer</strong></div></div></section>
        <section className="customer-page-card profile-preferences"><div className="dashboard-card-heading"><div><span className="eyebrow">Personalize your market</span><h2>Shopping priorities</h2></div><Star size={18} /></div><p>Choose what matters most when we show market picks.</p><div className="priority-options">{customerPriorityOptions.map(({ id, label, description, Icon }) => {
          const selected = priorities.includes(id);
          return <button key={id} type="button" className={`priority-option ${selected ? "selected" : ""}`} aria-pressed={selected} onClick={() => onTogglePriority(id)}><span className="priority-icon"><Icon size={18} /></span><span className="priority-copy"><strong>{label}</strong><small>{description}</small></span><span className="priority-check" aria-hidden="true">{selected ? <Check size={15} /> : null}</span></button>;
        })}</div><p className="dashboard-note">Preferences are saved on this device.</p></section>
        <section className="customer-page-card profile-signout"><div><h2>Sign out</h2><p>Sign out of your Kasua account on this device.</p></div><button className="secondary-button" type="button" onClick={onLogout}><LogOut size={15} /> Sign out</button></section>
      </>}
  </section>;
}

function ShopView({ products, cart, onAdd, onQuantity, onCheckout, onClearCart, walletBalance, notify, search, activeCategory, setActiveCategory, sort, setSort, onVerify, onComplaint, onLogin, onRegister, onLogout, supportCases, order, account, accountName, demoMode, isGuest = false, catalogLoading = false, catalogError = "", cartLoading = false, purchaseHistory, priorities, onTogglePriority, onRefreshOrder }) {
  const [activeNavItem, setActiveNavItem] = useState("market");
  const [navDialog, setNavDialog] = useState(null);
  const deferredSearch = useDeferredValue(search);
  const visibleProducts = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    const result = products.filter(product => (activeCategory === "All items" || product.category === activeCategory) && `${product.name} ${product.seller} ${product.category}`.toLowerCase().includes(query));
    if (sort === "price-low") result.sort((a, b) => a.price - b.price);
    if (sort === "price-high") result.sort((a, b) => b.price - a.price);
    return result;
  }, [products, deferredSearch, activeCategory, sort]);
  const totals = useMemo(() => {
    const subtotal = cart.reduce((sum, line) => sum + (products.find(product => product.id === line.productId)?.price || 0) * line.quantity, 0);
    const delivery = subtotal ? deliveryFee : 0;
    const service = subtotal ? Math.round(subtotal * 0.02) : 0;
    return { subtotal, delivery, service, total: subtotal + delivery + service };
  }, [cart, products]);
  const cartCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  function navigate(item) {
    if (isGuest && (item === "orders" || item === "profile")) {
      setNavDialog(item);
      return;
    }
    setActiveNavItem(item);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  return <>
    <MobileBottomNav activeItem={activeNavItem} onNavigate={navigate} />
    {activeNavItem === "dashboard" ? <CustomerDashboard accountName={accountName} isGuest={isGuest} products={products} purchaseHistory={purchaseHistory} priorities={priorities} onTogglePriority={onTogglePriority} onAdd={onAdd} onMarket={() => navigate("market")} catalogLoading={catalogLoading} /> : <>
    {activeNavItem === "orders" && <CustomerOrdersPage accountName={accountName} isGuest={isGuest} purchaseHistory={purchaseHistory} order={order} onRefreshOrder={onRefreshOrder} onLogin={onLogin} onRegister={onRegister} demoMode={demoMode} />}
    {activeNavItem === "profile" && <CustomerProfilePage account={account} isGuest={isGuest} priorities={priorities} onTogglePriority={onTogglePriority} onLogin={onLogin} onRegister={onRegister} onLogout={onLogout} />}
    {activeNavItem === "market" && <>
    {!demoMode && <div className="backend-banner" role="status"><ShieldCheck size={16} /><span><strong>{isGuest ? "Browse without an account." : "Your account is connected."}</strong> Products and merchant offers are loaded from Supabase. {isGuest ? "Your basket stays on this device. Sign in to continue; checkout and payment are unavailable." : "Checkout and payment are not connected yet."}</span></div>}
    <div className="welcome-row"><div><div className="eyebrow"><Sun size={14} /> Tuesday market, Masaka</div><h1>{isGuest ? "Browse today's market" : `Good morning, ${accountName}`}</h1></div><span className="account-role"><ShoppingBag size={14} /> {isGuest ? "Guest browsing" : "Consumer account"}</span></div>
    <div className="market-layout">
      <div className="main-column">
        <section className="category-section"><div className="section-heading"><h2>Shop by category</h2><button className="text-button" type="button" onClick={() => setActiveCategory("All items")}>See all</button></div><CategoryPicker activeCategory={activeCategory} onChange={setActiveCategory} /></section>
        <section id="products"><div className="section-heading products-heading"><div><h2>Fresh from Masaka</h2><p>Fair market prices, updated by verified traders today</p></div><select className="sort-select" value={sort} onChange={event => setSort(event.target.value)} aria-label="Sort products"><option value="featured">Today's picks</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option></select></div>
          {catalogError && <div className="empty-state" role="alert">{catalogError}</div>}
          {catalogLoading ? <div className="empty-state" role="status">Loading products from Supabase...</div> : <div className="product-grid">{visibleProducts.map(product => <ProductCard key={product.id} product={product} onAdd={onAdd} disabled={cartLoading || ((cart.find(line => line.productId === product.id)?.quantity || 0) >= 99) || (!cart.some(line => line.productId === product.id) && cart.length >= 100)} />)}{visibleProducts.length === 0 && !catalogError && <div className="empty-state">No products match this search. Try another item or category.</div>}</div>}
        </section>
      </div>
      {isGuest ? <aside className="side-column" aria-label="Your basket"><BasketPanel cart={cart} products={products} totals={totals} onQuantity={onQuantity} onCheckout={onCheckout} onClear={onClearCart} isGuest cartLoading={cartLoading} /></aside> : demoMode ? <aside className="side-column" aria-label="Your Kasua account"><WalletPanel balance={walletBalance} notify={notify} /><BasketPanel cart={cart} products={products} totals={totals} onQuantity={onQuantity} onCheckout={() => onCheckout(totals)} onClear={onClearCart} /><DeliveryPanel order={order} onTrack={() => navigate("orders")} /><TrustPanel onVerify={onVerify} /><SupportPanel onComplaint={onComplaint} supportCases={supportCases} /></aside> : <aside className="side-column" aria-label="Account status"><BasketPanel cart={cart} products={products} totals={totals} onQuantity={onQuantity} onCheckout={() => onCheckout(totals)} onClear={onClearCart} cartLoading={cartLoading} /><p className="account-intro">Your account is secure. Checkout and payment are not connected yet.</p><SupportPanel onComplaint={onComplaint} supportCases={supportCases} /></aside>}
    </div>
    <span className="sr-only">{cartCount} items in your basket</span>
    </>}
    </>}
    {navDialog && <GuestNavDialog type={navDialog} onClose={() => setNavDialog(null)} onLogin={() => { setNavDialog(null); onLogin(); }} onRegister={() => { setNavDialog(null); onRegister(); }} />}
  </>;
}

function MerchantView({ inventory, onAddProduct, onVerify, notify, account, demoMode }) {
  if (!demoMode) return <section className="merchant-connect-state"><div className="eyebrow"><Store size={14} /> Merchant account</div><h1>Merchant operations are not connected yet</h1><p>Your account is authenticated and your verification status is recorded. Listings, orders, payouts, and fulfillment will appear here after their server APIs are implemented.</p></section>;
  const sales = 38400;
  return <>
    <div className="welcome-row merchant-welcome"><div><div className="eyebrow"><Sun size={14} /> Tuesday market, Masaka</div><h1>Good morning, {account.name}</h1></div><span className="account-role"><Store size={14} /> Verified merchant</span></div>
    <section className="merchant-banner"><div><div className="hero-kicker"><BadgeCheck size={14} /> Trader workspace</div><h2>Your stall, reaching all of Masaka.</h2><p>Manage today's prices, orders and your Kasua trader reputation in one place.</p></div><button className="primary-button" type="button" onClick={onAddProduct}><Plus size={15} /> Add a product</button></section>
    <div className="merchant-stats"><StatCard label="Today's sales" value={formatNaira(sales)} detail="↑ 12% this week" /><StatCard label="New orders" value="08" detail="3 need confirmation" /><StatCard label="Live products" value={inventory.length} detail="Across 4 categories" /><StatCard label="Trader rating" value={<>{"4.8 "}<span className="star-mark">★</span></>} detail="From 126 local buyers" /></div>
    <div className="market-layout merchant-layout"><section className="side-panel inventory-panel"><div className="side-panel-header"><div><h2>Market inventory</h2><span className="subheading">Your listed products and today's prices</span></div><button className="text-button" type="button" onClick={onAddProduct}>+ Add item</button></div><div className="inventory-wrap"><table className="inventory-table"><thead><tr><th>Product</th><th>Price</th><th>Available</th><th>Price check</th></tr></thead><tbody>{inventory.map(item => <tr key={item.id}><td>{item.name}</td><td>{formatNaira(item.price)}</td><td><span className="stock-pill">{item.stock > 0 ? `${item.stock} in stock` : "Out of stock"}</span></td><td>{item.checked}</td></tr>)}</tbody></table></div></section>
      <aside className="side-column"><section className="verify-panel"><h3><MapPinCheck size={15} /> Verified Kasua trader</h3><p>Your stall and location have been checked. Keep your profile current to build buyer trust.</p><button type="button" onClick={onVerify}>View verification <ArrowRight size={13} /></button></section><section className="side-panel"><div className="side-panel-header"><h2>Orders to prepare</h2><button className="text-button" type="button" onClick={() => notify("All current orders are shown")}>See all</button></div><OrderSummary id="KA-2048" detail="Needs confirmation · 9:42 am" /><OrderSummary id="KA-2042" detail="Hub quality check · 9:10 am" /></section><section className="side-panel merchant-wallet-row"><div className="trust-icon"><Coins size={15} /></div><div><strong>Merchant wallet</strong><span>₦86,200 available · View payouts</span></div><ChevronRight className="chev" size={15} /></section></aside>
    </div>
  </>;
}

function StatCard({ label, value, detail }) { return <div className="stat-card"><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>; }
function OrderSummary({ id, detail }) { return <div className="trust-row"><div className="trust-icon"><PackageCheck size={15} /></div><div><strong>{id} · 2 items</strong><span>{detail}</span></div><ChevronRight className="chev" size={15} /></div>; }

function CheckoutDialog({ totals, walletBalance, onClose, onPlaceOrder }) {
  const [method, setMethod] = useState("wallet");
  const canPayWithWallet = walletBalance >= totals.total;
  return <Dialog title="Review your order" onClose={onClose}><div className="dialog-body"><div className="order-lines"><div className="order-line"><span>Items subtotal</span><strong>{formatNaira(totals.subtotal)}</strong></div><div className="order-line"><span>Delivery to Masaka</span><strong>{formatNaira(totals.delivery)}</strong></div><div className="order-line"><span>Kasua service fee</span><strong>{formatNaira(totals.service)}</strong></div><div className="order-line total"><span>Estimated total</span><strong>{formatNaira(totals.total)}</strong></div></div><div className="payment-label">Choose how to pay</div><div className="payment-options">{paymentMethods.map(payment => <label className={`payment-option ${method === payment.id ? "selected" : ""}`} key={payment.id}><input type="radio" name="payment" value={payment.id} checked={method === payment.id} disabled={payment.id === "wallet" && !canPayWithWallet} onChange={() => setMethod(payment.id)} /><span>{payment.title}</span><small>{payment.id === "wallet" ? `${formatNaira(walletBalance)} available` : payment.detail}</small></label>)}</div>{method === "wallet" && !canPayWithWallet && <p className="form-error">Wallet balance is too low. Choose another payment method.</p>}<button className="primary-button wide-button" type="button" disabled={method === "wallet" && !canPayWithWallet} onClick={() => onPlaceOrder(method, totals)}>Place order · {formatNaira(totals.total)}</button><p className="fine-print">Demo checkout only. Payment providers are not connected yet.</p></div></Dialog>;
}

function ProductDialog({ onClose, onSave }) {
  const [form, setForm] = useState({ name: "", price: "", category: "Produce", unit: "", stock: "" });
  function update(event) { setForm(current => ({ ...current, [event.target.name]: event.target.value })); }
  function submit(event) { event.preventDefault(); onSave({ ...form, price: Number(form.price), stock: Number(form.stock) || 0 }); }
  return <Dialog title="List a market product" onClose={onClose}><form className="dialog-body" onSubmit={submit}><div className="form-field"><label htmlFor="product-name">Product name</label><input id="product-name" name="name" value={form.name} onChange={update} required placeholder="e.g. Sweet potatoes" /></div><div className="form-row"><div className="form-field"><label htmlFor="product-price">Today's price (₦)</label><input id="product-price" name="price" type="number" min="1" value={form.price} onChange={update} required placeholder="e.g. 2500" /></div><div className="form-field"><label htmlFor="product-stock">Quantity available</label><input id="product-stock" name="stock" type="number" min="0" value={form.stock} onChange={update} placeholder="e.g. 12" /></div></div><div className="form-field"><label htmlFor="product-category">Category</label><select id="product-category" name="category" value={form.category} onChange={update}>{categories.filter(category => category.name !== "All items").map(category => <option key={category.name}>{category.name}</option>)}</select></div><div className="form-field"><label htmlFor="product-unit">Unit or quantity</label><input id="product-unit" name="unit" value={form.unit} onChange={update} placeholder="e.g. per basket" /></div><button className="primary-button wide-button" type="submit">List product</button><p className="fine-print">Buyers see your current price and the time you updated it.</p></form></Dialog>;
}

function VerificationDialog({ onClose }) {
  const checks = [["Trader identity confirmed", "Contact details reviewed by Kasua"], ["Stall inspected", "Masaka Main Market · Stall 18"], ["Location verified", "Pin and delivery handoff point confirmed"], ["Marketplace account activated", "Product listing and orders are enabled"]];
  return <Dialog title="Trader verification" onClose={onClose}><div className="dialog-body"><div className="delivery-status tracking-current"><div className="status-icon verified"><BadgeCheck size={18} /></div><div><strong>Verified and active</strong><p>Approved for selling on Kasua Masaka</p></div></div><div className="tracking-steps">{checks.map(([title, detail]) => <div className="delivery-status tracking-step" key={title}><div className="trust-icon"><Check size={15} /></div><div><strong>{title}</strong><p>{detail}</p></div></div>)}</div><p className="fine-print">New trader accounts complete identity, stall and location checks before activation.</p></div></Dialog>;
}

function Toast({ message }) { return <div className={`toast ${message ? "show" : ""}`} role="status" aria-live="polite">{message}</div>; }

export default function App() {
  const [demoAccount, setDemoAccount] = useDemoState(null);
  const [demoAccounts, setDemoAccounts] = useDemoState({});
  const [account, setAccount] = useState(() => demoMode ? demoAccount : null);
  const cartSaveQueue = useRef(Promise.resolve());
  const [authReady, setAuthReady] = useState(!supabaseConfigured);
  const [entryPage, setEntryPage] = useState(() => {
    const path = window.location.pathname.replace(/\/+$/, "") || "/";
    return path === "/admin" ? demoMode ? "admin" : "staff-login" : "landing";
  });
  useEffect(() => {
    function syncEntryPage() {
      const path = window.location.pathname.replace(/\/+$/, "") || "/";
      setEntryPage(path === "/admin" ? demoMode ? "admin" : "staff-login" : "landing");
    }
    window.addEventListener("popstate", syncEntryPage);
    return () => window.removeEventListener("popstate", syncEntryPage);
  }, []);
  const [products, setProducts] = useDemoState(demoMode ? starterProducts : []);
  const [inventory, setInventory] = useDemoState(starterInventory);
  const [cart, setCart] = useLocalCart(demoMode || account?.role !== "consumer");
  const [cartReadyUserId, setCartReadyUserId] = useState(null);
  const [walletBalance, setWalletBalance] = useDemoState(12450);
  const [order, setOrder] = useDemoState(demoOrder);
  const [purchaseHistoryByAccount, setPurchaseHistoryByAccount] = useState(() => {
    const saved = readStored("kasua-purchase-history", {});
    return saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
  });
  const [customerPrioritiesByAccount, setCustomerPrioritiesByAccount] = useState(() => {
    const saved = readStored("kasua-customer-priorities", {});
    return saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
  });
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All items");
  const [sort, setSort] = useState("featured");
  const [dialog, setDialog] = useState(null);
  const [checkoutTotals, setCheckoutTotals] = useState(null);
  const [toast, setToast] = useState("");
  const [supportCases, setSupportCases] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(!demoMode);
  const [catalogError, setCatalogError] = useState("");
  const cartLoading = !demoMode && account?.role === "consumer" && cartReadyUserId !== account.id;
  const customerKey = account?.id ?? "guest";
  const purchaseHistory = purchaseHistoryByAccount[customerKey] || [];
  const customerPriorities = customerPrioritiesByAccount[customerKey] || [];

  useEffect(() => {
    if (demoMode) return undefined;
    let active = true;
    setCatalogLoading(true);
    setCatalogError("");
    loadPublicProducts()
      .then(publicProducts => { if (active) setProducts(publicProducts); })
      .catch(error => { if (active) setCatalogError(`Could not load products from Supabase: ${error.message}`); })
      .finally(() => { if (active) setCatalogLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!demoMode || !demoAccount?.phone) return;
    const phoneKey = demoAccount.phone.replace(/\D/g, "");
    if (phoneKey && !demoAccounts[phoneKey]) setDemoAccounts(current => ({ ...current, [phoneKey]: { ...demoAccount, phoneKey } }));
  }, [demoAccount, demoAccounts, setDemoAccounts]);

  useEffect(() => {
    window.localStorage.setItem("kasua-customer-priorities", JSON.stringify(customerPrioritiesByAccount));
  }, [customerPrioritiesByAccount]);

  useEffect(() => {
    if (demoMode) window.localStorage.setItem("kasua-purchase-history", JSON.stringify(purchaseHistoryByAccount));
  }, [demoMode, purchaseHistoryByAccount]);

  useEffect(() => {
    if (!supabase) return undefined;
    let active = true;
    async function loadSession(session) {
      if (!session?.user) {
        if (active) {
          setAccount(null);
          setAuthReady(true);
        }
        return;
      }
      try {
        const loadedAccount = await loadAccountProfile(session.user.id);
        const staffRoles = await loadStaffRoles(session.user.id);
        if (active) setAccount(staffRoles.length ? { ...loadedAccount, role: "staff", staffRoles } : { ...loadedAccount, email: session.user.email });
      } catch (error) {
        if (active) {
          setAccount(null);
          setToast(`Could not load your account: ${error.message}`);
        }
      } finally {
        if (active) setAuthReady(true);
      }
    }

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        setToast(`Authentication unavailable: ${error.message}`);
        setAuthReady(true);
        return;
      }
      void loadSession(data.session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange(event => {
      if (event === "SIGNED_OUT") {
        setAccount(null);
        setCart([]);
        setCartReadyUserId(null);
        setAuthReady(true);
      }
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (!supabase || account?.role !== "consumer" || !account.id) {
      setSupportCases([]);
      return undefined;
    }
    let active = true;
    loadCustomerComplaints(account.id)
      .then(cases => { if (active) setSupportCases(cases); })
      .catch(error => { if (active) setToast(`Could not load your support cases: ${error.message}`); });
    return () => { active = false; };
  }, [account?.id, account?.role]);

  useEffect(() => {
    if (demoMode || !supabase || account?.role !== "consumer" || !account.id) {
      setCartReadyUserId(null);
      return undefined;
    }
    let active = true;
    setCartReadyUserId(null);
    async function loadCart() {
      const localItems = readStored("kasua-cart", []);
      if (!Array.isArray(localItems)) throw new Error("Saved guest cart has an invalid format.");
      const guestItems = localItems.filter(line =>
        typeof line.productId === "string" && Number.isInteger(line.quantity) && line.quantity > 0,
      ).map(line => ({ offer_id: line.productId, quantity: line.quantity }));
      if (guestItems.length) await mergeGuestCart(account.id, guestItems);
      const savedItems = await loadCustomerCart(account.id);
      if (!active) return;
      setCart(savedItems.map(item => ({ productId: item.offer_id, quantity: item.quantity })));
      window.localStorage.removeItem("kasua-cart");
      setCartReadyUserId(account.id);
    }
    loadCart().catch(error => {
      if (active) setToast(`Could not load your saved basket: ${error.message}`);
    });
    return () => { active = false; };
  }, [account?.id, account?.role]);

  useEffect(() => {
    if (demoMode || !supabase || account?.role !== "consumer" || cartReadyUserId !== account.id) return;
    const items = cart.map(line => ({ offer_id: line.productId, quantity: line.quantity }));
    let active = true;
    cartSaveQueue.current = cartSaveQueue.current.catch(() => undefined).then(() => saveCustomerCart(account.id, items)).catch(error => {
      if (active) setToast(`Could not save your basket to Supabase: ${error.message}`);
    });
    return () => { active = false; };
  }, [account?.id, account?.role, cart, cartReadyUserId]);

  function notify(message) { setToast(message); }
  function toggleCustomerPriority(priority) {
    setCustomerPrioritiesByAccount(current => {
      const selected = current[customerKey] || [];
      return {
        ...current,
        [customerKey]: selected.includes(priority) ? selected.filter(item => item !== priority) : [...selected, priority],
      };
    });
  }
  function addToCart(product) {
    setCart(current => {
      const existing = current.find(line => line.productId === product.id);
      if (existing) return current.map(line => line.productId === product.id ? { ...line, quantity: Math.min(99, line.quantity + 1) } : line);
      return current.length >= 100 ? current : [...current, { productId: product.id, quantity: 1 }];
    });
    notify(`${product.name} added to your basket`);
  }
  function changeQuantity(productId, difference) {
    setCart(current => current.map(line => line.productId === productId ? { ...line, quantity: Math.min(99, line.quantity + difference) } : line).filter(line => line.quantity > 0));
  }
  function openCheckout(totals) {
    if (!account) {
      setEntryPage("login");
      return;
    }
    if (!demoMode) return notify("Checkout is not connected to secure order and payment processing yet.");
    if (!cart.length) return notify("Add an item to your basket first");
    setCheckoutTotals(totals);
    setDialog("checkout");
  }
  function placeOrder(method, totals) {
    if (!demoMode) return notify("Order processing is unavailable until the secure checkout service is connected.");
    const newOrder = {
      id: `KA-${Math.floor(2000 + Math.random() * 7000)}`,
      status: 1,
      statusLabel: "Quality check in progress",
      area: "Masaka North",
      updatedAt: new Intl.DateTimeFormat("en-NG", { hour: "numeric", minute: "2-digit" }).format(new Date()),
      createdAt: new Date().toISOString(),
      items: cart.map(line => {
        const product = products.find(item => item.id === line.productId);
        return { productId: product.id, name: product.name, category: product.category, quantity: line.quantity, price: product.price };
      }),
    };
    setOrder(newOrder);
    setPurchaseHistoryByAccount(current => ({
      ...current,
      [customerKey]: [newOrder, ...(current[customerKey] || [])].slice(0, 20),
    }));
    if (method === "wallet") setWalletBalance(balance => balance - totals.total);
    setCart([]);
    setDialog(null);
    notify(`Order placed with ${method === "ussd" ? "USSD" : method === "wallet" ? "Kasua wallet" : method}. Tracking starts at the quality hub.`);
  }
  function saveProduct(form) {
    const id = `product-${Date.now()}`;
    const item = { id, name: form.name.trim(), category: form.category, price: form.price, stock: form.stock, unit: form.unit.trim() || "per item", seller: "Your verified stall", rating: "New", note: "Price checked", image: "photo-1542838132-92c53300491e" };
    setProducts(current => [item, ...current]);
    setInventory(current => [{ id, name: form.name.trim(), price: form.price, stock: form.stock, checked: "Updated just now" }, ...current]);
    setDialog(null);
    notify(`${item.name} listed at ${formatNaira(item.price)}`);
  }
  function refreshOrder() {
    setOrder(current => ({ ...current, updatedAt: new Intl.DateTimeFormat("en-NG", { hour: "numeric", minute: "2-digit" }).format(new Date()) }));
    notify("Tracking status refreshed");
  }
  async function registerAccount(newAccount) {
    if (!demoMode) {
      if (!supabase) return { error: "Backend is not configured. Add the Supabase URL and anon key to enable registration." };
      if (!newAccount.email || newAccount.password.length < 12) return { error: "Use a valid email and a password with at least 12 characters." };
      const { data, error } = await supabase.auth.signUp({
        email: newAccount.email,
        password: newAccount.password,
        options: {
          data: {
            account_type: newAccount.role,
            full_name: newAccount.name,
            phone: newAccount.phone || "",
          },
        },
      });
      if (error) return { error: error.message };
      if (!data.session) return { error: "Supabase email confirmation is still enabled. Turn it off temporarily for this pre-release test, then try registration again." };
      try {
        const profile = await loadAccountProfile(data.user.id);
        if (profile.role !== newAccount.role) {
          await supabase.auth.signOut();
          return { error: `This email already belongs to a ${profile.role} account.` };
        }
        if (newAccount.phone) {
          const { error: contactError } = await supabase
            .from("profiles")
            .update({ phone: newAccount.phone })
            .eq("id", data.user.id);
          if (contactError) throw contactError;
        }
        if (newAccount.role === "merchant") {
          const application = newAccount.application;
          const { error: applicationError } = await supabase.from("merchant_profiles").insert({
            user_id: data.user.id,
            store_name: application.stall,
            market_name: application.market,
            stall_number: application.stallNumber,
            landmark: application.landmark,
            verification_status: "pending",
          });
          if (applicationError && applicationError.code !== "23505") throw applicationError;
        }
        setAccount(await loadAccountProfile(data.user.id));
        return null;
      } catch (registrationError) {
        await supabase.auth.signOut();
        return { error: registrationError.message || "Could not save your application." };
      }
    }

    const phoneKey = newAccount.phone.replace(/\D/g, "");
    if (phoneKey.length < 7) return { error: "Enter a valid mobile number." };
    if (demoAccounts[phoneKey]) return { error: "An account already uses this number. Login with its registered role." };
    const savedAccount = { ...newAccount, phoneKey };
    setDemoAccounts(current => ({ ...current, [phoneKey]: savedAccount }));
    setDemoAccount(savedAccount);
    setAccount(savedAccount);
    return null;
  }
  async function loginAccount(role, identifier, password) {
    if (!demoMode) {
      if (!supabase) return { error: "Backend is not configured. Add the Supabase URL and anon key to enable login." };
      if (!identifier || !password) return { error: "Enter your email and password." };
      const { data, error } = await supabase.auth.signInWithPassword({ email: identifier.trim().toLowerCase(), password });
      if (error) return { error: error.message };
      try {
        const loadedAccount = await loadAccountProfile(data.user.id);
        if (loadedAccount.role !== role) {
          await supabase.auth.signOut();
          return { error: `This number is registered as a ${loadedAccount.role}. Choose that role to continue.` };
        }
        setAccount({ ...loadedAccount, email: data.user.email });
        return null;
      } catch (loginError) {
        await supabase.auth.signOut();
        return { error: loginError.message || "Could not load your account." };
      }
    }

    const phoneKey = identifier.replace(/\D/g, "");
    const savedAccount = demoAccounts[phoneKey];
    if (!savedAccount) return { error: "No account found for that number. Register first." };
    if (savedAccount.role !== role) return { error: `This number is registered as a ${savedAccount.role}. Choose that role to continue.` };
    setDemoAccount(savedAccount);
    setAccount(savedAccount);
    return null;
  }
  async function loginStaffAccount(email, password) {
    if (!supabase) return { error: "Staff sign-in requires a configured Supabase project." };
    if (!email.trim() || !password) return { error: "Enter your staff email and password." };
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error) return { error: error.message };
    try {
      const [profile, staffRoles] = await Promise.all([
        loadAccountProfile(data.user.id),
        loadStaffRoles(data.user.id),
      ]);
      if (!staffRoles.length) {
        await supabase.auth.signOut();
        return { error: "This account has no assigned staff role. Contact your administrator." };
      }
      setAccount({ ...profile, role: "staff", staffRoles });
      return null;
    } catch (loginError) {
      await supabase.auth.signOut();
      return { error: loginError.message || "Could not verify staff access." };
    }
  }
  async function submitCustomerComplaint(subject, description) {
    if (demoMode) throw new Error("Support cases require a connected account.");
    const newCase = await createComplaint(account.id, subject, description);
    setSupportCases(current => [newCase, ...current]);
    setDialog(null);
    notify("Your support case has been opened. Kasua support will review it.");
  }
  async function resubmitMerchantApplication(application) {
    if (!supabase) return { error: "Merchant application updates require a configured backend." };
    const { error } = await supabase.rpc("resubmit_merchant_application", {
      new_store_name: application.stall,
      new_market_name: application.market,
      new_stall_number: application.stallNumber,
      new_landmark: application.landmark,
    });
    if (error) return { error: error.message };
    setAccount(current => ({
      ...current,
      application,
      verificationStatus: "pending",
      reviewFeedback: "",
    }));
    return null;
  }
  function logout() {
    if (window.location.pathname.replace(/\/+$/, "") === "/admin") window.history.replaceState(null, "", "/");
    setEntryPage("landing");
    if (demoMode) {
      setAccount(null);
      setDemoAccount(null);
      return;
    }
    if (supabase) void supabase.auth.signOut();
  }
  const cartCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const productHandler = () => {
    if (!demoMode) return notify("Product management will be enabled when the merchant API is connected.");
    setDialog("addProduct");
  };

  if (!authReady && entryPage !== "landing") return <div className="auth-page"><AuthHeader /><main className="account-gate"><section className="account-panel" role="status">Loading your secure account...</section></main></div>;
  if (!account) {
    if (entryPage === "register") return <RegisterPage onRegister={registerAccount} onLogin={() => setEntryPage("login")} onHome={() => setEntryPage("landing")} demoMode={demoMode} />;
    if (entryPage === "login") return <LoginPage onLogin={loginAccount} onRegister={() => setEntryPage("register")} onHome={() => setEntryPage("landing")} demoMode={demoMode} />;
    if (entryPage === "staff-login" && !demoMode) return <StaffLoginPage onLogin={loginStaffAccount} onHome={() => setEntryPage("landing")} />;
    if (entryPage === "admin" && demoMode) return <AdminView onExit={() => { window.history.replaceState(null, "", "/"); setEntryPage("landing"); }} isDemo />;
    return <div className="app-shell" id="top">
      <Header search={search} setSearch={setSearch} cartCount={cart.reduce((sum, line) => sum + line.quantity, 0)} walletBalance={walletBalance} onCart={() => document.getElementById("cart")?.scrollIntoView({ behavior: "smooth", block: "center" })} account={null} onLogout={() => {}} demoMode={demoMode} isGuest onLogin={() => setEntryPage("login")} onRegister={() => setEntryPage("register")} />
      <ShopView products={products} cart={cart} onAdd={addToCart} onQuantity={changeQuantity} onCheckout={() => openCheckout(null)} onClearCart={() => setCart([])} walletBalance={walletBalance} notify={notify} search={search} activeCategory={activeCategory} setActiveCategory={setActiveCategory} sort={sort} setSort={setSort} supportCases={[]} order={order} account={null} accountName="Guest" onLogin={() => setEntryPage("login")} onRegister={() => setEntryPage("register")} onLogout={() => {}} onRefreshOrder={refreshOrder} purchaseHistory={purchaseHistory} priorities={customerPriorities} onTogglePriority={toggleCustomerPriority} demoMode={demoMode} isGuest catalogLoading={catalogLoading} catalogError={catalogError} />
      <Toast message={toast} />
    </div>;
  }
  if (account.staffRoles?.length) return <AdminView account={account} onExit={logout} />;
  if (account.role === "merchant" && account.verificationStatus !== "verified") return <MerchantApplicationStatus account={account} onLogout={logout} onResubmit={resubmitMerchantApplication} />;

  return <div className="app-shell" id="top">
    <Header search={search} setSearch={setSearch} cartCount={cartCount} walletBalance={walletBalance} onWallet={() => document.getElementById("wallet")?.scrollIntoView({ behavior: "smooth", block: "center" })} onCart={() => document.getElementById("cart")?.scrollIntoView({ behavior: "smooth", block: "center" })} account={account} onLogout={logout} demoMode={demoMode} />
    <main>{account.role === "consumer" ? <ShopView products={products} cart={cart} onAdd={addToCart} onQuantity={changeQuantity} onCheckout={openCheckout} onClearCart={() => { setCart([]); notify("Basket cleared"); }} walletBalance={walletBalance} notify={notify} search={search} activeCategory={activeCategory} setActiveCategory={setActiveCategory} sort={sort} setSort={setSort} order={order} account={account} accountName={account.name} onVerify={() => setDialog("verification")} onComplaint={() => demoMode ? notify("Support cases are available when the backend is connected.") : setDialog("complaint")} onLogin={() => setEntryPage("login")} onRegister={() => setEntryPage("register")} onLogout={logout} onRefreshOrder={refreshOrder} supportCases={supportCases} purchaseHistory={purchaseHistory} priorities={customerPriorities} onTogglePriority={toggleCustomerPriority} demoMode={demoMode} cartLoading={cartLoading} catalogLoading={catalogLoading} catalogError={catalogError} /> : <MerchantView inventory={inventory} onAddProduct={productHandler} onVerify={() => setDialog("verification")} notify={notify} account={account} demoMode={demoMode} />}</main>
    {dialog === "checkout" && checkoutTotals && <CheckoutDialog totals={checkoutTotals} walletBalance={walletBalance} onClose={() => setDialog(null)} onPlaceOrder={placeOrder} />}
    {dialog === "addProduct" && <ProductDialog onClose={() => setDialog(null)} onSave={saveProduct} />}
    {dialog === "verification" && <VerificationDialog onClose={() => setDialog(null)} />}
    {dialog === "complaint" && <ComplaintDialog onClose={() => setDialog(null)} onSubmit={submitCustomerComplaint} />}
    <Toast message={toast} />
  </div>;
}
