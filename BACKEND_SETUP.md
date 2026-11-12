# Backend Setup (Supabase)

This is backend milestone 1: managed email/password authentication, role-bound profiles, merchant applications, catalog/offer records, and a protected order/payment schema. It does not yet make checkout, payment, refunds, or fulfillment production-ready. Those writes have no browser policies and require trusted server functions in a later milestone.

## Single hosted project workflow

Use the existing hosted Supabase project and Vercel Production deployment as requested. Do not configure SMS OTP. While this project is being privately tested, email confirmation may be temporarily disabled to let test accounts sign in immediately. Do not open registration to the public in that state.

### 1. Configure email/password authentication

1. Open **Authentication > Sign In / Providers > Email** and ensure Email is enabled.
2. Disable the **Phone** provider while OTP is not part of the login flow.
3. For private pre-release testing, turn off **Confirm email** so registrations receive a session immediately. Anyone who can reach the Production URL can register while confirmation is off, so use test data only and keep the site restricted if possible.
4. Set the Auth Site URL to your Vercel Production origin. Email/password auth requires no SMS provider or OTP delivery.
5. Before public launch, turn **Confirm email** back on, configure email delivery, and test confirmation, recovery, abuse controls, and expired/reused credentials.

### 2. Apply the database migration

Install the Supabase CLI using Supabase's current Windows instructions. Docker is not required to link and push migrations to a hosted project.

From the repository root, authenticate and link the production project:

```sh
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

The CLI may request the database password in the terminal. Enter it there; do not put it in source files. Inspect the migration plan/output and confirm the destination project reference before applying. Then run Supabase **Security Advisor** and check that every exposed table has the intended RLS policies.

The migration `20261110000100_merchant_onboarding_documents.sql` adds the private `merchant-verification` Storage bucket, evidence and policy-acceptance fields, reviewer-only application evidence, and the resubmission workflow. Apply it only after reviewing the draft merchant policies and the migration's RLS rules. The bucket must remain private; do not add a public read policy or service-role key to the browser.

The migration `20261110000200_merchant_product_management.sql` adds merchant-owned product listing RPCs and the public `merchant-product-images` bucket. Product photos are public catalog assets; identity evidence remains in its separate private bucket. Verified merchants can create and edit their own descriptions, specifications, category, price, stock, and photo. Use the merchant dashboard only after this migration has been applied; demo changes remain session-only.

The migration `20261112000100_merchant_orders_and_payouts.sql` adds owner-checked RPCs for verified merchants to read paid orders and move them through acceptance, preparation, and hub handoff. New orders are checked every 20 seconds while the merchant dashboard is open. The RPC returns the delivery area/landmark and item snapshots, not the customer's name, phone, or full address. Merchants cannot write order, payment, or shipment tables directly. The migration also adds a payout ledger: only trusted server/service-role workflows can create payout records, while merchants can read their own records. This migration does not create orders, execute payouts, issue refunds, reserve stock, or assign riders.

The migration `20261112000200_merchant_insights_and_questions.sql` adds customer product questions with merchant replies, customer-side message history, and verified-merchant insights RPCs. Product performance and demand are calculated from paid order lines over the prior 7/30 days. Stock guidance is a simple 14-day pace estimate, not a forecast. Price ranges compare active verified offers with the same category, selling unit, and size; they may still differ in quality or origin. Merchant questions reveal no customer contact details. All records and RPC results are account-scoped.

### 3. Connect the Vercel Production deployment

In Vercel, open the project **Settings > Environment Variables** and add these for **Production**:

```text
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_STAGING_PUBLISHABLE_OR_ANON_KEY
```

Use the key field shown by Supabase. If it is a newer publishable key, it is still the client key consumed by `VITE_SUPABASE_ANON_KEY`. Never add a service-role key to Vercel frontend variables. Save and redeploy Production; environment changes apply to new deployments, not existing ones.

### 4. Verify the hosted integration

- Register one test consumer using an email address you control and a unique password.
- Sign out and sign back in; confirm the profile role remains `consumer`.
- Try selecting the other role for that same account; confirm the app rejects the mismatch.
- Register a test merchant with dummy identity and business files; confirm the application is `pending`, documents are in the private bucket, the policy version and acceptance time are recorded, and the merchant cannot reach selling tools.
- Assign a test reviewer the `merchant_reviewer` staff role; confirm the reviewer can create short-lived evidence download links, complete the four checks, and record decisions in the audit trail.
- Request changes and sign in as the applicant; confirm reviewer feedback appears, evidence can be replaced, current policy acceptance is required again, and resubmission resets checks to incomplete.
- As a verified merchant, create a listing with a photo, specifications, category, price, and stock; edit each field, set stock to zero, and confirm the listing is no longer available in the public catalog. Check that another merchant cannot read or modify the listing through the merchant RPCs.
- After applying `20261112000100_merchant_orders_and_payouts.sql`, seed paid test orders through a trusted test/server workflow. As the owning verified merchant, verify new-order notifications, accept an order, start preparation, and record a hub handoff note. Confirm another merchant cannot view or update those orders. Confirm payout records are visible only to their owner and cannot be inserted or edited using the client key.
- After applying `20261112000200_merchant_insights_and_questions.sql`, ask a question from an active listing as a test customer, reply as its verified merchant, and confirm the customer sees the reply in Profile > Product questions. Verify another merchant cannot read/reply to the question. Seed paid orders at multiple dates and active offers with matching and non-matching pack sizes; confirm 7/30-day totals, stock guidance, and price comparisons include only their intended records.
- Never use real identity or business documents in demo mode. Demo mode stores only file metadata and does not provide secure document storage or real verification.
- In Supabase, confirm profile and merchant application rows exist and use Security Advisor/API checks to verify cross-user reads/writes are denied.
- Checkout, payment processing, refunds, payout execution, inventory reservation, rider assignment, and final delivery updates remain unavailable. They must stay disabled until secure server-side order transactions and the relevant payment/logistics integrations are implemented.

### 5. Enable public registration only after launch gates

The URL/key connection does not make commerce production-ready. This app still has no server-side order creation, inventory reservation, payment initiation/webhook verification, settlement, refund workflow, or production delivery workflow. Merchant policy text is a draft and must be reviewed and finalized before public launch; establish retention/deletion rules for identity documents and train reviewers before accepting real verification records. Before allowing public signup, re-enable email confirmation, configure recovery and abuse controls, review RLS/security, backups, privacy/legal obligations, payment/settlement, and operations. Do not accept real orders/payments until those workflows are implemented and tested.

Never add a Supabase `service_role` key, database password, or payment-provider secret to a `VITE_` variable. The publishable/anon key is intentionally public; Row Level Security is the access boundary.

## Current schema/security boundary

- A database trigger creates one profile per Supabase Auth user and fixes its account type as `consumer` or `merchant`.
- Email uniqueness is delegated to Supabase Auth; the database profile role is immutable for each authenticated identity.
- Merchant contact phone numbers collected during email/password signup are unverified contact details, not authentication factors.
- Merchant applications are submitted as `pending` with required identity/business evidence and a versioned policy acceptance. A private Storage bucket limits evidence reads to the owner and assigned merchant reviewers; reviewer actions use protected database functions and are audited. Applications with requested changes can be resubmitted with replacement evidence and renewed policy acceptance.
- The merchant policy checklist and its version string are release-gated draft terms, not final legal terms. Demo mode stores only test-account data and document metadata; it never uploads or securely retains the selected files.
- Only verified merchants can expose offers or change their own product listings through the security-definer merchant RPCs. Product moderation remains a trusted administrative operation. Merchant product photos are intentionally public catalog assets; never upload identity or business verification documents to that bucket.
- Verified merchants read their own paid orders through a security-definer RPC that reveals only item snapshots and delivery area/landmark. Their status changes are limited to awaiting-merchant → accepted → preparing → at-hub; those changes are audited. Direct client writes to orders, payments, refunds, shipments, and order events remain denied.
- Merchant payout records are stored in a service-role-only ledger and exposed to their owner through a read RPC. The dashboard does not initiate transfers or treat order sales as completed payouts; settlement creation and reconciliation remain trusted backend responsibilities.
- Customer product questions are created only by authenticated customer accounts for active verified-merchant offers; merchants can read/reply only to their own questions, and customers can read only their own question history. Merchant insights reveal only their listing metrics plus aggregate prices for verified active offers matching category, selling unit, and size; no competitor identity or customer identity is exposed.
- Analytics use recorded order lines, not product page views, and only paid-order statuses. Stock recommendations are a transparent 14-day moving-pace heuristic. Price comparisons are broad pack/category comparisons and do not assert identical quality or origin.
- `price_minor_units` is integer minor currency units (kobo for NGN); convert only at display boundaries and never use floating-point values for financial calculations.
- The existing demo cart and checkout are not connected to this schema. Demo merchant orders and payouts are examples and are not persisted. Live merchant order tools require the new migration and orders created by a trusted server workflow. Do not accept real orders/payments until server-side checkout, inventory reservation, idempotency, verified provider webhooks, settlement rules, and reconciliation are implemented and tested.

## Local environment safety

`.env` and `.env.*` are ignored by Git; `.env.example` is the safe template. The Supabase publishable/anon client key may be exposed to the browser only because RLS is the access boundary. Never expose a service-role key, database password, SMS-provider secret, or payment-provider secret. If a secret is ever committed, rotate it in its provider even after removing it from Git history.
