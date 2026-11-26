# Smart-Kas (Kasua) → Next.js Migration Documentation

This document records the complete audit of the original application and every change made
while migrating it to Next.js. The guiding constraint throughout was **preserve everything**:
UI/UX, interactions, business logic, routing, integrations and behavior are byte-for-byte
equivalent to the original.

- **Source app:** Vite 6 + React 18.3 single-page application (`appType: "spa"`)
- **Target app:** Next.js 14.2.15 (App Router), React 18.3
- **Target location:** `nextjs/` (kept alongside the original so the two can be compared side-by-side)
- **Migration date:** 2026-11-26

---

## 1. Original codebase audit

### 1.1 Entry points and shell

| Concern | Original file | Notes |
| --- | --- | --- |
| HTML shell | `index.html` | `#root` mount, `<title>Kasua \| Masaka Market</title>`, meta description, `theme-color #f4f6ef`, Google Fonts (DM Sans + Manrope) |
| Bootstrap | `src/main.jsx` | Mounts `<App />` into `#root` |
| Root component | `src/App.jsx` (1990 lines) | Contains **all** page components and the default `App()` export |
| Global styles | `src/styles.css` (1062 lines) | Global CSS (no `@import`/`@font-face`; two Unsplash `url()` images) |

### 1.2 Screens / page-level components (all inside `src/App.jsx`)

Marketing & auth:
- `LandingPage`, `RegisterPage`, `MerchantRegistrationWizard`, `LoginPage`, `StaffLoginPage`, `MerchantProfilePage`

Customer experience:
- `CustomerDashboard`, `CustomerOrdersPage`, `CustomerProfilePage`, `ShopView` (inline), `Header`, `MobileBottomNav`, `CustomerSidebarNav`

Merchant experience:
- `MerchantView`, `MerchantQuestionsPanel`, `MerchantQuestionCard`, `MerchantInsightsPanel`, `MerchantOrderCard`, `MerchantPayouts`

Panels & dialogs:
- `BasketPanel`, `WalletPanel`, `DeliveryPanel`, `TrustPanel`, `SupportPanel`, `CheckoutDialog`, `MerchantQuestionDialog`, `ProductDialog`, `ComplaintDialog`, `VerificationDialog`, `GuestNavDialog`, `Dialog`, `Toast`, `ProductCard`, `CategoryPicker`, `MerchantPolicyAcceptance`, `StatCard`, `IconButton`, `Brand`, `AuthHeader`

Separate modules:
- `src/AdminView.jsx` (451 lines) — staff/admin control center (`AdminView` + 14 sub-views: `Overview`, `AccountsView`, `MerchantReviewView`, `OrdersView`, `LogisticsView`, `ComplaintsView`, `CatalogView`, `FinanceRiskView`, `ReportsView`, `StatusTag`, `SectionHeading`, `Metric`, `Table`, `SearchField`)
- `src/MerchantFinancialDashboard.jsx` (405 lines) — ledger, CSV statement export (`FinancialStat`, `MerchantLedgerDocument`)
- `src/MerchantCreditReadiness.jsx` (236 lines) — credit-readiness profile + printable report (`ReadinessStat`, `CreditProfilePrintReport`)

### 1.3 Routing structure

There is **no router library**. Routing is state-driven:

- `entryPage` Zustand state ∈ `{ "landing", "login", "register", "staff-login", "admin" }`.
- `src/store/app-store.js` → `initialEntryPage(demoMode)` reads `window.location.pathname` on boot:
  `/admin` → `"admin"` when demo mode, otherwise `"staff-login"`; every other path → `"landing"`.
- `App()` re-reads the pathname and listens to `popstate` to keep `entryPage` in sync.
- After login the rendered screen is chosen by `account` / `account.staffRoles`.

**Public URLs that must be preserved:** `/` (the whole customer/merchant app) and `/admin` (staff sign-in or demo control center).

### 1.4 State management

- **Zustand 5** (`src/store/app-store.js`).
- `createAppStore({ demoMode, supabaseConfigured })` defines ~48 initial state keys and auto-generates one setter per key (`set<Key>`).
- `useAppState(key)` is the primary hook returning `[value, setter]`.
- Extra actions: `setCartForUser`, `setAdminDataForOwner`, `configureForEnvironment`.
- Persistence via `localStorage`: `kasua-cart`, `kasua-purchase-history`, `kasua-customer-priorities` (helpers `readStored` / `storedCart` / `storedRecord` in `src/data.js` and the store).

### 1.5 API / data layer (`src/lib/`)

| Module | Responsibility |
| --- | --- |
| `supabase.js` | Supabase browser client + `supabaseConfigured` + `demoMode` flags + `loadAccountProfile(userId)` |
| `admin.js` | Staff roles, merchant applications, review decisions, complaints, financial approvals, audit events |
| `catalog.js` | `loadPublicProducts()` |
| `cart.js` | `loadCustomerCart`, `mergeGuestCart`, `saveCustomerCart` |
| `complaints.js` | `createComplaint`, `loadCustomerComplaints` |
| `merchant-onboarding.js` | Document validation, upload, removal |
| `merchant-products.js` | Load/save merchant products, photo validation |
| `merchant-orders.js` | Load orders, update status, load payouts |
| `merchant-insights.js` | Insights + customer/merchant Q&A |
| `merchant-finances.js` | Financial activity, expenses, credit readiness profile, order items |
| `merchant-finance-utils.js` | Date ranges, summaries, CSV statement builder |
| `merchant-credit-profile-utils.js` | Normalize credit-readiness profile |
| `cloudinary.js` | Signed asset upload/delete/download URLs via Supabase Edge Function `merchant-cloudinary` |

External integrations: **Supabase** (auth session + `onAuthStateChange`, Postgres RPCs, storage, Edge Function) and **Cloudinary** (signed uploads/downloads) and **lucide-react** icons.

### 1.6 Business-logic rules captured

- **Demo mode gating:** `!supabaseConfigured && DEV && VITE_DEMO_MODE !== "false"` seeds starter data and enables the `/admin` demo control center.
- **Guest vs. authenticated:** guest cart merges into the customer cart on login (`mergeGuestCart`); purchase history and priorities are keyed per account.
- **Merchant verification flow:** registration wizard → document upload → pending review → approve / request-changes, with policy acceptance versioning.
- **Wallet, checkout totals, payout handling, complaint lifecycle, financial approval workflow, audit trail** — all preserved unchanged.
- **Naira formatting** via `formatNaira`.

### 1.7 Environment variables (Vite)

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_CLOUDINARY_CLOUD_NAME`, `VITE_DEMO_MODE`
- `import.meta.env.DEV` used for dev-only gating.

---

## 2. Rendering strategy decision

The application is **inherently client-only**: `App()` and the store read `window.location.pathname`
at module-evaluation time, use `localStorage`, `popstate`, `document`, and the Supabase auth session
(`detectSessionInUrl`). None of this can run on the server.

Therefore the migration uses the **App Router with client-only rendering**:

- Root routes are thin `"use client"` wrappers that load the original `App.jsx` through
  `next/dynamic` with `{ ssr: false }`.
- `src/App.jsx` is marked `"use client"` so every hook/effect behaves exactly as in the SPA.

This yields the same client-side runtime behavior and DOM output as the original while gaining
Next.js routing, bundling and build tooling. Static generation still applies to the route shells
(they are prerendered as static content), and the full app hydrates on the client.

---

## 3. Target project structure

```
nextjs/
├── app/
│   ├── layout.jsx          # Root layout: metadata, viewport, Google Fonts, globals.css
│   ├── globals.css         # Copy of src/styles.css + additive production block (§7.4)
│   ├── page.jsx            # "/"  → client-only <App /> (wrapped in ErrorBoundary)
│   ├── admin/page.jsx      # "/admin" → client-only <App /> (wrapped in ErrorBoundary)
│   ├── error.jsx           # Route error boundary (production hardening, §7.1)
│   └── global-error.jsx    # Last-resort error boundary (production hardening, §7.1)
├── public/
│   └── smk.jpeg            # Brand logo (unchanged)
├── src/                    # Ported application source (unchanged except env + "use client")
│   ├── App.jsx
│   ├── AdminView.jsx
│   ├── MerchantFinancialDashboard.jsx
│   ├── MerchantCreditReadiness.jsx
│   ├── data.js
│   ├── components/
│   │   └── ErrorBoundary.jsx   # Reusable boundary (production hardening, §7.1)
│   ├── lib/*               # 14 modules (supabase.js / cloudinary.js adapted for env)
│   └── store/*             # app-store.js (+ test)
├── next.config.mjs
├── jsconfig.json
├── vercel.json
├── .env.example
└── .gitignore
```

---

## 4. Changes made during conversion

### 4.1 New files (scaffolding)

| File | Purpose |
| --- | --- |
| `nextjs/package.json` | Next.js project manifest (scripts + deps) |
| `nextjs/next.config.mjs` | `reactStrictMode: true`, ESLint ignored during build |
| `nextjs/jsconfig.json` | `@/*` path alias |
| `nextjs/.gitignore` | Ignore `node_modules`, `.next`, `out`, env files, `next-env.d.ts` |
| `nextjs/.env.example` | Documented Next.js env vars |
| `nextjs/vercel.json` | `framework: "nextjs"` deploy config |
| `nextjs/app/layout.jsx` | Root layout (metadata/viewport/fonts) |
| `nextjs/app/globals.css` | Copy of original `styles.css` |
| `nextjs/app/page.jsx` | `/` route |
| `nextjs/app/admin/page.jsx` | `/admin` route |
| `nextjs/public/smk.jpeg` | Brand logo |

### 4.2 Copied verbatim (no logic changes)

- `src/App.jsx`, `src/AdminView.jsx`, `src/MerchantFinancialDashboard.jsx`, `src/MerchantCreditReadiness.jsx`, `src/data.js`
- `src/lib/*` (except `supabase.js`, `cloudinary.js` — see below)
- `src/store/app-store.js`
- `src/styles.css` → `app/globals.css` (base copy verbatim; additive production block appended later — §7.4)

`src/main.jsx` was **not** copied (its job is now performed by `app/page.jsx` + `app/layout.jsx`).

### 4.3 Modified files (minimal, mechanical)

**`app/layout.jsx`** — reproduces the original `index.html` `<head>`:
- `metadata.title` = `"Kasua | Masaka Market"`
- `metadata.description` = `"Shop Masaka's trusted local traders with Kasua."`
- `viewport.themeColor` = `"#f4f6ef"`
- Google Fonts preconnect + `DM Sans`/`Manrope` stylesheet link (identical href)

**`src/lib/supabase.js`** — env access:
```js
// before
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const demoMode = !supabaseConfigured && import.meta.env.DEV && import.meta.env.VITE_DEMO_MODE !== "false";
// after
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
export const demoMode = !supabaseConfigured && process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_DEMO_MODE !== "false";
```
Client creation options, `supabaseConfigured`, and `loadAccountProfile` are unchanged.

**`src/lib/cloudinary.js`** — env access:
```js
const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim();
```
All validation, upload, delete and download-URL logic is unchanged.

**`src/App.jsx`** — a single `"use client";` directive prepended as the first line. No other change.

**`app/page.jsx` / `app/admin/page.jsx`** — new client-only route wrappers (see §2).

### 4.4 Environment-variable mapping

| Vite | Next.js |
| --- | --- |
| `VITE_SUPABASE_URL` | `NEXT_PUBLIC_SUPABASE_URL` |
| `VITE_SUPABASE_ANON_KEY` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `VITE_CLOUDINARY_CLOUD_NAME` | `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` |
| `VITE_DEMO_MODE` | `NEXT_PUBLIC_DEMO_MODE` |
| `import.meta.env.DEV` | `process.env.NODE_ENV !== "production"` |

### 4.5 Routing preservation

| Original behavior | Next.js implementation |
| --- | --- |
| `/` renders the full customer/merchant app | `app/page.jsx` |
| `/admin` sets `entryPage` to `admin` (demo) or `staff-login` (prod) | `app/admin/page.jsx` — `App()` still reads `window.location.pathname` |
| `popstate` keeps `entryPage` in sync | unchanged (client-side) |

Both routes render the same `App()`; the pathname check inside `App()`/the store continues to decide
which screen is shown, so navigation semantics are identical.

### 4.6 Dependency changes

- Added: `next@14.2.15`
- Kept identical versions: `@supabase/supabase-js@^2.117.3`, `lucide-react@^0.468.0`, `react@^18.3.1`, `react-dom@^18.3.1`, `zustand@^5.1.0`
- Removed: `vite`, `@vitejs/plugin-react` (dev-only build tools)

---

## 5. How to run, build and deploy

```bash
cd nextjs
cp .env.example .env.local   # fill in Supabase/Cloudinary values (optional for demo mode)
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
npm start        # production server
```

- **Demo mode** activates automatically when Supabase env vars are absent and
  `NODE_ENV !== "production"` (disable with `NEXT_PUBLIC_DEMO_MODE=false`).
- **Deploy:** `vercel.json` declares `framework: "nextjs"`. Configure the `NEXT_PUBLIC_*` variables in
  the hosting dashboard and the `CLOUDINARY_*` secrets as Supabase Edge Function secrets (never client-side).

---

## 6. What was intentionally NOT changed

- Component markup, class names, styling and CSS.
- All Zustand state shape, setters and the `useAppState` hook.
- All Supabase queries, RPCs, storage and Edge Function calls.
- All Cloudinary upload/download logic and validation rules.
- All business rules (demo gating, guest-cart merge, merchant review, wallet/payout, complaints,
  financial approvals, audit, Naira formatting).
- All user flows, dialogs, toasts and responsive breakpoints. The original 1,062-line stylesheet
  is left untouched; production CSS is only *appended* (see §7.4).

---

## 7. Production hardening (additive, non-breaking)

A later request asked to refine the project to production-grade standards. Because the earlier
mandate was to preserve the original exactly, the agreed scope was **additive and non-breaking**:
new files, new `next.config.mjs` options and *appended* CSS only. No existing component, class name,
state shape, business rule, flow or base CSS rule was modified. Deployment-pipeline work was
explicitly out of scope for this pass.

### 7.1 Error handling & resilience

| File | Purpose |
| --- | --- |
| `src/components/ErrorBoundary.jsx` | Reusable React error boundary (class component). Wraps the client-only `<App />` so an uncaught render error shows an on-brand "Something went wrong / Reload" fallback instead of a blank page. Logs the error + component stack to the console. |
| `app/error.jsx` | Next.js route-segment error boundary (`Try again` / `Reload`). Renders inside the root layout. |
| `app/global-error.jsx` | Last-resort boundary (root-layout failures); renders its own `<html>`/`<body>`. |
| `app/page.jsx`, `app/admin/page.jsx` | Now wrap `<App />` in `<ErrorBoundary>`. |

All fallbacks are only shown when an error occurs, so the happy-path DOM is unchanged.

### 7.2 Security hardening (`next.config.mjs`)

Security headers are applied to **every** route via `headers()`:

- `Content-Security-Policy` — `default-src 'self'`; allow-lists Google Fonts (`fonts.googleapis.com`
  / `fonts.gstatic.com`), Supabase (`https://*.supabase.co`, `wss://*.supabase.co`), Cloudinary
  (`api.cloudinary.com`, `res.cloudinary.com`) and https images. `'unsafe-eval'` is added **only in
  development**; `upgrade-insecure-requests` **only in production**. (`object-src 'none'`,
  `base-uri 'self'`, `frame-ancestors 'none'`.)
- `Strict-Transport-Security` (production only), `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`,
  `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`,
  `Cross-Origin-Opener-Policy: same-origin`, `X-DNS-Prefetch-Control: on`.
- `poweredByHeader: false` — removes the `X-Powered-By` framework header.

The CSP reflects the app's actual network surface: no external `<script>` tags, no `eval`, and no
geolocation are used by the application.

### 7.3 Performance (`next.config.mjs`)

- `compress: true` — gzip/br response compression.
- `experimental.optimizePackageImports: ["lucide-react"]` — tree-shakes the icon barrel.
- `Cache-Control: public, max-age=31536000, immutable` for `/_next/static/*` (content-hashed assets).
- (`reactStrictMode: true` retained.)

No visual or behavioural change; font loading keeps the original Google Fonts `<link>` for parity.

### 7.4 Responsive & touch (appended to `app/globals.css`)

The original stylesheet is untouched; a clearly-marked block is appended at the end:

| Block | Effect |
| --- | --- |
| `@media (max-width: 380px)` | Extra-small-mobile tuning: smaller logo, tighter paddings, adjusted type scale, product-grid gap, hero/landing scale. |
| `@media (hover: none) and (pointer: coarse)` | Ensures ≥44px touch targets for icon/primary/text/quantity/add buttons, chips, nav items and admin controls; suppresses hover-only card motion on non-hovering devices. |
| `@media (hover: hover) and (pointer: fine)` | Fills hover-state gaps (category chips, role switch, mobile nav, admin tabs/filters/row buttons). |

Because these rules are either new breakpoints (< 380px) or media-gated to pointer capabilities, the
desktop rendering verified in §4–§5 of `VERIFICATION.md` is unchanged.
