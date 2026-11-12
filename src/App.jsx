import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight, ArrowUpRight, BadgeCheck, Bell, Bike, Check, ChevronDown, ChevronRight,
  CircleHelp, ClipboardList, Clock3, Coins, Fish, Grid2X2, House, Leaf, MapPin, MapPinCheck, Package,
  LogIn, LogOut, MessageCircle, PackageCheck, Plus, RefreshCw, Route, ScanEye, ShieldAlert, ShieldCheck, ShoppingBag,
  ShoppingBasket, Star, Store, Sun, TrendingUp, Truck, UserPlus, UserRound, Wallet, Wheat, X,
} from "lucide-react";
import {
  categories, demoOrder, formatNaira, readStored, starterInventory, starterMerchantOrders,
  starterMerchantInsights, starterMerchantPayouts, starterMerchantQuestions, starterProducts,
} from "./data.js";
import AdminView from "./AdminView.jsx";
import { loadStaffRoles } from "./lib/admin.js";
import { loadCustomerCart, mergeGuestCart, saveCustomerCart } from "./lib/cart.js";
import { loadPublicProducts } from "./lib/catalog.js";
import { createComplaint, loadCustomerComplaints } from "./lib/complaints.js";
import {
  loadMerchantProducts, saveMerchantProduct, validateMerchantProductPhoto,
} from "./lib/merchant-products.js";
import {
  loadMerchantOrders, loadMerchantPayouts, updateMerchantOrderStatus,
} from "./lib/merchant-orders.js";
import {
  answerMerchantQuestion, askMerchantQuestion, loadCustomerMerchantQuestions,
  loadMerchantInsights, loadMerchantQuestions,
} from "./lib/merchant-insights.js";
import {
  MERCHANT_DOCUMENT_MAX_BYTES, MERCHANT_POLICY_VERSION,
  removeMerchantDocuments, uploadMerchantDocuments, validateMerchantDocuments,
} from "./lib/merchant-onboarding.js";
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
          {isGuest ? <><button className="text-button header-auth-action" type="button" aria-label="Sign in" onClick={onLogin}><LogIn size={17} /><span>Sign in</span></button><button className="primary-button header-auth-action" type="button" aria-label="Create account" onClick={onRegister}><UserPlus size={17} /><span>Create account</span></button></> : <><button className="wallet-link" type="button" onClick={onWallet} disabled={!demoMode} title={demoMode ? "Kasua wallet demo balance" : "Kasua wallet is not connected"}><Wallet size={16} /><span>{demoMode ? formatNaira(walletBalance) : "Wallet unavailable"}</span></button><button className="icon-button" type="button" aria-label="View basket" onClick={onCart}><ShoppingBasket size={17} /><span className="cart-count">{cartCount}</span></button><button className="avatar" type="button" onClick={onLogout} aria-label={`Sign out ${account.name}`} title={`Sign out ${account.name}`}>{account.name.slice(0, 1).toUpperCase()}</button></>}
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
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "", phone: "" });
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
    const account = { role: "consumer", name: form.name.trim(), email: form.email.trim().toLowerCase(), password: form.password, phone: form.phone.trim(), verificationStatus: "active" };
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
    <section className={`account-panel ${accountType === "merchant" ? "merchant-account-panel" : ""}`}>
      <div className="eyebrow"><ShieldCheck size={14} /> Create your Kasua account</div>
      <h1>{accountType === "merchant" ? "Apply to sell on Kasua" : "Register as a consumer"}</h1>
      <p className="account-intro">Each account has one role. Merchant access requires identity, business, stall, location, and policy checks.</p>
      <div className="role-picker" aria-label="Account type"><button type="button" className={accountType === "consumer" ? "active" : ""} disabled={busy} onClick={() => setAccountType("consumer")}><ShoppingBag size={15} /> Consumer</button><button type="button" className={accountType === "merchant" ? "active" : ""} disabled={busy} onClick={() => setAccountType("merchant")}><Store size={15} /> Merchant</button></div>
      {accountType === "merchant" ? <MerchantRegistrationWizard onRegister={onRegister} demoMode={demoMode} /> : <form className="account-form" onSubmit={submit}>
        <div className="form-field"><label htmlFor="account-name">Your name</label><input id="account-name" name="name" autoComplete="name" value={form.name} onChange={update} required disabled={busy} /></div>
        {demoMode ? <div className="form-field"><label htmlFor="account-phone">Mobile number</label><input id="account-phone" name="phone" type="tel" autoComplete="tel" value={form.phone} onChange={update} required disabled={busy} placeholder="e.g. 080 1234 5678" /></div> : <>
          <div className="form-field"><label htmlFor="account-email">Email address</label><input id="account-email" name="email" type="email" autoComplete="email" value={form.email} onChange={update} required disabled={busy} /></div>
          <div className="form-row"><div className="form-field"><label htmlFor="account-password">Password</label><input id="account-password" name="password" type="password" autoComplete="new-password" minLength="12" value={form.password} onChange={update} required disabled={busy} /></div><div className="form-field"><label htmlFor="account-confirm-password">Confirm password</label><input id="account-confirm-password" name="confirmPassword" type="password" autoComplete="new-password" minLength="12" value={form.confirmPassword} onChange={update} required disabled={busy} /></div></div>
        </>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button wide-button" type="submit" disabled={busy}>{busy ? "Please wait..." : "Create consumer account"}</button>
        <p className="fine-print">{demoMode ? "Demo registration is stored in this browser. Do not use it for real customer data." : "Use a unique email and a password with at least 12 characters."}</p>
      </form>}
      <p className="auth-switch">Already registered? <button className="text-button" type="button" onClick={onLogin}>Login</button></p>
    </section>
    </main>
  </div>;
}

function MerchantRegistrationWizard({ onRegister, demoMode }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "", phone: "", stall: "", market: "", stallNumber: "", landmark: "" });
  const [identityDocumentType, setIdentityDocumentType] = useState("national_id");
  const [businessEvidenceType, setBusinessEvidenceType] = useState("market_permit");
  const [identityFile, setIdentityFile] = useState(null);
  const [businessFile, setBusinessFile] = useState(null);
  const [confirmsAccuracy, setConfirmsAccuracy] = useState(false);
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const formRef = useRef(null);
  const steps = ["Your details", "Your business", "Verification & policies"];

  function update(event) {
    setForm(current => ({ ...current, [event.target.name]: event.target.value }));
  }
  function moveToStep(nextStep) {
    if (nextStep > step && !formRef.current?.reportValidity()) return;
    setError("");
    setStep(nextStep);
  }
  function updateFile(event, setFile) {
    const file = event.target.files?.[0] || null;
    setFile(file);
    setError("");
    if (file && (file.size > MERCHANT_DOCUMENT_MAX_BYTES || !["application/pdf", "image/jpeg", "image/png"].includes(file.type))) {
      setError("Choose a PDF, JPG, or PNG file no larger than 10 MB.");
    }
  }
  async function submit(event) {
    event.preventDefault();
    setError("");
    if (!form.email.trim() || form.password.length < 12) {
      setError("Enter a valid email and a password with at least 12 characters.");
      setStep(0);
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      setStep(0);
      return;
    }
    if (!confirmsAccuracy || !policyAccepted) {
      setError("Confirm your application details and accept the merchant policies to continue.");
      return;
    }
    try {
      validateMerchantDocuments({ identityFile, businessFile });
    } catch (validationError) {
      setError(validationError.message);
      return;
    }
    setBusy(true);
    try {
      const newAccount = {
        role: "merchant",
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        phone: form.phone.trim(),
        verificationStatus: "pending",
        application: {
          stall: form.stall.trim(),
          market: form.market.trim(),
          stallNumber: form.stallNumber.trim(),
          landmark: form.landmark.trim(),
          identityDocumentType,
          businessEvidenceType,
          identityFile,
          businessFile,
          acceptedPolicyVersion: MERCHANT_POLICY_VERSION,
          acceptedPolicyAt: new Date().toISOString(),
          submittedAt: new Date().toISOString(),
        },
      };
      const result = await onRegister(newAccount);
      if (result?.error) setError(result.error);
    } catch (submissionError) {
      setError(submissionError.message || "Could not submit your merchant application.");
    } finally {
      setBusy(false);
    }
  }

  return <form ref={formRef} className="account-form merchant-onboarding-form" onSubmit={submit}>
    <div className="onboarding-stepper" aria-label="Merchant application progress">{steps.map((label, index) => <div className={`onboarding-step ${index === step ? "active" : index < step ? "complete" : ""}`} key={label}><span>{index < step ? <Check size={14} /> : index + 1}</span><small>{label}</small></div>)}</div>
    {step === 0 && <section className="onboarding-step-panel" aria-labelledby="merchant-account-step">
      <div className="onboarding-section-heading"><span className="eyebrow"><UserRound size={14} /> Step 1 of 3</span><h2 id="merchant-account-step">About you</h2><p>Use your full legal name as it appears on your identity document.</p></div>
      <div className="form-field"><label htmlFor="merchant-legal-name">Legal name</label><input id="merchant-legal-name" name="name" autoComplete="name" minLength="2" maxLength="120" value={form.name} onChange={update} required disabled={busy} /></div>
      <div className="form-field"><label htmlFor="merchant-email">Email address</label><input id="merchant-email" name="email" type="email" autoComplete="email" value={form.email} onChange={update} required disabled={busy} /></div>
      <div className="form-row"><div className="form-field"><label htmlFor="merchant-password">Password</label><input id="merchant-password" name="password" type="password" autoComplete="new-password" minLength="12" value={form.password} onChange={update} required disabled={busy} /></div><div className="form-field"><label htmlFor="merchant-confirm-password">Confirm password</label><input id="merchant-confirm-password" name="confirmPassword" type="password" autoComplete="new-password" minLength="12" value={form.confirmPassword} onChange={update} required disabled={busy} /></div></div>
      <div className="form-field"><label htmlFor="merchant-contact-phone">Business contact number</label><input id="merchant-contact-phone" name="phone" type="tel" autoComplete="tel" value={form.phone} onChange={update} required disabled={busy} placeholder="e.g. 080 1234 5678" /><small>Contact detail only; it is not used to sign in or verify your identity.</small></div>
    </section>}
    {step === 1 && <section className="onboarding-step-panel" aria-labelledby="merchant-business-step">
      <div className="onboarding-section-heading"><span className="eyebrow"><Store size={14} /> Step 2 of 3</span><h2 id="merchant-business-step">Your business and stall</h2><p>Tell us where customers and the Kasua team can find your business.</p></div>
      <div className="form-field"><label htmlFor="merchant-stall">Business or stall name</label><input id="merchant-stall" name="stall" minLength="2" maxLength="120" value={form.stall} onChange={update} required disabled={busy} /></div>
      <div className="form-row"><div className="form-field"><label htmlFor="merchant-market">Market</label><input id="merchant-market" name="market" minLength="2" maxLength="120" value={form.market} onChange={update} required disabled={busy} placeholder="e.g. Masaka Main" /></div><div className="form-field"><label htmlFor="merchant-stall-number">Stall number</label><input id="merchant-stall-number" name="stallNumber" maxLength="40" value={form.stallNumber} onChange={update} required disabled={busy} /></div></div>
      <div className="form-field"><label htmlFor="merchant-landmark">Stall location or nearby landmark</label><input id="merchant-landmark" name="landmark" minLength="2" maxLength="240" value={form.landmark} onChange={update} required disabled={busy} placeholder="Describe a nearby landmark" /></div>
      <div className="onboarding-info"><MapPinCheck size={16} /><span>A Kasua reviewer will confirm your market association and visit the physical stall before enabling selling.</span></div>
    </section>}
    {step === 2 && <section className="onboarding-step-panel" aria-labelledby="merchant-verification-step">
      <div className="onboarding-section-heading"><span className="eyebrow"><ShieldCheck size={14} /> Step 3 of 3</span><h2 id="merchant-verification-step">Verify your identity and business</h2><p>Upload clear, current documents. Files are stored as authenticated Cloudinary assets and only authorized reviewers can access them.</p></div>
      {demoMode && <div className="demo-safety-notice" role="note"><ShieldAlert size={16} /><span>Preview mode does not securely store documents. Use dummy files only—never upload real identity or business records here.</span></div>}
      <div className="form-field"><label htmlFor="merchant-id-type">Government-issued ID type</label><select id="merchant-id-type" value={identityDocumentType} onChange={event => setIdentityDocumentType(event.target.value)} disabled={busy}><option value="national_id">National identity card / NIN slip</option><option value="passport">International passport</option><option value="drivers_license">Driver's licence</option><option value="voters_card">Voter's card</option></select></div>
      <div className="form-field"><label htmlFor="merchant-id-file">Identity document</label><input id="merchant-id-file" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={event => updateFile(event, setIdentityFile)} required disabled={busy} /><small>{identityFile ? `${identityFile.name} · ${(identityFile.size / 1024 / 1024).toFixed(1)} MB` : "PDF, JPG or PNG · up to 10 MB"}</small></div>
      <div className="form-field"><label htmlFor="merchant-business-evidence">Business evidence type</label><select id="merchant-business-evidence" value={businessEvidenceType} onChange={event => setBusinessEvidenceType(event.target.value)} disabled={busy}><option value="market_permit">Market or stall permit</option><option value="association_letter">Market association letter</option><option value="stall_photo">Photo of the stall or business</option><option value="business_registration">Business registration certificate</option></select></div>
      <div className="form-field"><label htmlFor="merchant-business-file">Business verification evidence</label><input id="merchant-business-file" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={event => updateFile(event, setBusinessFile)} required disabled={busy} /><small>{businessFile ? `${businessFile.name} · ${(businessFile.size / 1024 / 1024).toFixed(1)} MB` : "PDF, JPG or PNG · up to 10 MB"}</small></div>
      <MerchantPolicyAcceptance checked={policyAccepted} onChange={setPolicyAccepted} disabled={busy} />
      <label className="consent-row"><input type="checkbox" checked={confirmsAccuracy} onChange={event => setConfirmsAccuracy(event.target.checked)} required disabled={busy} /><span>I confirm my application details are accurate and consent to an in-person stall and location check.</span></label>
    </section>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="onboarding-actions">{step > 0 && <button className="secondary-button" type="button" onClick={() => moveToStep(step - 1)} disabled={busy}>Back</button>}{step < steps.length - 1 ? <button className="primary-button" type="button" onClick={() => moveToStep(step + 1)} disabled={busy}>Continue <ArrowRight size={15} /></button> : <button className="primary-button" type="submit" disabled={busy}>{busy ? "Submitting securely..." : "Submit for verification"}</button>}</div>
    <p className="fine-print">{demoMode ? "Demo onboarding stores only your test account details in this session. No real documents are uploaded." : "Documents are stored in a private bucket. Selling stays disabled until a reviewer completes every verification check."}</p>
  </form>;
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
      const result = await onLogin(role, demoMode && role === "consumer" ? phone : email, password);
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
      <form className="account-form" onSubmit={submit}>{demoMode && role === "consumer" ? <div className="form-field"><label htmlFor="login-phone">Mobile number</label><input id="login-phone" name="phone" type="tel" autoComplete="tel" value={phone} onChange={event => setPhone(event.target.value)} required placeholder="e.g. 080 1234 5678" /></div> : <><div className="form-field"><label htmlFor="login-email">Email address</label><input id="login-email" name="email" type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} required /></div><div className="form-field"><label htmlFor="login-password">Password</label><input id="login-password" name="password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required /></div></>}{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button wide-button" type="submit" disabled={busy}>{busy ? "Please wait..." : `Login as ${role}`}</button><p className="fine-print">{demoMode ? role === "merchant" ? "Preview merchant sign-in checks the email and password used at registration; preview accounts are not securely authenticated." : "Demo login checks consumer accounts stored in this browser only." : "Email/password sign-in is enabled for pre-release testing. Email ownership is not confirmed."}</p></form>
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
  const [application, setApplication] = useState(account.application || {});
  const [identityDocumentType, setIdentityDocumentType] = useState(account.application?.identityDocumentType || "national_id");
  const [businessEvidenceType, setBusinessEvidenceType] = useState(account.application?.businessEvidenceType || "market_permit");
  const [identityFile, setIdentityFile] = useState(null);
  const [businessFile, setBusinessFile] = useState(null);
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const needsChanges = account.verificationStatus === "needs_changes";
  const rejected = account.verificationStatus === "rejected";
  const incomplete = !account.application && !rejected;
  const canEdit = !demoMode && !rejected && (needsChanges || incomplete);
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      validateMerchantDocuments({ identityFile, businessFile }, false);
      if ((!account.application?.identityDocumentPath && !identityFile)
        || (!account.application?.businessDocumentPath && !businessFile)) {
        throw new Error("Upload the missing identity and business verification documents.");
      }
      if (!policyAccepted) throw new Error("Accept the current merchant policies to resubmit.");
      const result = await onResubmit({
        ...application,
        identityDocumentType,
        businessEvidenceType,
        identityFile,
        businessFile,
        acceptedPolicyVersion: MERCHANT_POLICY_VERSION,
      });
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
    <section className="account-panel application-status merchant-account-panel">
      <div className="eyebrow"><ScanEye size={14} /> Merchant onboarding dashboard</div>
      <h1>{needsChanges ? "Action needed" : rejected ? "Application not approved" : incomplete ? "Complete your application" : "Verification in progress"}</h1>
      <p className="account-intro">Hi {account.name}, {account.application?.stall ? <>your application for <strong>{account.application.stall}</strong> at {account.application.market} is saved.</> : "your merchant application needs to be completed."} Selling tools stay locked until all verification checks are complete.</p>
      <div className={`onboarding-status-banner ${needsChanges || incomplete ? "attention" : rejected ? "rejected" : "pending"}`} role="status"><span>{needsChanges ? "Changes requested" : rejected ? "Not approved" : incomplete ? "Onboarding incomplete" : "Under review"}</span><small>{account.application?.submittedAt ? `Submitted ${new Date(account.application.submittedAt).toLocaleDateString()}` : incomplete ? "Complete the required details, evidence, and policy acceptance below." : "We will update your status when review is complete."}</small></div>
      {needsChanges && <div className="onboarding-feedback"><strong>Reviewer feedback</strong><p>{account.reviewFeedback || "Please review and update the application details and evidence."}</p></div>}
      <div className="onboarding-dashboard-grid">
        <section className="onboarding-dashboard-card"><div className="onboarding-dashboard-card-title"><UserRound size={16} /><h2>Identity verification</h2></div><strong>{account.application?.identityDocumentType?.replaceAll("_", " ") || "Document needed"}</strong><span>{account.application?.identityDocumentPath ? "Private document received" : demoMode && account.application?.identityFileName ? `${account.application.identityFileName} · preview metadata only` : "No document submitted"}</span></section>
        <section className="onboarding-dashboard-card"><div className="onboarding-dashboard-card-title"><Store size={16} /><h2>Business verification</h2></div><strong>{account.application?.businessEvidenceType?.replaceAll("_", " ") || "Evidence needed"}</strong><span>{account.application?.businessDocumentPath ? "Private evidence received" : demoMode && account.application?.businessFileName ? `${account.application.businessFileName} · preview metadata only` : "No evidence submitted"}</span></section>
        <section className="onboarding-dashboard-card"><div className="onboarding-dashboard-card-title"><ShieldCheck size={16} /><h2>Merchant policies</h2></div><strong>{account.application?.acceptedPolicyVersion ? "Accepted" : "Not accepted"}</strong><span>{account.application?.acceptedPolicyAt ? `Accepted ${new Date(account.application.acceptedPolicyAt).toLocaleDateString()}` : "Current policy acceptance required"}</span></section>
        <section className="onboarding-dashboard-card"><div className="onboarding-dashboard-card-title"><MapPinCheck size={16} /><h2>Stall and location</h2></div><strong>{account.application?.market || "Market needed"}</strong><span>{account.application?.stallNumber ? `Stall ${account.application.stallNumber} · ${account.application.landmark}` : "Location confirmation pending"}</span></section>
      </div>
      <div className="verification-requirements status-list"><strong>Review milestones</strong><span>Identity and business evidence reviewed</span><span>Market association and stall details confirmed</span><span>In-person stall and location check completed</span><span>All merchant policies accepted and selling access enabled</span></div>
      {canEdit && <form className="account-form resubmit-onboarding-form" onSubmit={submit}>
        <h2>{incomplete ? "Complete your application" : "Update your application"}</h2>
        <div className="form-field"><label htmlFor="resubmit-store">Business or stall name</label><input id="resubmit-store" value={application.stall || ""} onChange={event => setApplication(current => ({ ...current, stall: event.target.value }))} minLength={2} maxLength={120} required /></div>
        <div className="form-row"><div className="form-field"><label htmlFor="resubmit-market">Market</label><input id="resubmit-market" value={application.market || ""} onChange={event => setApplication(current => ({ ...current, market: event.target.value }))} minLength={2} maxLength={120} required /></div><div className="form-field"><label htmlFor="resubmit-stall">Stall number</label><input id="resubmit-stall" value={application.stallNumber || ""} onChange={event => setApplication(current => ({ ...current, stallNumber: event.target.value }))} maxLength={40} required /></div></div>
        <div className="form-field"><label htmlFor="resubmit-landmark">Stall location / landmark</label><input id="resubmit-landmark" value={application.landmark || ""} onChange={event => setApplication(current => ({ ...current, landmark: event.target.value }))} minLength={2} maxLength={240} required /></div>
        <div className="form-field"><label htmlFor="resubmit-id-type">Government-issued ID type</label><select id="resubmit-id-type" value={identityDocumentType} onChange={event => setIdentityDocumentType(event.target.value)}><option value="national_id">National identity card / NIN slip</option><option value="passport">International passport</option><option value="drivers_license">Driver's licence</option><option value="voters_card">Voter's card</option></select></div>
        <div className="form-field"><label htmlFor="resubmit-id-file">Replace identity document <small>{account.application?.identityDocumentPath ? "(optional if current document is still valid)" : "(required)"}</small></label><input id="resubmit-id-file" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={event => setIdentityFile(event.target.files?.[0] || null)} required={!account.application?.identityDocumentPath} /><small>{identityFile?.name || "PDF, JPG or PNG · up to 10 MB"}</small></div>
        <div className="form-field"><label htmlFor="resubmit-business-type">Business evidence type</label><select id="resubmit-business-type" value={businessEvidenceType} onChange={event => setBusinessEvidenceType(event.target.value)}><option value="market_permit">Market or stall permit</option><option value="association_letter">Market association letter</option><option value="stall_photo">Photo of the stall or business</option><option value="business_registration">Business registration certificate</option></select></div>
        <div className="form-field"><label htmlFor="resubmit-business-file">Replace business verification evidence <small>{account.application?.businessDocumentPath ? "(optional if current evidence is valid)" : "(required)"}</small></label><input id="resubmit-business-file" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={event => setBusinessFile(event.target.files?.[0] || null)} required={!account.application?.businessDocumentPath} /><small>{businessFile?.name || "PDF, JPG or PNG · up to 10 MB"}</small></div>
        <MerchantPolicyAcceptance checked={policyAccepted} onChange={setPolicyAccepted} />
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button wide-button" type="submit" disabled={busy}>{busy ? "Submitting securely..." : "Resubmit for review"}</button>
      </form>}
      {needsChanges && demoMode && <p className="demo-safety-notice"><ShieldAlert size={16} /> Preview applications cannot be resubmitted. Use dummy data only; document verification requires a connected private Supabase project.</p>}
      {rejected && <p className="fine-print">If you believe this decision is incorrect, contact Kasua support. You cannot resubmit a rejected application from this screen.</p>}
      <p className="fine-print">{demoMode ? "Preview mode does not securely store documents or verify identity. Use dummy data only." : "Your evidence is stored in a private bucket. Access is limited to your account and authorized merchant reviewers."}</p>
      <button className="secondary-button wide-button" type="button" onClick={onLogout}>Sign out</button>
    </section>
    </main>
  </div>;
}

function MerchantPolicyAcceptance({ checked, onChange, disabled = false }) {
  return <section className="merchant-policy-card" aria-labelledby="merchant-policy-heading"><div className="eyebrow"><ShieldCheck size={14} /> Draft · version 1</div><h3 id="merchant-policy-heading">Kasua merchant participation policies</h3><ul><li>Keep product descriptions, availability, and prices accurate and up to date.</li><li>List only lawful, safe goods and cooperate with Kasua hub quality checks.</li><li>Fulfil accepted orders on time and communicate clearly about delays or issues.</li><li>Respect customers, protect their information, and follow published return and support processes.</li></ul><p>These concise draft terms must be reviewed and finalized before public launch. Fees, settlement, and detailed legal terms will be presented separately before those services go live.</p><label className="consent-row policy-consent"><input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} required disabled={disabled} /><span>I have read and agree to the Kasua merchant participation policies, version {MERCHANT_POLICY_VERSION}.</span></label></section>;
}

function ProductCard({ product, onAdd, onAskQuestion, disabled = false }) {
  const image = product.imageUrl || `https://images.unsplash.com/${product.image}?auto=format&fit=crop&w=600&q=80`;
  return (
    <article className="product-card">
      <div className="product-image"><img src={image} alt={product.name} loading="lazy" /><span className="price-note"><BadgeCheck size={11} />{product.note}</span></div>
      <div className="product-info"><h3>{product.name}</h3><div className="seller-line"><BadgeCheck size={12} />{product.seller}{product.rating && <span>· ★ {product.rating}</span>}</div>{(product.description || product.brand || product.size || product.origin || product.specifications) && <details className="market-product-details"><summary>Product details</summary>{product.description && <span>{product.description}</span>}{product.brand && <span>Brand: {product.brand}</span>}{product.size && <span>Size: {product.size}</span>}{product.origin && <span>Origin: {product.origin}</span>}{product.specifications && <span>{product.specifications}</span>}</details>}
        <div className="product-bottom"><div className="product-price">{formatNaira(product.price)}<span className="product-unit">{product.unit}</span></div><button className="icon-button add-button" type="button" aria-label={`Add ${product.name} to basket`} disabled={disabled || product.stock === 0} onClick={() => onAdd(product)}><Plus size={17} /></button></div>
        {onAskQuestion && <button className="product-question-button" type="button" onClick={() => onAskQuestion(product)}><MessageCircle size={13} /> Ask seller</button>}
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

function CustomerProfilePage({ account, isGuest, priorities, onTogglePriority, onLogin, onRegister, onLogout, questions, questionsLoading, questionsError }) {
  return <section className="customer-page" aria-labelledby="profile-page-title">
    <div className="customer-page-heading"><div><span className="eyebrow"><UserRound size={14} /> Account</span><h1 id="profile-page-title">Your profile</h1><p>Manage your Kasua account and shopping preferences.</p></div></div>
    {isGuest ? <section className="customer-page-card customer-page-empty"><div className="profile-summary"><span className="profile-avatar">G</span><div><h2>Browsing as a guest</h2><p>Sign in to keep your account and preferences together.</p></div></div><div className="customer-page-actions"><button className="primary-button" type="button" onClick={onLogin}>Sign in</button><button className="secondary-button" type="button" onClick={onRegister}>Create account</button></div></section>
      : <><section className="customer-page-card customer-profile-card"><div className="profile-summary"><span className="profile-avatar">{account.name.slice(0, 1).toUpperCase()}</span><div><h2>{account.name}</h2><p>Consumer account</p></div><span className="verified-profile"><ShieldCheck size={14} /> Active</span></div><div className="profile-details">{account.email && <div><span>Email address</span><strong>{account.email}</strong></div>}{account.phone && <div><span>Phone number</span><strong>{account.phone}</strong></div>}<div><span>Account type</span><strong>Consumer</strong></div></div></section>
        <section className="customer-page-card customer-merchant-messages"><div className="dashboard-card-heading"><div><span className="eyebrow"><MessageCircle size={13} /> Merchant messages</span><h2>Product questions</h2></div></div>{questionsError && <p className="form-error" role="alert">{questionsError}</p>}{questionsLoading && <p className="merchant-empty">Loading your questions…</p>}{!questionsLoading && !questions.length && <p className="merchant-empty">Questions you send to merchants and their replies will appear here.</p>}{questions.map(question => <article className="customer-merchant-question" key={question.id}><div><strong>{question.productName}</strong><span className={`merchant-order-status status-${question.status}`}>{question.status}</span></div><p>{question.question}</p>{question.answer ? <p className="customer-merchant-answer"><strong>Merchant reply:</strong> {question.answer}</p> : <small>Waiting for the merchant to reply.</small>}</article>)}</section>
        <section className="customer-page-card profile-preferences"><div className="dashboard-card-heading"><div><span className="eyebrow">Personalize your market</span><h2>Shopping priorities</h2></div><Star size={18} /></div><p>Choose what matters most when we show market picks.</p><div className="priority-options">{customerPriorityOptions.map(({ id, label, description, Icon }) => {
          const selected = priorities.includes(id);
          return <button key={id} type="button" className={`priority-option ${selected ? "selected" : ""}`} aria-pressed={selected} onClick={() => onTogglePriority(id)}><span className="priority-icon"><Icon size={18} /></span><span className="priority-copy"><strong>{label}</strong><small>{description}</small></span><span className="priority-check" aria-hidden="true">{selected ? <Check size={15} /> : null}</span></button>;
        })}</div><p className="dashboard-note">Preferences are saved on this device.</p></section>
        <section className="customer-page-card profile-signout"><div><h2>Sign out</h2><p>Sign out of your Kasua account on this device.</p></div><button className="secondary-button" type="button" onClick={onLogout}><LogOut size={15} /> Sign out</button></section>
      </>}
  </section>;
}

function ShopView({ products, cart, onAdd, onAskQuestion, onQuantity, onCheckout, onClearCart, walletBalance, notify, search, activeCategory, setActiveCategory, sort, setSort, onVerify, onComplaint, onLogin, onRegister, onLogout, supportCases, order, account, accountName, demoMode, isGuest = false, catalogLoading = false, catalogError = "", cartLoading = false, purchaseHistory, priorities, onTogglePriority, onRefreshOrder, merchantQuestions = [], merchantQuestionsLoading = false, merchantQuestionsError = "" }) {
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
    {activeNavItem === "profile" && <CustomerProfilePage account={account} isGuest={isGuest} priorities={priorities} onTogglePriority={onTogglePriority} onLogin={onLogin} onRegister={onRegister} onLogout={onLogout} questions={merchantQuestions} questionsLoading={merchantQuestionsLoading} questionsError={merchantQuestionsError} />}
    {activeNavItem === "market" && <>
    {!demoMode && <div className="backend-banner" role="status"><ShieldCheck size={16} /><span><strong>{isGuest ? "Browse without an account." : "Your account is connected."}</strong> Products and merchant offers are loaded from Supabase. {isGuest ? "Your basket stays on this device. Sign in to continue; checkout and payment are unavailable." : "Checkout and payment are not connected yet."}</span></div>}
    <div className="welcome-row"><div><div className="eyebrow"><Sun size={14} /> Tuesday market, Masaka</div><h1>{isGuest ? "Browse today's market" : `Good morning, ${accountName}`}</h1></div><span className="account-role"><ShoppingBag size={14} /> {isGuest ? "Guest browsing" : "Consumer account"}</span></div>
    <div className="market-layout">
      <div className="main-column">
        <section className="category-section"><div className="section-heading"><h2>Shop by category</h2><button className="text-button" type="button" onClick={() => setActiveCategory("All items")}>See all</button></div><CategoryPicker activeCategory={activeCategory} onChange={setActiveCategory} /></section>
        <section id="products"><div className="section-heading products-heading"><div><h2>Fresh from Masaka</h2><p>Fair market prices, updated by verified traders today</p></div><select className="sort-select" value={sort} onChange={event => setSort(event.target.value)} aria-label="Sort products"><option value="featured">Today's picks</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option></select></div>
          {catalogError && <div className="empty-state" role="alert">{catalogError}</div>}
          {catalogLoading ? <div className="empty-state" role="status">Loading products from Supabase...</div> : <div className="product-grid">{visibleProducts.map(product => { const quantityInCart = cart.find(line => line.productId === product.id)?.quantity || 0; const maxQuantity = Math.min(99, Number.isInteger(product.stock) ? product.stock : 99); return <ProductCard key={product.id} product={product} onAdd={onAdd} onAskQuestion={onAskQuestion} disabled={cartLoading || quantityInCart >= maxQuantity || (!quantityInCart && cart.length >= 100)} />; })}{visibleProducts.length === 0 && !catalogError && <div className="empty-state">No products match this search. Try another item or category.</div>}</div>}
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

function MerchantView({
  inventory, onAddProduct, onEditProduct, onVerify, account, demoMode,
  inventoryLoading, inventoryError, orders, payouts, ordersLoading, payoutsLoading,
  ordersError, payoutsError, insights, insightsLoading, insightsError,
  questions, questionsLoading, questionsError, onAnswerQuestion,
  onUpdateOrder, onRefreshOrders,
}) {
  const [activeTab, setActiveTab] = useState("overview");
  const pendingOrders = orders.filter(order => order.status === "awaiting_merchant");
  const grossSales = orders
    .filter(order => !["rejected", "cancelled"].includes(order.status))
    .reduce((sum, order) => sum + order.subtotal, 0);
  const paidOut = payouts
    .filter(payout => payout.status === "paid")
    .reduce((sum, payout) => sum + payout.amount, 0);
  const inProgressOrders = orders.filter(order => ["accepted", "preparing", "at_hub", "quality_check", "ready_for_dispatch", "in_transit"].includes(order.status)).length;
  const categoriesCount = new Set(inventory.map(item => item.category).filter(Boolean)).size;
  const tabs = [
    { id: "overview", label: "Overview", icon: Store },
    { id: "orders", label: "Orders", icon: PackageCheck, count: pendingOrders.length },
    { id: "inventory", label: "Inventory", icon: Package },
    { id: "questions", label: "Questions & support", icon: MessageCircle, count: questions.filter(question => question.status === "open").length },
    { id: "insights", label: "Insights & reports", icon: TrendingUp },
    { id: "payouts", label: "Sales & payouts", icon: Coins },
  ];

  return <>
    <div className="welcome-row merchant-welcome">
      <div><div className="eyebrow"><Sun size={14} /> Trader workspace · Masaka</div><h1>Good morning, {account.name}</h1></div>
      <span className="account-role"><Store size={14} /> Verified merchant</span>
    </div>
    <section className="merchant-banner">
      <div><div className="hero-kicker"><BadgeCheck size={14} /> Trader workspace</div><h2>Your stall, reaching all of Masaka.</h2><p>Manage orders, prepare hub handoffs, and keep track of your sales.</p></div>
      <button className="primary-button" type="button" onClick={onAddProduct}><Plus size={15} /> Add a product</button>
    </section>
    {demoMode && <p className="merchant-demo-note merchant-demo-wide">Preview only: order and payout records are examples. Actions and product changes are not sent to a payment provider or saved to a live marketplace.</p>}
    <div className="merchant-stats">
      <StatCard label="Paid order value" value={ordersLoading ? "…" : formatNaira(grossSales)} detail="Gross value of eligible orders" />
      <StatCard label="Needs your attention" value={ordersLoading ? "…" : pendingOrders.length} detail="Awaiting your acceptance" />
      <StatCard label="In fulfillment" value={ordersLoading ? "…" : inProgressOrders} detail="Accepted orders in progress" />
      <StatCard label="Paid out" value={payoutsLoading ? "…" : formatNaira(paidOut)} detail="Recorded completed payouts" />
      <StatCard label="Listed products" value={inventoryLoading ? "…" : inventory.length} detail={`${categoriesCount} categories`} />
    </div>
    <nav className="merchant-tabs" aria-label="Merchant dashboard sections">
      {tabs.map(({ id, label, icon: Icon, count }) => <button key={id} type="button" className={`merchant-tab ${activeTab === id ? "active" : ""}`} aria-current={activeTab === id ? "page" : undefined} onClick={() => setActiveTab(id)}>
        <Icon size={16} /><span>{label}</span>{count > 0 && <span className="merchant-tab-count">{count}</span>}
      </button>)}
      <button className="merchant-refresh" type="button" onClick={onRefreshOrders} disabled={ordersLoading} aria-label="Refresh orders"><RefreshCw size={15} /> Refresh</button>
    </nav>
    {ordersError && <p className="form-error merchant-workspace-error" role="alert">{ordersError}</p>}
    {activeTab === "overview" && <div className="merchant-dashboard-grid">
      <section className="side-panel merchant-dashboard-section">
        <div className="side-panel-header"><div><h2>Orders requiring action</h2><span className="subheading">New paid orders appear here automatically</span></div><button type="button" className="text-button" onClick={() => setActiveTab("orders")}>All orders <ArrowRight size={13} /></button></div>
        {pendingOrders.length > 0 && <div className="merchant-notification"><Bell size={16} /><span><strong>{pendingOrders.length} new order{pendingOrders.length === 1 ? "" : "s"}</strong> ready for your review.</span></div>}
        {ordersLoading ? <p className="merchant-empty">Loading your orders…</p> : orders.length ? orders.slice(0, 2).map(order => <MerchantOrderCard key={order.id} order={order} onUpdate={onUpdateOrder} />) : <p className="merchant-empty">No paid orders yet. New orders will appear here when customers check out.</p>}
      </section>
      <aside className="merchant-dashboard-aside">
        <section className="verify-panel"><h3><MapPinCheck size={15} /> Verified Kasua trader</h3><p>Your stall and location have been checked. Keep your profile current to build buyer trust.</p><button type="button" onClick={onVerify}>View verification <ArrowRight size={13} /></button></section>
        <section className="side-panel merchant-handoff-help"><h2><Truck size={16} /> Hub handoff</h2><p>Once an order is packed, mark it as handed to the market hub. The hub team then coordinates quality checks and delivery.</p></section>
      </aside>
    </div>}
    {activeTab === "orders" && <section className="side-panel merchant-dashboard-section">
      <div className="side-panel-header"><div><h2>Customer orders</h2><span className="subheading">Accept orders, prepare items, and coordinate handoff to the hub</span></div><span className="page-count">{orders.length} orders</span></div>
      {ordersLoading && <p className="merchant-empty">Loading your orders…</p>}
      {!ordersLoading && orders.length === 0 && <p className="merchant-empty">No paid orders yet. New orders will appear here when customers check out.</p>}
      {orders.map(order => <MerchantOrderCard key={order.id} order={order} onUpdate={onUpdateOrder} />)}
    </section>}
    {activeTab === "inventory" && <section className="side-panel inventory-panel">
      <div className="side-panel-header"><div><h2>Market inventory</h2><span className="subheading">Create and update your products, prices, and available stock</span></div><button className="text-button" type="button" onClick={onAddProduct}>+ Add item</button></div>
      {inventoryError && <p className="form-error merchant-inventory-error" role="alert">{inventoryError}</p>}
      <div className="inventory-wrap"><table className="inventory-table"><thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Available</th><th>Updated</th><th>Action</th></tr></thead><tbody>
        {inventoryLoading ? <tr><td colSpan="6">Loading your product listings…</td></tr> : inventory.map(item => <tr key={item.id}><td><div className="inventory-product">{item.imageUrl && <img className="inventory-thumb" src={item.imageUrl} alt="" />}{item.image ? <img className="inventory-thumb" src={`https://images.unsplash.com/${item.image}?auto=format&fit=crop&w=120&q=70`} alt="" /> : null}<div><strong>{item.name}</strong>{(item.description || item.brand || item.size || item.origin || item.specifications) && <details className="inventory-details"><summary>Specifications</summary>{item.description && <span>{item.description}</span>}{item.brand && <span>Brand: {item.brand}</span>}{item.size && <span>Size: {item.size}</span>}{item.origin && <span>Origin: {item.origin}</span>}{item.specifications && <span>{item.specifications}</span>}</details>}</div></div></td><td>{item.category || "—"}</td><td>{formatNaira(item.price)}<small className="inventory-unit">{item.unit}</small></td><td><span className={`stock-pill ${item.stock === 0 ? "empty" : ""}`}>{item.stock > 0 ? `${item.stock} in stock` : "Out of stock"}</span></td><td>{item.checked}</td><td><button className="inventory-edit-button" type="button" onClick={() => onEditProduct(item)}>Edit</button></td></tr>)}
        {!inventoryLoading && !inventoryError && inventory.length === 0 && <tr><td colSpan="6">No products yet. Add your first product to get started.</td></tr>}
      </tbody></table></div>
    </section>}
    {activeTab === "questions" && <MerchantQuestionsPanel questions={questions} loading={questionsLoading} error={questionsError} onAnswer={onAnswerQuestion} />}
    {activeTab === "insights" && <MerchantInsightsPanel insights={insights} loading={insightsLoading} error={insightsError} orders={orders} ordersLoading={ordersLoading} />}
    {activeTab === "payouts" && <MerchantPayouts payouts={payouts} loading={payoutsLoading} error={payoutsError} />}
  </>;
}

function MerchantQuestionsPanel({ questions, loading, error, onAnswer }) {
  const [replies, setReplies] = useState({});
  const openCount = questions.filter(question => question.status === "open").length;
  return <section className="side-panel merchant-inbox-panel">
    <div className="side-panel-header"><div><h2>Customer questions & support</h2><span className="subheading">Answer product questions from shoppers; avoid sharing personal customer details</span></div><span className="page-count">{openCount} waiting</span></div>
    {error && <p className="form-error merchant-workspace-error" role="alert">{error}</p>}
    {loading && <p className="merchant-empty">Loading customer questions…</p>}
    {!loading && !questions.length && <p className="merchant-empty">No customer questions yet. Questions about your active products will appear here.</p>}
    {questions.map(question => <MerchantQuestionCard key={question.id} question={question} reply={replies[question.id] || ""} onReplyChange={value => setReplies(current => ({ ...current, [question.id]: value }))} onAnswer={onAnswer} />)}
    <p className="merchant-support-note">For delivery, payment, safety, or dispute issues, contact Kasua support. This inbox is for product questions and replies only.</p>
  </section>;
}

function MerchantQuestionCard({ question, reply, onReplyChange, onAnswer }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submitAnswer(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onAnswer(question.id, reply);
      onReplyChange("");
    } catch (replyError) {
      setError(`Could not send your reply: ${replyError.message}`);
    } finally {
      setBusy(false);
    }
  }
  const date = new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(question.createdAt));
  return <article className="merchant-question-card">
    <div className="merchant-question-heading"><div><strong>{question.productName}</strong><span>{date}</span></div><span className={`merchant-order-status status-${question.status}`}>{question.status}</span></div>
    <p className="merchant-question-text">{question.question}</p>
    {question.answer && <div className="merchant-question-answer"><strong>Your reply</strong><p>{question.answer}</p></div>}
    {question.status !== "closed" && <form className="merchant-reply-form" onSubmit={submitAnswer}>
      <label htmlFor={`merchant-reply-${question.id}`}>{question.status === "answered" ? "Update reply" : "Your reply"}</label>
      <textarea id={`merchant-reply-${question.id}`} minLength={5} maxLength={1000} required value={reply} onChange={event => onReplyChange(event.target.value)} placeholder="Write a helpful product answer" />
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary-button" type="submit" disabled={busy}>{busy ? "Sending…" : question.status === "answered" ? "Update reply" : "Send reply"}</button>
    </form>}
  </article>;
}

function MerchantInsightsPanel({ insights, loading, error, orders, ordersLoading }) {
  const totalGross = insights.reduce((sum, item) => sum + item.gross30d, 0);
  const totalUnits = insights.reduce((sum, item) => sum + item.units30d, 0);
  const totalOrders = insights.reduce((sum, item) => sum + item.orders30d, 0);
  const topProducts = [...insights].filter(item => item.units30d > 0).sort((a, b) => b.units30d - a.units30d).slice(0, 5);
  const maxUnits = Math.max(1, ...topProducts.map(item => item.units30d));
  const liveInFulfillment = orders.filter(order => ["accepted", "preparing", "at_hub", "quality_check", "ready_for_dispatch", "in_transit"].includes(order.status)).length;
  return <div className="merchant-insights-page">
    <section className="side-panel merchant-report-panel">
      <div className="side-panel-header"><div><h2>Performance report</h2><span className="subheading">Measured from paid orders in the last 30 days</span></div><span className="page-count">Last 30 days</span></div>
      {error && <p className="form-error merchant-workspace-error" role="alert">{error}</p>}
      <div className="merchant-report-metrics">
        <StatCard label="Gross order sales" value={loading ? "…" : formatNaira(totalGross)} detail="Before fees, refunds, and payouts" />
        <StatCard label="Units ordered" value={loading ? "…" : totalUnits} detail="From paid orders" />
        <StatCard label="Offer order count" value={loading ? "…" : totalOrders} detail="Summed per listing; baskets can count more than once" />
        <StatCard label="In fulfillment" value={ordersLoading ? "…" : liveInFulfillment} detail="Current active merchant orders" />
      </div>
      <p className="merchant-insight-caveat">Sales and demand reflect paid order lines, not page views; totals are gross and do not account for fees or refunds. Orders containing multiple listings can contribute to more than one offer count.</p>
      <div className="merchant-top-products"><h3>Top products by units ordered</h3>
        {loading && <p className="merchant-empty">Loading product performance…</p>}
        {!loading && topProducts.length === 0 && <p className="merchant-empty">Paid sales data will appear after your first completed checkout.</p>}
        {topProducts.map((item, index) => <div className="merchant-performance-row" key={item.offerId}>
          <span className="merchant-performance-rank">{index + 1}</span><div className="merchant-performance-product"><strong>{item.name}</strong><span>{item.units30d} units · {formatNaira(item.gross30d)}</span><div className="merchant-performance-track"><span style={{ width: `${Math.max(4, item.units30d / maxUnits * 100)}%` }} /></div></div>
        </div>)}
      </div>
    </section>
    <section className="side-panel merchant-demand-panel">
      <div className="side-panel-header"><div><h2>Demand & stock recommendations</h2><span className="subheading">A simple 14-day pace estimate from recent paid orders</span></div></div>
      <p className="merchant-insight-caveat">Recommendations are directional, based on the last 30 days of orders and current listed stock; they are not a guarantee of future demand.</p>
      {insights.map(item => {
        const fourteenDayDemand = Math.ceil(item.units30d / 30 * 14);
        const suggestedRestock = Math.max(0, fourteenDayDemand - item.stock);
        const daysOfStock = item.units30d ? Math.floor(item.stock / (item.units30d / 30)) : null;
        const needsStock = suggestedRestock > 0;
        return <article className="merchant-insight-product" key={item.offerId}>
          <div className="merchant-insight-product-heading"><div><strong>{item.name}</strong><span>{item.unit}{item.size ? ` · ${item.size}` : ""} · {item.category}</span></div><span className={`stock-pill ${item.stock === 0 ? "empty" : ""}`}>{item.stock} in stock</span></div>
          <div className="merchant-insight-facts"><span>7-day demand <strong>{item.units7d}</strong></span><span>30-day demand <strong>{item.units30d}</strong></span><span>Estimated cover <strong>{daysOfStock === null ? "No sales data" : `${daysOfStock} days`}</strong></span></div>
          <p className={needsStock ? "merchant-stock-advice needs-stock" : "merchant-stock-advice"}>{needsStock ? `Consider restocking about ${suggestedRestock} units to cover the estimated next 14 days.` : item.units30d ? "Current stock covers the simple 14-day demand estimate." : "No recent paid-order demand; avoid automatic restock assumptions."}</p>
        </article>;
      })}
      {!loading && !insights.length && <p className="merchant-empty">Product demand data will appear when listings and order records are available.</p>}
    </section>
    <section className="side-panel merchant-pricing-panel">
      <div className="side-panel-header"><div><h2>Pricing comparisons</h2><span className="subheading">Active verified offers with the same category, selling unit, and size</span></div></div>
      <p className="merchant-insight-caveat">These are indicative category/pack comparisons, not guaranteed identical products. Quality, origin, freshness, and seller service can differ.</p>
      <div className="inventory-wrap"><table className="inventory-table"><thead><tr><th>Product</th><th>Your price</th><th>Comparable offers</th><th>Observed range</th><th>Median</th></tr></thead><tbody>
        {insights.map(item => <tr key={item.offerId}><td>{item.name}<small className="inventory-unit">{item.category} · {item.unit}{item.size ? ` · ${item.size}` : ""}</small></td><td>{formatNaira(item.price)}</td><td>{item.comparisonCount}</td><td>{item.comparisonCount ? `${formatNaira(item.comparisonMin)} – ${formatNaira(item.comparisonMax)}` : "Not enough data"}</td><td>{item.comparisonCount ? formatNaira(item.comparisonMedian) : "—"}</td></tr>)}
        {!loading && !insights.length && <tr><td colSpan="5">No active listings to compare yet.</td></tr>}
      </tbody></table></div>
    </section>
  </div>;
}

function MerchantOrderCard({ order, onUpdate }) {
  const [handoffNote, setHandoffNote] = useState(order.handoffNote || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const statusLabels = {
    awaiting_merchant: "Needs acceptance",
    accepted: "Accepted",
    preparing: "Preparing",
    at_hub: "Handed to hub",
    quality_check: "Hub quality check",
    ready_for_dispatch: "Ready for dispatch",
    in_transit: "In transit",
    delivered: "Delivered",
    rejected: "Rejected",
    cancelled: "Cancelled",
    delayed: "Delayed",
    failed_delivery: "Delivery issue",
  };
  const dateLabel = order.createdAt
    ? new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(order.createdAt))
    : "Date unavailable";
  async function updateStatus(status) {
    setBusy(true);
    setError("");
    try {
      await onUpdate(order.id, status, handoffNote);
    } catch (updateError) {
      setError(`Could not update this order: ${updateError.message}`);
    } finally {
      setBusy(false);
    }
  }
  return <article className="merchant-order-card">
    <div className="merchant-order-heading">
      <div><span className="merchant-order-reference">{order.reference}</span><span className={`merchant-order-status status-${order.status}`}>{statusLabels[order.status] || order.status}</span><small>{dateLabel}</small></div>
      <strong>{formatNaira(order.subtotal)}</strong>
    </div>
    <div className="merchant-order-items">{order.items.map((item, index) => <div key={`${item.name}-${index}`}><span>{item.name} × {item.quantity}</span><strong>{formatNaira(item.price * item.quantity)}</strong></div>)}</div>
    <div className="merchant-order-destination"><MapPin size={15} /><div><strong>{order.area || "Delivery area not provided"}</strong><span>{order.landmark || "Kasua hub will coordinate the delivery handoff."}</span></div></div>
    {order.handoffNote && order.status !== "preparing" && <p className="merchant-handoff-note"><strong>Handoff note:</strong> {order.handoffNote}</p>}
    {order.status === "preparing" && <label className="merchant-handoff-field">Optional note for the hub
      <textarea maxLength={500} value={handoffNote} onChange={event => setHandoffNote(event.target.value)} placeholder="Packing or collection details" />
    </label>}
    <div className="merchant-order-footer">
      <span><Clock3 size={14} /> {order.deliveryFee > 0 ? `Delivery fee ${formatNaira(order.deliveryFee)}` : "Delivery coordinated by Kasua"}</span>
      {order.status === "awaiting_merchant" && <div className="merchant-order-action"><button className="primary-button" type="button" disabled={busy} onClick={() => updateStatus("accepted")}>{busy ? "Updating…" : "Accept order"}</button><small>Need to decline? Contact Kasua support to arrange cancellation and any required refund.</small></div>}
      {order.status === "accepted" && <button className="primary-button" type="button" disabled={busy} onClick={() => updateStatus("preparing")}>{busy ? "Updating…" : "Start preparing"}</button>}
      {order.status === "preparing" && <button className="primary-button" type="button" disabled={busy} onClick={() => updateStatus("at_hub")}>{busy ? "Updating…" : "Mark handed to hub"}</button>}
      {!["awaiting_merchant", "accepted", "preparing"].includes(order.status) && <span className="merchant-order-next-step">Kasua hub team coordinates the next delivery step.</span>}
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
  </article>;
}

function MerchantPayouts({ payouts, loading, error }) {
  const paid = payouts.filter(payout => payout.status === "paid").reduce((sum, payout) => sum + payout.amount, 0);
  const processing = payouts.filter(payout => ["pending", "processing"].includes(payout.status)).reduce((sum, payout) => sum + payout.amount, 0);
  return <section className="side-panel merchant-payout-panel">
    <div className="side-panel-header"><div><h2>Sales & payout records</h2><span className="subheading">Settlements recorded for your merchant account</span></div><span className="page-count">{payouts.length} records</span></div>
    <div className="merchant-payout-summary"><StatCard label="Paid out" value={loading ? "…" : formatNaira(paid)} detail="Completed transfers" /><StatCard label="In progress" value={loading ? "…" : formatNaira(processing)} detail="Pending or processing" /></div>
    {error && <p className="form-error merchant-workspace-error" role="alert">{error}</p>}
    <p className="merchant-payout-note">Only recorded settlements are shown. Order sales are not the same as a completed payout.</p>
    <div className="inventory-wrap"><table className="inventory-table merchant-payout-table"><thead><tr><th>Period</th><th>Amount</th><th>Status</th><th>Reference</th><th>Updated</th></tr></thead><tbody>
      {loading && <tr><td colSpan="5">Loading payout records…</td></tr>}
      {!loading && payouts.map(payout => <tr key={payout.id}><td>{payout.periodStart ? `${payout.periodStart}${payout.periodEnd ? ` – ${payout.periodEnd}` : ""}` : "Period not provided"}</td><td>{formatNaira(payout.amount)}</td><td><span className={`merchant-order-status status-${payout.status}`}>{payout.status}</span>{payout.failureReason && <small className="inventory-unit">{payout.failureReason}</small>}</td><td>{payout.reference || "—"}</td><td>{payout.paidAt ? new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(new Date(payout.paidAt)) : new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(new Date(payout.createdAt))}</td></tr>)}
      {!loading && !error && payouts.length === 0 && <tr><td colSpan="5">No payout records yet. Completed settlements will appear here.</td></tr>}
    </tbody></table></div>
  </section>;
}

function StatCard({ label, value, detail }) { return <div className="stat-card"><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>; }

function CheckoutDialog({ totals, walletBalance, onClose, onPlaceOrder }) {
  const [method, setMethod] = useState("wallet");
  const canPayWithWallet = walletBalance >= totals.total;
  return <Dialog title="Review your order" onClose={onClose}><div className="dialog-body"><div className="order-lines"><div className="order-line"><span>Items subtotal</span><strong>{formatNaira(totals.subtotal)}</strong></div><div className="order-line"><span>Delivery to Masaka</span><strong>{formatNaira(totals.delivery)}</strong></div><div className="order-line"><span>Kasua service fee</span><strong>{formatNaira(totals.service)}</strong></div><div className="order-line total"><span>Estimated total</span><strong>{formatNaira(totals.total)}</strong></div></div><div className="payment-label">Choose how to pay</div><div className="payment-options">{paymentMethods.map(payment => <label className={`payment-option ${method === payment.id ? "selected" : ""}`} key={payment.id}><input type="radio" name="payment" value={payment.id} checked={method === payment.id} disabled={payment.id === "wallet" && !canPayWithWallet} onChange={() => setMethod(payment.id)} /><span>{payment.title}</span><small>{payment.id === "wallet" ? `${formatNaira(walletBalance)} available` : payment.detail}</small></label>)}</div>{method === "wallet" && !canPayWithWallet && <p className="form-error">Wallet balance is too low. Choose another payment method.</p>}<button className="primary-button wide-button" type="button" disabled={method === "wallet" && !canPayWithWallet} onClick={() => onPlaceOrder(method, totals)}>Place order · {formatNaira(totals.total)}</button><p className="fine-print">Demo checkout only. Payment providers are not connected yet.</p></div></Dialog>;
}

function MerchantQuestionDialog({ product, onClose, onSubmit }) {
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSubmit(question);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setBusy(false);
    }
  }
  return <Dialog title="Ask the merchant" onClose={onClose}>
    <form className="dialog-body merchant-question-dialog" onSubmit={submit}>
      <p>Ask a question about <strong>{product.name}</strong>. Keep messages focused on product details.</p>
      <label className="form-field"><span>Your question</span><textarea minLength={5} maxLength={1000} required value={question} onChange={event => setQuestion(event.target.value)} placeholder="Ask about size, freshness, ingredients, or availability" /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary-button wide-button" type="submit" disabled={busy}>{busy ? "Sending…" : "Send question"}</button>
      <p className="fine-print">For payments, delivery problems, or disputes, contact Kasua support instead.</p>
    </form>
  </Dialog>;
}

function ProductDialog({ onClose, onSave, initialProduct, demoMode }) {
  const [form, setForm] = useState({
    name: initialProduct?.name || "",
    price: initialProduct?.price ?? "",
    category: initialProduct?.category || "Produce",
    unit: initialProduct?.unit || "",
    stock: initialProduct?.stock ?? "",
    description: initialProduct?.description || "",
    brand: initialProduct?.brand || "",
    size: initialProduct?.size || "",
    origin: initialProduct?.origin || "",
    specifications: initialProduct?.specifications || "",
    condition: initialProduct?.condition || "new",
  });
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(initialProduct?.imageUrl || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => () => {
    if (photoPreview.startsWith("blob:")) URL.revokeObjectURL(photoPreview);
  }, [photoPreview]);
  function update(event) {
    setError("");
    setForm(current => ({ ...current, [event.target.name]: event.target.value }));
  }
  function choosePhoto(event) {
    const file = event.target.files?.[0] || null;
    setError("");
    try {
      validateMerchantProductPhoto(file);
      setPhoto(file);
      setPhotoPreview(file ? URL.createObjectURL(file) : initialProduct?.imageUrl || "");
    } catch (validationError) {
      setPhoto(null);
      event.target.value = "";
      setError(validationError.message);
    }
  }
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const photoDataUrl = demoMode && photo ? await readFileAsDataUrl(photo) : null;
      const result = await onSave({
        ...form,
        price: Number(form.price),
        stock: Number(form.stock),
        photo,
        photoDataUrl,
        imageUrl: photoDataUrl || (!photo ? initialProduct?.imageUrl : null),
        imagePath: !photo ? initialProduct?.imagePath : null,
      }, initialProduct);
      if (result?.error) setError(result.error);
    } catch (saveError) {
      setError(saveError.message || "Could not save this product.");
    } finally {
      setBusy(false);
    }
  }
  return <Dialog title={initialProduct ? "Edit product" : "Create a product listing"} onClose={onClose}><form className="dialog-body product-form" onSubmit={submit}>
    <div className="product-form-intro">Keep your catalog accurate so customers can compare products, prices, and availability.</div>
    <div className="form-field"><label htmlFor="product-name">Product name</label><input id="product-name" name="name" value={form.name} onChange={update} minLength="2" maxLength="120" required placeholder="e.g. Sweet potatoes" /></div>
    <div className="form-field"><label htmlFor="product-description">Description</label><textarea id="product-description" name="description" value={form.description} onChange={update} maxLength="2000" rows="3" placeholder="Describe quality, freshness, or what makes this product useful." /></div>
    <div className="form-row"><div className="form-field"><label htmlFor="product-price">Price (₦)</label><input id="product-price" name="price" type="number" min="1" max="10000000000" step="1" value={form.price} onChange={update} required placeholder="e.g. 2500" /></div><div className="form-field"><label htmlFor="product-stock">Stock available</label><input id="product-stock" name="stock" type="number" min="0" max="1000000" step="1" value={form.stock} onChange={update} required placeholder="e.g. 12" /></div></div>
    <div className="form-row"><div className="form-field"><label htmlFor="product-category">Category</label><select id="product-category" name="category" value={form.category} onChange={update} required>{categories.filter(category => category.name !== "All items").map(category => <option key={category.name}>{category.name}</option>)}</select></div><div className="form-field"><label htmlFor="product-unit">Selling unit</label><input id="product-unit" name="unit" value={form.unit} onChange={update} maxLength="80" required placeholder="e.g. per basket" /></div></div>
    <div className="product-specification-heading"><strong>Product specifications</strong><span>Help buyers understand the exact item and pack size.</span></div>
    <div className="form-row"><div className="form-field"><label htmlFor="product-brand">Brand (optional)</label><input id="product-brand" name="brand" value={form.brand} onChange={update} maxLength="120" placeholder="Brand or grower" /></div><div className="form-field"><label htmlFor="product-size">Size / pack weight</label><input id="product-size" name="size" value={form.size} onChange={update} maxLength="80" placeholder="e.g. 5 kg bag" /></div></div>
    <div className="form-row"><div className="form-field"><label htmlFor="product-origin">Origin (optional)</label><input id="product-origin" name="origin" value={form.origin} onChange={update} maxLength="120" placeholder="Growing or production area" /></div><div className="form-field"><label htmlFor="product-condition">Condition</label><select id="product-condition" name="condition" value={form.condition} onChange={update}><option value="new">New</option><option value="used">Used</option><option value="refurbished">Refurbished</option><option value="not_applicable">Not applicable</option></select></div></div>
    <div className="form-field"><label htmlFor="product-specifications">Additional specifications</label><textarea id="product-specifications" name="specifications" value={form.specifications} onChange={update} maxLength="1000" rows="2" placeholder="Variety, ingredients, grade, dimensions, or storage details." /></div>
    <div className="form-field"><label htmlFor="product-photo">Product photograph <small>JPG, PNG, or WebP · up to 5 MB</small></label><input id="product-photo" type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" onChange={choosePhoto} />{photoPreview && <img className="product-photo-preview" src={photoPreview} alt="Product photo preview" />}</div>
    {demoMode && <p className="demo-safety-notice"><ShieldAlert size={16} /> Preview listings and photos are session-only. Production catalog publishing requires the merchant product migration.</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="primary-button wide-button" type="submit" disabled={busy || Boolean(error)}>{busy ? "Saving listing…" : initialProduct ? "Save product changes" : "Create product listing"}</button>
    <p className="fine-print">{demoMode ? "This is a non-persistent preview. No listing is published to the live marketplace." : "Your verified listing will be visible when in stock."}</p>
  </form></Dialog>;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read the selected product photo."));
    reader.readAsDataURL(file);
  });
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
  const [inventory, setInventory] = useDemoState(demoMode ? starterInventory : []);
  const [inventoryLoading, setInventoryLoading] = useState(!demoMode);
  const [inventoryError, setInventoryError] = useState("");
  const [merchantOrders, setMerchantOrders] = useDemoState(demoMode ? starterMerchantOrders : []);
  const [merchantPayouts, setMerchantPayouts] = useDemoState(demoMode ? starterMerchantPayouts : []);
  const [merchantInsights, setMerchantInsights] = useDemoState(demoMode ? starterMerchantInsights : []);
  const [merchantQuestions, setMerchantQuestions] = useDemoState(demoMode ? starterMerchantQuestions : []);
  const [customerMerchantQuestions, setCustomerMerchantQuestions] = useState([]);
  const [customerQuestionsOwner, setCustomerQuestionsOwner] = useState(null);
  const [customerQuestionsLoading, setCustomerQuestionsLoading] = useState(false);
  const [customerQuestionsError, setCustomerQuestionsError] = useState("");
  const [merchantOrdersOwner, setMerchantOrdersOwner] = useState(null);
  const [merchantPayoutsOwner, setMerchantPayoutsOwner] = useState(null);
  const [merchantInsightsOwner, setMerchantInsightsOwner] = useState(null);
  const [merchantQuestionsOwner, setMerchantQuestionsOwner] = useState(null);
  const [merchantOrdersLoading, setMerchantOrdersLoading] = useState(!demoMode);
  const [merchantPayoutsLoading, setMerchantPayoutsLoading] = useState(!demoMode);
  const [merchantInsightsLoading, setMerchantInsightsLoading] = useState(!demoMode);
  const [merchantQuestionsLoading, setMerchantQuestionsLoading] = useState(!demoMode);
  const [merchantOrdersError, setMerchantOrdersError] = useState("");
  const [merchantPayoutsError, setMerchantPayoutsError] = useState("");
  const [merchantInsightsError, setMerchantInsightsError] = useState("");
  const [merchantQuestionsError, setMerchantQuestionsError] = useState("");
  const [questionProduct, setQuestionProduct] = useState(null);
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
  const [editingProduct, setEditingProduct] = useState(null);
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
    if (demoMode || account?.role !== "merchant" || account.verificationStatus !== "verified") return undefined;
    let active = true;
    setInventoryLoading(true);
    setInventoryError("");
    loadMerchantProducts()
      .then(items => { if (active) setInventory(items); })
      .catch(error => { if (active) setInventoryError(`Could not load your listings: ${error.message}`); })
      .finally(() => { if (active) setInventoryLoading(false); });
    return () => { active = false; };
  }, [demoMode, account?.id, account?.role, account?.verificationStatus]);

  useEffect(() => {
    if (demoMode || account?.role !== "merchant" || account.verificationStatus !== "verified") return undefined;
    let active = true;
    let initialized = false;
    let previousPending = new Set();
    setMerchantOrders([]);
    setMerchantPayouts([]);
    setMerchantInsights([]);
    setMerchantQuestions([]);
    setMerchantOrdersOwner(null);
    setMerchantPayoutsOwner(null);
    setMerchantInsightsOwner(null);
    setMerchantQuestionsOwner(null);
    setMerchantOrdersLoading(true);
    setMerchantPayoutsLoading(true);
    setMerchantInsightsLoading(true);
    setMerchantQuestionsLoading(true);
    setMerchantOrdersError("");
    setMerchantPayoutsError("");
    setMerchantInsightsError("");
    setMerchantQuestionsError("");

    async function refreshOrders() {
      try {
        const rows = await loadMerchantOrders();
        if (!active) return;
        const pendingIds = new Set(rows.filter(row => row.status === "awaiting_merchant").map(row => row.id));
        if (initialized && [...pendingIds].some(id => !previousPending.has(id))) {
          setToast("A new paid order is ready for your review.");
        }
        initialized = true;
        previousPending = pendingIds;
        setMerchantOrders(rows);
        setMerchantOrdersOwner(account.id);
        setMerchantOrdersError("");
      } catch (error) {
        if (active) setMerchantOrdersError(`Could not load merchant orders: ${error.message}`);
      } finally {
        if (active) setMerchantOrdersLoading(false);
      }
    }

    async function refreshPayouts() {
      try {
        const rows = await loadMerchantPayouts();
        if (!active) return;
        setMerchantPayouts(rows);
        setMerchantPayoutsOwner(account.id);
        setMerchantPayoutsError("");
      } catch (error) {
        if (active) setMerchantPayoutsError(`Could not load payout records: ${error.message}`);
      } finally {
        if (active) setMerchantPayoutsLoading(false);
      }
    }

    async function refreshInsights() {
      try {
        const rows = await loadMerchantInsights();
        if (!active) return;
        setMerchantInsights(rows);
        setMerchantInsightsOwner(account.id);
        setMerchantInsightsError("");
      } catch (error) {
        if (active) setMerchantInsightsError(`Could not load product insights: ${error.message}`);
      } finally {
        if (active) setMerchantInsightsLoading(false);
      }
    }

    async function refreshQuestions() {
      try {
        const rows = await loadMerchantQuestions();
        if (!active) return;
        setMerchantQuestions(rows);
        setMerchantQuestionsOwner(account.id);
        setMerchantQuestionsError("");
      } catch (error) {
        if (active) setMerchantQuestionsError(`Could not load customer questions: ${error.message}`);
      } finally {
        if (active) setMerchantQuestionsLoading(false);
      }
    }

    void refreshOrders();
    void refreshPayouts();
    void refreshInsights();
    void refreshQuestions();
    const timer = window.setInterval(() => { void refreshOrders(); }, 20000);
    const payoutTimer = window.setInterval(() => { void refreshPayouts(); }, 60000);
    const insightsTimer = window.setInterval(() => { void refreshInsights(); }, 60000);
    const questionsTimer = window.setInterval(() => { void refreshQuestions(); }, 60000);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.clearInterval(payoutTimer);
      window.clearInterval(insightsTimer);
      window.clearInterval(questionsTimer);
    };
  }, [demoMode, account?.id, account?.role, account?.verificationStatus]);

  useEffect(() => {
    if (!demoMode || !demoAccount) return;
    const phoneKey = demoAccount.phone?.replace(/\D/g, "") || "";
    const accountKey = demoAccount.role === "merchant"
      ? `merchant:${demoAccount.email?.trim().toLowerCase()}`
      : phoneKey;
    if (accountKey && !demoAccounts[accountKey]) {
      setDemoAccounts(current => ({ ...current, [accountKey]: { ...demoAccount, phoneKey } }));
    }
  }, [demoAccount, demoAccounts, setDemoAccounts]);

  useEffect(() => {
    if (account?.role !== "consumer" || demoMode) {
      setCustomerMerchantQuestions([]);
      setCustomerQuestionsOwner(null);
      setCustomerQuestionsLoading(false);
      setCustomerQuestionsError("");
      return undefined;
    }
    let active = true;
    setCustomerMerchantQuestions([]);
    setCustomerQuestionsOwner(null);
    setCustomerQuestionsLoading(true);
    setCustomerQuestionsError("");
    async function refreshQuestions() {
      try {
        const rows = await loadCustomerMerchantQuestions();
        if (!active) return;
        setCustomerMerchantQuestions(rows);
        setCustomerQuestionsOwner(account.id);
        setCustomerQuestionsError("");
      } catch (error) {
        if (active) setCustomerQuestionsError(`Could not load your merchant messages: ${error.message}`);
      } finally {
        if (active) setCustomerQuestionsLoading(false);
      }
    }
    void refreshQuestions();
    const timer = window.setInterval(() => { void refreshQuestions(); }, 60000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [demoMode, account?.id, account?.role]);

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
    const currentQuantity = cart.find(line => line.productId === product.id)?.quantity || 0;
    const maxQuantity = Math.min(99, Number.isInteger(product.stock) ? product.stock : 99);
    if (currentQuantity >= maxQuantity) {
      notify(maxQuantity === 0 ? `${product.name} is out of stock` : `Only ${maxQuantity} ${product.unit || "items"} available`);
      return;
    }
    setCart(current => {
      const existing = current.find(line => line.productId === product.id);
      if (existing) return current.map(line => line.productId === product.id ? { ...line, quantity: Math.min(99, line.quantity + 1) } : line);
      return current.length >= 100 ? current : [...current, { productId: product.id, quantity: 1 }];
    });
    notify(`${product.name} added to your basket`);
  }
  function changeQuantity(productId, difference) {
    const product = products.find(item => item.id === productId);
    const maxQuantity = Math.min(99, Number.isInteger(product?.stock) ? product.stock : 99);
    setCart(current => current.map(line => line.productId === productId ? { ...line, quantity: Math.min(maxQuantity, line.quantity + difference) } : line).filter(line => line.quantity > 0));
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
  async function refreshMerchantOrderList() {
    if (demoMode) return;
    setMerchantOrdersLoading(true);
    try {
      setMerchantOrders(await loadMerchantOrders());
      setMerchantOrdersOwner(account.id);
      setMerchantOrdersError("");
    } catch (error) {
      setMerchantOrdersError(`Could not refresh merchant orders: ${error.message}`);
    } finally {
      setMerchantOrdersLoading(false);
    }
  }
  async function changeMerchantOrderStatus(orderId, status, handoffNote) {
    if (demoMode) {
      setMerchantOrders(current => current.map(order => order.id === orderId
        ? { ...order, status, handoffNote: handoffNote || order.handoffNote, shipmentStatus: status === "at_hub" ? "at_hub" : order.shipmentStatus }
        : order));
      notify("Demo order status updated for this session.");
      return;
    }
    await updateMerchantOrderStatus(orderId, status, handoffNote);
    notify("Order status updated.");
    try {
      setMerchantOrders(await loadMerchantOrders());
      setMerchantOrdersOwner(account.id);
      setMerchantOrdersError("");
    } catch (error) {
      setMerchantOrdersError(`Order was updated, but the latest order list could not be loaded: ${error.message}`);
    }
  }
  function openMerchantQuestion(product) {
    if (account?.role !== "consumer") {
      notify("Sign in with a customer account to ask this merchant a question.");
      setEntryPage("login");
      return;
    }
    setQuestionProduct(product);
    setDialog("askQuestion");
  }
  async function submitMerchantQuestion(question) {
    if (!questionProduct) throw new Error("Choose a product to ask about.");
    const newQuestion = {
      id: `question-${Date.now()}`,
      offerId: questionProduct.id,
      productName: questionProduct.name,
      question: question.trim(),
      answer: "",
      status: "open",
      createdAt: new Date().toISOString(),
    };
    if (demoMode) {
      setMerchantQuestions(current => [newQuestion, ...current]);
      setCustomerMerchantQuestions(current => [newQuestion, ...current]);
    } else {
      await askMerchantQuestion(questionProduct.id, question);
      try {
        const questions = await loadCustomerMerchantQuestions();
        setCustomerMerchantQuestions(questions);
        setCustomerQuestionsOwner(account.id);
        setCustomerQuestionsError("");
      } catch (error) {
        setCustomerQuestionsError(`Your question was sent, but history could not be refreshed: ${error.message}`);
      }
    }
    setDialog(null);
    setQuestionProduct(null);
    notify("Your question was sent to the merchant.");
  }
  async function replyToMerchantQuestion(questionId, reply) {
    if (demoMode) {
      setMerchantQuestions(current => current.map(question => question.id === questionId
        ? { ...question, answer: reply.trim(), status: "answered", answeredAt: new Date().toISOString() }
        : question));
      setCustomerMerchantQuestions(current => current.map(question => question.id === questionId
        ? { ...question, answer: reply.trim(), status: "answered", answeredAt: new Date().toISOString() }
        : question));
      notify("Demo reply saved for this session.");
      return;
    }
    await answerMerchantQuestion(questionId, reply);
    try {
      const questions = await loadMerchantQuestions();
      setMerchantQuestions(questions);
      setMerchantQuestionsOwner(account.id);
      setMerchantQuestionsError("");
      notify("Your reply was sent.");
    } catch (error) {
      setMerchantQuestionsError(`Your reply was sent, but the inbox could not refresh: ${error.message}`);
    }
  }
  async function saveProduct(form, existingProduct) {
    if (!demoMode) {
      const savedProduct = await saveMerchantProduct(account.id, form, existingProduct);
      setDialog(null);
      setEditingProduct(null);
      notify(`${form.name.trim()} ${existingProduct ? "updated" : "listed"} successfully.`);
      try {
        setInventory(await loadMerchantProducts());
        setInventoryError("");
        setProducts(await loadPublicProducts());
      } catch (error) {
        setInventoryError(`Product saved, but catalog data could not refresh: ${error.message}`);
      }
      if (savedProduct?.warning) notify(savedProduct.warning);
      return null;
    }

    const id = existingProduct?.id || `product-${Date.now()}`;
    const item = {
      ...existingProduct,
      id,
      name: form.name.trim(),
      category: form.category,
      price: form.price,
      stock: form.stock,
      unit: form.unit.trim(),
      description: form.description.trim(),
      brand: form.brand.trim(),
      size: form.size.trim(),
      origin: form.origin.trim(),
      specifications: form.specifications.trim(),
      condition: form.condition,
      imageUrl: form.imageUrl || existingProduct?.imageUrl || null,
      checked: "Updated just now",
      seller: "Your verified stall",
      rating: "New",
      note: "Price checked",
      image: "photo-1542838132-92c53300491e",
    };
    const listingId = existingProduct?.catalogProductId || id;
    const imageProduct = { ...item, id: listingId, catalogProductId: listingId, imageUrl: item.imageUrl, productId: existingProduct?.productId || listingId };
    if (existingProduct) {
      setInventory(current => current.map(existing => existing.id === id ? { ...item, catalogProductId: listingId } : existing));
      setProducts(current => current.some(existing => existing.id === listingId)
        ? current.map(existing => existing.id === listingId ? { ...existing, ...imageProduct } : existing)
        : [imageProduct, ...current]);
    } else {
      setInventory(current => [item, ...current]);
      setProducts(current => [imageProduct, ...current]);
    }
    setDialog(null);
    setEditingProduct(null);
    notify(`${item.name} ${existingProduct ? "updated" : "listed"} in preview.`);
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
      let uploadedPaths = [];
      let uploadedDocuments = {};
      let applicationSaved = false;
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
          uploadedDocuments = await uploadMerchantDocuments(application);
          uploadedPaths = [uploadedDocuments.identityDocumentPath, uploadedDocuments.businessDocumentPath].filter(Boolean);
          const { error: applicationError } = await supabase.from("merchant_profiles").insert({
            user_id: data.user.id,
            store_name: application.stall,
            market_name: application.market,
            stall_number: application.stallNumber,
            landmark: application.landmark,
            verification_status: "pending",
            identity_document_type: application.identityDocumentType,
            identity_document_path: uploadedDocuments.identityDocumentPath,
            identity_document_asset_id: uploadedDocuments.identityDocumentAssetId,
            business_evidence_type: application.businessEvidenceType,
            business_document_path: uploadedDocuments.businessDocumentPath,
            business_document_asset_id: uploadedDocuments.businessDocumentAssetId,
            accepted_policy_version: application.acceptedPolicyVersion,
          });
          if (applicationError) throw applicationError;
          applicationSaved = true;
        }
        setAccount(await loadAccountProfile(data.user.id));
        return null;
      } catch (registrationError) {
        if (applicationSaved) {
          const { identityFile, businessFile, ...applicationDetails } = newAccount.application;
          setAccount({
            id: data.user.id,
            role: "merchant",
            name: newAccount.name,
            email: data.user.email,
            phone: newAccount.phone,
            verificationStatus: "pending",
            application: {
              ...applicationDetails,
              identityDocumentPath: uploadedDocuments.identityDocumentPath,
              identityDocumentAssetId: uploadedDocuments.identityDocumentAssetId,
              businessDocumentPath: uploadedDocuments.businessDocumentPath,
              businessDocumentAssetId: uploadedDocuments.businessDocumentAssetId,
            },
          });
          notify(`Your application was submitted, but status refresh failed: ${registrationError.message}`);
          return null;
        }
        if (uploadedPaths.length) {
          try {
            await removeMerchantDocuments(uploadedPaths);
          } catch (cleanupError) {
            registrationError = new Error(`${registrationError.message} Temporary document cleanup also failed: ${cleanupError.message}`);
          }
        }
        await supabase.auth.signOut();
        return { error: registrationError.message || "Could not save your application." };
      }
    }

    const phoneKey = newAccount.phone.replace(/\D/g, "");
    if (phoneKey.length < 7) return { error: "Enter a valid mobile number." };
    if (newAccount.role === "merchant"
      && (!newAccount.email?.trim() || newAccount.password.length < 12)) {
      return { error: "Merchant sign-up requires a valid email and a password with at least 12 characters." };
    }
    if (Object.values(demoAccounts).some(saved => saved.phoneKey === phoneKey)) {
      return { error: "An account already uses this number. Login with its registered role." };
    }
    const accountKey = newAccount.role === "merchant"
      ? `merchant:${newAccount.email.trim().toLowerCase()}`
      : phoneKey;
    if (demoAccounts[accountKey]) return { error: "An account already uses this email. Login with its registered role." };
    let savedApplication;
    if (newAccount.application) {
      const { identityFile, businessFile, ...applicationData } = newAccount.application;
      savedApplication = {
        ...applicationData,
        identityFileName: identityFile.name,
        identityFileSize: identityFile.size,
        identityFileType: identityFile.type,
        businessFileName: businessFile.name,
        businessFileSize: businessFile.size,
        businessFileType: businessFile.type,
      };
    }
    const savedAccount = { ...newAccount, application: savedApplication, phoneKey };
    setDemoAccounts(current => ({ ...current, [accountKey]: savedAccount }));
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
          return { error: `This email is registered as a ${loadedAccount.role}. Choose that role to continue.` };
        }
        setAccount({ ...loadedAccount, email: data.user.email });
        return null;
      } catch (loginError) {
        await supabase.auth.signOut();
        return { error: loginError.message || "Could not load your account." };
      }
    }

    const accountKey = role === "merchant"
      ? `merchant:${identifier.trim().toLowerCase()}`
      : identifier.replace(/\D/g, "");
    const savedAccount = demoAccounts[accountKey];
    if (!savedAccount) return { error: `No ${role} account found for that ${role === "merchant" ? "email" : "number"}. Register first.` };
    if (savedAccount.role !== role) return { error: `This account is registered as a ${savedAccount.role}. Choose that role to continue.` };
    if (role === "merchant" && savedAccount.password !== password) return { error: "The email or password is incorrect." };
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
    let uploadedPaths = [];
    let applicationSaved = false;
    try {
      const documents = await uploadMerchantDocuments(application);
      uploadedPaths = [documents.identityDocumentPath, documents.businessDocumentPath].filter(Boolean);
      let saveError;
      if (account.application) {
        const { error } = await supabase.rpc("resubmit_merchant_application", {
          new_store_name: application.stall,
          new_market_name: application.market,
          new_stall_number: application.stallNumber,
          new_landmark: application.landmark,
          new_identity_document_type: application.identityFile ? application.identityDocumentType : null,
          new_identity_document_path: documents.identityDocumentPath || null,
          new_identity_document_asset_id: documents.identityDocumentAssetId || null,
          new_business_evidence_type: application.businessFile ? application.businessEvidenceType : null,
          new_business_document_path: documents.businessDocumentPath || null,
          new_business_document_asset_id: documents.businessDocumentAssetId || null,
          new_accepted_policy_version: application.acceptedPolicyVersion,
        });
        saveError = error;
      } else {
        const { error } = await supabase.from("merchant_profiles").insert({
          user_id: account.id,
          store_name: application.stall,
          market_name: application.market,
          stall_number: application.stallNumber,
          landmark: application.landmark,
          verification_status: "pending",
          identity_document_type: application.identityDocumentType,
          identity_document_path: documents.identityDocumentPath,
          identity_document_asset_id: documents.identityDocumentAssetId,
          business_evidence_type: application.businessEvidenceType,
          business_document_path: documents.businessDocumentPath,
          business_document_asset_id: documents.businessDocumentAssetId,
          accepted_policy_version: application.acceptedPolicyVersion,
        });
        saveError = error;
      }
      if (saveError) {
        if (uploadedPaths.length) await removeMerchantDocuments(uploadedPaths);
        return { error: saveError.message };
      }
      applicationSaved = true;
      const { identityFile, businessFile, ...applicationDetails } = application;
      const refreshedAt = new Date().toISOString();
      const nextApplication = {
        ...applicationDetails,
        identityDocumentPath: documents.identityDocumentPath || account.application?.identityDocumentPath,
        identityDocumentAssetId: documents.identityDocumentAssetId || account.application?.identityDocumentAssetId,
        businessDocumentPath: documents.businessDocumentPath || account.application?.businessDocumentPath,
        businessDocumentAssetId: documents.businessDocumentAssetId || account.application?.businessDocumentAssetId,
        acceptedPolicyAt: refreshedAt,
        submittedAt: refreshedAt,
      };
      setAccount(current => ({
        ...current,
        application: nextApplication,
        verificationStatus: "pending",
        reviewFeedback: "",
      }));
      const oldPaths = [
        identityFile ? account.application?.identityDocumentPath : null,
        businessFile ? account.application?.businessDocumentPath : null,
      ].filter(Boolean);
      try {
        setAccount(await loadAccountProfile(account.id));
      } catch (refreshError) {
        notify(`Application resubmitted, but account status could not refresh: ${refreshError.message}`);
      }
      if (oldPaths.length) {
        try {
          await removeMerchantDocuments(oldPaths);
        } catch (cleanupError) {
          notify(`Application resubmitted, but replaced document cleanup failed: ${cleanupError.message}`);
        }
      }
    } catch (resubmissionError) {
      if (!applicationSaved && uploadedPaths.length) {
        try {
          await removeMerchantDocuments(uploadedPaths);
        } catch (cleanupError) {
          return { error: `${resubmissionError.message} Temporary document cleanup also failed: ${cleanupError.message}` };
        }
      }
      if (applicationSaved) {
        notify(`Application resubmitted, but post-save cleanup failed: ${resubmissionError.message}`);
        return null;
      }
      return { error: resubmissionError.message || "Could not resubmit your merchant application." };
    }
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
    setEditingProduct(null);
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
      <ShopView products={products} cart={cart} onAdd={addToCart} onAskQuestion={openMerchantQuestion} onQuantity={changeQuantity} onCheckout={() => openCheckout(null)} onClearCart={() => setCart([])} walletBalance={walletBalance} notify={notify} search={search} activeCategory={activeCategory} setActiveCategory={setActiveCategory} sort={sort} setSort={setSort} supportCases={[]} order={order} account={null} accountName="Guest" onLogin={() => setEntryPage("login")} onRegister={() => setEntryPage("register")} onLogout={() => {}} onRefreshOrder={refreshOrder} purchaseHistory={purchaseHistory} priorities={customerPriorities} onTogglePriority={toggleCustomerPriority} demoMode={demoMode} isGuest catalogLoading={catalogLoading} catalogError={catalogError} />
      <Toast message={toast} />
    </div>;
  }
  if (account.staffRoles?.length) return <AdminView account={account} onExit={logout} />;
  if (account.role === "merchant" && account.verificationStatus !== "verified") return <MerchantApplicationStatus account={account} onLogout={logout} onResubmit={resubmitMerchantApplication} />;

  return <div className="app-shell" id="top">
    <Header search={search} setSearch={setSearch} cartCount={cartCount} walletBalance={walletBalance} onWallet={() => document.getElementById("wallet")?.scrollIntoView({ behavior: "smooth", block: "center" })} onCart={() => document.getElementById("cart")?.scrollIntoView({ behavior: "smooth", block: "center" })} account={account} onLogout={logout} demoMode={demoMode} />
    <main>{account.role === "consumer" ? <ShopView products={products} cart={cart} onAdd={addToCart} onAskQuestion={openMerchantQuestion} onQuantity={changeQuantity} onCheckout={openCheckout} onClearCart={() => { setCart([]); notify("Basket cleared"); }} walletBalance={walletBalance} notify={notify} search={search} activeCategory={activeCategory} setActiveCategory={setActiveCategory} sort={sort} setSort={setSort} order={order} account={account} accountName={account.name} onVerify={() => setDialog("verification")} onComplaint={() => demoMode ? notify("Support cases are available when the backend is connected.") : setDialog("complaint")} onLogin={() => setEntryPage("login")} onRegister={() => setEntryPage("register")} onLogout={logout} onRefreshOrder={refreshOrder} supportCases={supportCases} purchaseHistory={purchaseHistory} priorities={customerPriorities} onTogglePriority={toggleCustomerPriority} demoMode={demoMode} cartLoading={cartLoading} catalogLoading={catalogLoading} catalogError={catalogError} merchantQuestions={demoMode || customerQuestionsOwner === account.id ? customerMerchantQuestions : []} merchantQuestionsLoading={customerQuestionsLoading} merchantQuestionsError={customerQuestionsError} /> : <MerchantView inventory={inventory} onAddProduct={productHandler} onEditProduct={item => { setEditingProduct(item); setDialog("addProduct"); }} onVerify={() => setDialog("verification")} account={account} demoMode={demoMode} inventoryLoading={inventoryLoading} inventoryError={inventoryError} orders={demoMode || merchantOrdersOwner === account.id ? merchantOrders : []} payouts={demoMode || merchantPayoutsOwner === account.id ? merchantPayouts : []} insights={demoMode || merchantInsightsOwner === account.id ? merchantInsights : []} insightsLoading={merchantInsightsLoading} insightsError={merchantInsightsError} questions={demoMode || merchantQuestionsOwner === account.id ? merchantQuestions : []} questionsLoading={merchantQuestionsLoading} questionsError={merchantQuestionsError} onAnswerQuestion={replyToMerchantQuestion} ordersLoading={merchantOrdersLoading} payoutsLoading={merchantPayoutsLoading} ordersError={merchantOrdersError} payoutsError={merchantPayoutsError} onUpdateOrder={changeMerchantOrderStatus} onRefreshOrders={refreshMerchantOrderList} />}</main>
    {dialog === "checkout" && checkoutTotals && <CheckoutDialog totals={checkoutTotals} walletBalance={walletBalance} onClose={() => setDialog(null)} onPlaceOrder={placeOrder} />}
    {dialog === "askQuestion" && questionProduct && <MerchantQuestionDialog product={questionProduct} onClose={() => { setDialog(null); setQuestionProduct(null); }} onSubmit={submitMerchantQuestion} />}
    {dialog === "addProduct" && <ProductDialog key={editingProduct?.id || "new-product"} onClose={() => { setDialog(null); setEditingProduct(null); }} onSave={saveProduct} initialProduct={editingProduct} demoMode={demoMode} />}
    {dialog === "verification" && <VerificationDialog onClose={() => setDialog(null)} />}
    {dialog === "complaint" && <ComplaintDialog onClose={() => setDialog(null)} onSubmit={submitCustomerComplaint} />}
    <Toast message={toast} />
  </div>;
}
