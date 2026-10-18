import { useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  ArrowRight, ArrowUpRight, BadgeCheck, Bike, Check, ChevronDown, ChevronRight,
  CircleHelp, Coins, Fish, Grid2X2, House, Leaf, MapPin, MapPinCheck, Package,
  PackageCheck, Plus, RefreshCw, Route, ScanEye, Search, ShieldCheck, ShoppingBag,
  ShoppingBasket, Star, Store, Sun, Wallet, Wheat, X,
} from "lucide-react";
import { categories, demoOrder, formatNaira, readStored, starterInventory, starterProducts } from "./data.js";
import AdminView from "./AdminView.jsx";
import { demoMode, loadAccountProfile, supabase, supabaseConfigured } from "./lib/supabase.js";

const paymentMethods = [
  { id: "wallet", title: "Kasua wallet", detail: "Wallet balance" },
  { id: "paystack", title: "Paystack", detail: "Card or bank" },
  { id: "flutterwave", title: "Flutterwave", detail: "Card or transfer" },
  { id: "ussd", title: "USSD", detail: "Works on any phone" },
];
const deliveryFee = 500;

function usePersistentState(key, initialValue) {
  const [value, setValue] = useState(() => demoMode ? readStored(key, initialValue) : initialValue);
  useEffect(() => {
    if (demoMode) window.localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);
  return [value, setValue];
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

function Header({ search, setSearch, cartCount, walletBalance, onWallet, onCart, account, onLogout, demoMode }) {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Brand />
        <button className="location-button" type="button" onClick={() => notify("Delivery location: Masaka, Nasarawa")}>
          <MapPin className="pin" size={17} /><span><strong>Deliver to</strong><small>Masaka, Nasarawa <ChevronDown size={12} /></small></span>
        </button>
        <label className="searchbox"><Search size={17} /><input value={search} onChange={event => setSearch(event.target.value)} type="search" placeholder="Search tomatoes, rice, traders..." aria-label="Search marketplace" /></label>
        <div className="top-actions">
          <button className="wallet-link" type="button" onClick={onWallet} disabled={!demoMode} title={demoMode ? "Kasua wallet demo balance" : "Wallet is not connected yet"}><Wallet size={16} /><span>{demoMode ? formatNaira(walletBalance) : "Wallet unavailable"}</span></button>
          <IconButton label="View basket" onClick={onCart} disabled={!demoMode}><ShoppingBasket size={17} />{demoMode && <span className="cart-count">{cartCount}</span>}</IconButton>
          <button className="avatar" type="button" onClick={onLogout} aria-label={`Sign out ${account.name}`} title={`Sign out ${account.name}`}>{account.name.slice(0, 1).toUpperCase()}</button>
        </div>
      </div>
    </header>
  );
}

function LandingPage({ onRegister, onLogin, onAdmin }) {
  return <main className="landing-page" id="top">
    <header className="landing-header"><Brand /><nav aria-label="Main navigation">{onAdmin && <button className="text-button" type="button" onClick={onAdmin}>Admin preview</button>}<button className="text-button" type="button" onClick={onLogin}>Login</button><button className="primary-button" type="button" onClick={onRegister}>Create account <ArrowRight size={15} /></button></nav></header>
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

function MerchantApplicationStatus({ account, onLogout }) {
  return <div className="auth-page" id="top">
    <AuthHeader />
    <main className="account-gate">
    <section className="account-panel application-status">
      <div className="eyebrow"><ScanEye size={14} /> Merchant application</div>
      <h1>Review in progress</h1>
      <p className="account-intro">Hi {account.name}, {account.application?.stall ? <>your application for <strong>{account.application.stall}</strong> is saved.</> : "your merchant application is not complete yet."} Merchant tools remain locked until Kasua completes these checks.</p>
      <div className="verification-requirements status-list"><strong>Verification stages</strong><span>1. Review merchant identity and business ownership</span><span>2. Confirm market, stall and association details</span><span>3. Inspect stall and confirm its location in person</span><span>4. Approve the account and enable selling</span></div>
      <p className="fine-print">This demo records a pending application in this browser. It does not verify identity or approve merchant access.</p>
      <button className="primary-button wide-button" type="button" onClick={onLogout}>Sign out</button>
    </section>
    </main>
  </div>;
}

function ProductCard({ product, onAdd, canPurchase }) {
  const image = `https://images.unsplash.com/${product.image}?auto=format&fit=crop&w=600&q=80`;
  return (
    <article className="product-card">
      <div className="product-image"><img src={image} alt={product.name} loading="lazy" /><span className="price-note"><BadgeCheck size={11} />{product.note}</span></div>
      <div className="product-info"><h3>{product.name}</h3><div className="seller-line"><BadgeCheck size={12} />{product.seller}<span>· ★ {product.rating}</span></div>
        <div className="product-bottom"><div className="product-price">{formatNaira(product.price)}<span className="product-unit">{product.unit}</span></div><button className="icon-button add-button" type="button" aria-label={canPurchase ? `Add ${product.name} to basket` : `Purchasing unavailable for ${product.name}`} disabled={!canPurchase} onClick={() => onAdd(product)}><Plus size={17} /></button></div>
      </div>
    </article>
  );
}

function CategoryPicker({ activeCategory, onChange }) {
  const iconMap = { grid: Grid2X2, leaf: Leaf, wheat: Wheat, package: Package, fish: Fish, house: House };
  return <div className="categories" aria-label="Product categories">{categories.map(category => {
    const CategoryIcon = iconMap[category.icon];
    return <button className={`category-chip ${activeCategory === category.name ? "active" : ""}`} key={category.name} type="button" onClick={() => onChange(category.name)}><CategoryIcon size={15} />{category.label || category.name}</button>;
  })}</div>;
}

function BasketPanel({ cart, products, totals, onQuantity, onCheckout, onClear }) {
  return (
    <section className="side-panel basket-panel" id="cart">
      <div className="side-panel-header"><h2>Your basket</h2><button className="text-button" type="button" onClick={onClear}>Clear</button></div>
      <div className="basket-content">
        {!cart.length ? <div className="delivery-status"><div className="status-icon"><ShoppingBasket size={17} /></div><div><strong>Your basket is waiting</strong><p>Add market-fresh picks to get started.</p></div></div> : <>
          <div className="basket-lines">{cart.map(line => {
            const product = products.find(item => item.id === line.productId);
            if (!product) return null;
            return <div className="basket-line" key={line.productId}><div><strong>{product.name}</strong><span>{formatNaira(product.price)} each</span></div><div className="quantity-control"><button type="button" aria-label={`Remove one ${product.name}`} onClick={() => onQuantity(product.id, -1)}>−</button><span>{line.quantity}</span><button type="button" aria-label={`Add one ${product.name}`} onClick={() => onQuantity(product.id, 1)}>+</button></div></div>;
          })}</div>
          <div className="order-lines"><div className="order-line"><span>Items subtotal</span><strong>{formatNaira(totals.subtotal)}</strong></div><div className="order-line"><span>Delivery</span><strong>{formatNaira(totals.delivery)}</strong></div><div className="order-line"><span>Service fee</span><strong>{formatNaira(totals.service)}</strong></div><div className="order-line total"><span>Estimated total</span><strong>{formatNaira(totals.total)}</strong></div></div>
          <button className="primary-button wide-button" type="button" onClick={onCheckout}>Continue to checkout <ArrowRight size={15} /></button><p className="fine-print">Final weights and market fees are confirmed at the hub.</p>
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

function ShopView({ products, cart, onAdd, onQuantity, onCheckout, onClearCart, walletBalance, notify, search, activeCategory, setActiveCategory, sort, setSort, onTrack, onVerify, order, accountName, demoMode }) {
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
  return <>
    <div className="mobile-location"><MapPin size={14} /> Delivering to <strong>Masaka, Nasarawa</strong></div>
    {!demoMode && <div className="backend-banner" role="status"><ShieldCheck size={16} /><span><strong>Account security is connected.</strong> This sample catalog is for preview only; live offers, cart, checkout, and delivery tracking are not connected yet.</span></div>}
    <div className="welcome-row"><div><div className="eyebrow"><Sun size={14} /> Tuesday market, Masaka</div><h1>Good morning, {accountName}</h1></div><span className="account-role"><ShoppingBag size={14} /> Consumer account</span></div>
    <div className="market-layout">
      <div className="main-column">
        <section className="hero"><div className="hero-content"><div className="hero-kicker"><BadgeCheck size={14} /> Checked at the Kasua hub</div><h2>Good food, from your market to your door.</h2><p>Shop Masaka's trusted traders. Every order is checked at our local quality hub before delivery.</p><a className="primary-button" href="#products">Explore today's market <ArrowUpRight size={15} /></a></div></section>
        <section className="category-section"><div className="section-heading"><h2>Shop by category</h2><button className="text-button" type="button" onClick={() => setActiveCategory("All items")}>See all</button></div><CategoryPicker activeCategory={activeCategory} onChange={setActiveCategory} /></section>
        <section id="products"><div className="section-heading products-heading"><div><h2>Fresh from Masaka</h2><p>Fair market prices, updated by verified traders today</p></div><select className="sort-select" value={sort} onChange={event => setSort(event.target.value)} aria-label="Sort products"><option value="featured">Today's picks</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option></select></div>
          <div className="product-grid">{visibleProducts.map(product => <ProductCard key={product.id} product={product} onAdd={onAdd} canPurchase={demoMode} />)}{visibleProducts.length === 0 && <div className="empty-state">No products match that search. Try another item or category.</div>}</div>
        </section>
      </div>
      {demoMode ? <aside className="side-column" aria-label="Your Kasua account"><WalletPanel balance={walletBalance} notify={notify} /><BasketPanel cart={cart} products={products} totals={totals} onQuantity={onQuantity} onCheckout={() => onCheckout(totals)} onClear={onClearCart} /><DeliveryPanel order={order} onTrack={onTrack} /><TrustPanel onVerify={onVerify} /></aside> : <aside className="side-column" aria-label="Account status"><section className="side-panel"><div className="side-panel-header"><h2>Marketplace services</h2></div><div className="basket-content"><p className="account-intro">Your account is secure. Order placement and fulfillment will be enabled after their server-side workflows are connected.</p></div></section></aside>}
    </div>
    <span className="sr-only">{cartCount} items in your basket</span>
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

function TrackingDialog({ order, onClose, onRefresh }) {
  const steps = [{ title: "Order received", detail: "Trader is preparing your goods", icon: Check }, { title: "Hub quality check", detail: "Weights and product quality being verified", icon: ScanEye }, { title: "Rider dispatch", detail: "Rider details appear when assigned", icon: Bike }, { title: "Delivered to you", detail: "Rate your order and earn Kasua points", icon: MapPin }];
  return <Dialog title={`Track order ${order.id}`} onClose={onClose}><div className="dialog-body"><div className="delivery-status tracking-current"><div className="status-icon"><ScanEye size={18} /></div><div><strong>{order.statusLabel}</strong><p>Kasua aggregation hub · Masaka</p></div></div><div className="order-lines tracking-details"><div className="order-line"><span>Next step</span><strong>{order.status >= 2 ? "Delivery confirmation" : "Rider dispatch"}</strong></div><div className="order-line"><span>Delivery area</span><strong>{order.area}</strong></div><div className="order-line"><span>Last update</span><strong>{order.updatedAt}</strong></div></div><div className="tracking-steps">{steps.map((step, index) => { const StepIcon = step.icon; return <div className={`delivery-status tracking-step ${index <= order.status ? "complete" : "pending"}`} key={step.title}><div className="trust-icon">{index < order.status ? <Check size={15} /> : <StepIcon size={15} />}</div><div><strong>{step.title}</strong><p>{step.detail}</p></div></div>; })}</div><button className="primary-button wide-button" type="button" onClick={onRefresh}><RefreshCw size={14} /> Refresh tracking</button><p className="fine-print">Demo status is local to this browser. Live rider location needs the logistics API.</p></div></Dialog>;
}

function VerificationDialog({ onClose }) {
  const checks = [["Trader identity confirmed", "Contact details reviewed by Kasua"], ["Stall inspected", "Masaka Main Market · Stall 18"], ["Location verified", "Pin and delivery handoff point confirmed"], ["Marketplace account activated", "Product listing and orders are enabled"]];
  return <Dialog title="Trader verification" onClose={onClose}><div className="dialog-body"><div className="delivery-status tracking-current"><div className="status-icon verified"><BadgeCheck size={18} /></div><div><strong>Verified and active</strong><p>Approved for selling on Kasua Masaka</p></div></div><div className="tracking-steps">{checks.map(([title, detail]) => <div className="delivery-status tracking-step" key={title}><div className="trust-icon"><Check size={15} /></div><div><strong>{title}</strong><p>{detail}</p></div></div>)}</div><p className="fine-print">New trader accounts complete identity, stall and location checks before activation.</p></div></Dialog>;
}

function Toast({ message }) { return <div className={`toast ${message ? "show" : ""}`} role="status" aria-live="polite">{message}</div>; }

export default function App() {
  const [demoAccount, setDemoAccount] = usePersistentState("kasua-account", null);
  const [demoAccounts, setDemoAccounts] = usePersistentState("kasua-accounts", {});
  const [account, setAccount] = useState(() => demoMode ? demoAccount : null);
  const [authReady, setAuthReady] = useState(!supabaseConfigured);
  const [entryPage, setEntryPage] = useState("landing");
  const [products, setProducts] = usePersistentState("kasua-products", starterProducts);
  const [inventory, setInventory] = usePersistentState("kasua-inventory", starterInventory);
  const [cart, setCart] = usePersistentState("kasua-cart", []);
  const [walletBalance, setWalletBalance] = usePersistentState("kasua-wallet", 12450);
  const [order, setOrder] = usePersistentState("kasua-order", demoOrder);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All items");
  const [sort, setSort] = useState("featured");
  const [dialog, setDialog] = useState(null);
  const [checkoutTotals, setCheckoutTotals] = useState(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!demoMode || !demoAccount?.phone) return;
    const phoneKey = demoAccount.phone.replace(/\D/g, "");
    if (phoneKey && !demoAccounts[phoneKey]) setDemoAccounts(current => ({ ...current, [phoneKey]: { ...demoAccount, phoneKey } }));
  }, [demoAccount, demoAccounts, setDemoAccounts]);

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
        if (active) setAccount(loadedAccount);
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

  function notify(message) { setToast(message); }
  function addToCart(product) {
    setCart(current => {
      const existing = current.find(line => line.productId === product.id);
      return existing ? current.map(line => line.productId === product.id ? { ...line, quantity: line.quantity + 1 } : line) : [...current, { productId: product.id, quantity: 1 }];
    });
    notify(`${product.name} added to your basket`);
  }
  function changeQuantity(productId, difference) {
    setCart(current => current.map(line => line.productId === productId ? { ...line, quantity: line.quantity + difference } : line).filter(line => line.quantity > 0));
  }
  function openCheckout(totals) {
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
      items: cart.map(line => {
        const product = products.find(item => item.id === line.productId);
        return { name: product.name, quantity: line.quantity, price: product.price };
      }),
    };
    setOrder(newOrder);
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
        setAccount(loadedAccount);
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
  function logout() {
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

  if (!authReady) return <div className="auth-page"><AuthHeader /><main className="account-gate"><section className="account-panel" role="status">Loading your secure account...</section></main></div>;
  if (!account) {
    if (entryPage === "register") return <RegisterPage onRegister={registerAccount} onLogin={() => setEntryPage("login")} onHome={() => setEntryPage("landing")} demoMode={demoMode} />;
    if (entryPage === "login") return <LoginPage onLogin={loginAccount} onRegister={() => setEntryPage("register")} onHome={() => setEntryPage("landing")} demoMode={demoMode} />;
    if (entryPage === "admin" && demoMode) return <AdminView onExit={() => setEntryPage("landing")} />;
    return <LandingPage onRegister={() => setEntryPage("register")} onLogin={() => setEntryPage("login")} onAdmin={demoMode ? () => setEntryPage("admin") : undefined} />;
  }
  if (account.role === "merchant" && account.verificationStatus !== "verified") return <MerchantApplicationStatus account={account} onLogout={logout} />;

  return <div className="app-shell" id="top">
    <Header search={search} setSearch={setSearch} cartCount={cartCount} walletBalance={walletBalance} onWallet={() => document.getElementById("wallet")?.scrollIntoView({ behavior: "smooth", block: "center" })} onCart={() => document.getElementById("cart")?.scrollIntoView({ behavior: "smooth", block: "center" })} account={account} onLogout={logout} demoMode={demoMode} />
    <main>{account.role === "consumer" ? <ShopView products={products} cart={cart} onAdd={addToCart} onQuantity={changeQuantity} onCheckout={openCheckout} onClearCart={() => { setCart([]); notify("Basket cleared"); }} walletBalance={walletBalance} notify={notify} search={search} activeCategory={activeCategory} setActiveCategory={setActiveCategory} sort={sort} setSort={setSort} order={order} accountName={account.name} onTrack={() => setDialog("tracking")} onVerify={() => setDialog("verification")} demoMode={demoMode} /> : <MerchantView inventory={inventory} onAddProduct={productHandler} onVerify={() => setDialog("verification")} notify={notify} account={account} demoMode={demoMode} />}</main>
    {dialog === "checkout" && checkoutTotals && <CheckoutDialog totals={checkoutTotals} walletBalance={walletBalance} onClose={() => setDialog(null)} onPlaceOrder={placeOrder} />}
    {dialog === "addProduct" && <ProductDialog onClose={() => setDialog(null)} onSave={saveProduct} />}
    {dialog === "tracking" && <TrackingDialog order={order} onClose={() => setDialog(null)} onRefresh={refreshOrder} />}
    {dialog === "verification" && <VerificationDialog onClose={() => setDialog(null)} />}
    <Toast message={toast} />
  </div>;
}
