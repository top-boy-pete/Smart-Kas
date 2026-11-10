# Smart Kasua Feature Checklist

Status key: checked items are present in the current browser demo; unchecked items remain to be built. A checked demo item is not a claim of production readiness.

## Customer Marketplace

- [x] Landing page and separate registration and login screens (browser-local demo only; not secure authentication).
- [x] Consumer and merchant account-role selection (demo checks one role per normalized phone number in local storage; server enforcement is still needed).
- [ ] Secure account authentication, recovery, sessions, and server-enforced single-role ownership.
- [ ] Customer profiles and saved delivery addresses.
- [x] Browse the seeded product list by its current flat categories.
- [x] Basic search over product name, seller, and category; category filter; price sorting.
- [ ] Product detail pages with specifications, availability, delivery estimates, and return terms.
- [ ] Merchant storefront pages.
- [ ] Compare equivalent products/offers from different merchants.
- [ ] Customer ratings and reviews tied to verified completed purchases.
- [ ] Product recommendations based on relevance and customer preferences.
- [ ] Favorites and saved products.
- [x] One local demo cart can hold items listed by different sellers; it has no server-side order splitting or inventory reservation.
- [x] Checkout summary displays subtotal, a fixed demo delivery fee, and a demo service fee.
- [ ] Delivery-fee calculation by location/merchant/order and realistic estimated delivery times.
- [x] Wallet, Paystack, Flutterwave, and USSD are shown as checkout choices.
- [ ] Real payment initiation, verification, settlement, refunds, and payment failure handling.
- [x] Local order confirmation and simulated status tracking.
- [ ] Order cancellation and refund requests with policy rules.
- [ ] Customer support and issue/dispute handling.
- [ ] Order history and downloadable receipts.
- [ ] In-app, SMS, or push notifications for order progress.
- [ ] Clear, data-backed availability, merchant identity, delivery expectations, fees, and return conditions on each offer.

## Merchant Dashboard and Operations

- [x] Guided merchant registration collects legal/contact details, business/stall/location details, and required ID and business evidence.
- [x] Private identity/business document storage, reviewer evidence access, verification checks, resubmission, decisions, and audit history are implemented in Supabase migrations and the app; not active until deployed and configured.
- [x] Versioned merchant policy acceptance is recorded with its timestamp; the current concise checklist is draft text and must be reviewed/finalized before public launch.
- [x] Merchant onboarding dashboard shows review status, milestones, submitted evidence metadata, and reviewer feedback; demo mode warns and stores only dummy-file metadata.
- [x] Product creation form with name, category, unit, price, and stock (local demo only).
- [ ] Product editing, photo upload, and complete product specifications.
- [x] Category selection for a new product; no specialization requirement is enforced.
- [ ] Server-backed pricing and stock management with reservation and out-of-stock handling.
- [ ] Order notifications, acceptance/decline, and fulfillment status updates.
- [ ] Collection, hub handoff, rider assignment, and delivery coordination.
- [ ] Three-tier merchant ranking with published eligibility rules.
- [ ] Reliable sales ledger, payout records, reconciliation, and statements.
- [ ] Customer questions, merchant support, and dispute workflows.
- [ ] Product performance analytics and demand insights.
- [ ] Pricing comparisons and stock recommendations.
- [ ] Merchant performance reports.
- [ ] Confirmed general-merchant and specialist-merchant participation through explicit policy and account tests.

## Catalog and Offers

- [x] Seeded product records have basic name, category, price, seller, unit, image reference, and rating fields in one local object.
- [ ] Hierarchical categories and subcategories.
- [ ] Searchable attributes, structured specifications, and product variants.
- [ ] Separate canonical product records from merchant-specific offers when product identity is reliably matched.
- [ ] Matching safeguards that keep materially different model, size, specification, condition, or authenticity as separate products.
- [ ] Merchant-specific offer price, stock, condition, authenticity evidence, delivery estimate, and return conditions.
- [ ] Comparable offers for the same reliably matched product.
- [ ] Duplicate-listing detection and review tools.
- [ ] Search relevance, attribute filters, and location-aware offer filtering.

## Ranking, Fairness, and Discovery

- [ ] Ranking considers relevance, total cost, suitability, availability, seller reliability, verified quality, delivery, return terms, and customer preferences.
- [ ] Fairness constraints and monitoring prevent sales history from dominating ranking.
- [ ] Merchant exposure/visibility measurement and reporting.
- [ ] Controlled discovery opportunities for eligible newer or smaller merchants when relevant and competitive.
- [ ] Validate that ranking remains useful; do not promise equal sales or substitute random ordering for relevance.

## Recommended Build Order

1. Production identity, role enforcement, customer profiles/addresses, merchant verification, and policy records.
2. Normalized catalog and merchant-offer model, product matching, stock, delivery, and return data.
3. Order lifecycle, real payment integration, delivery coordination, receipts, notifications, support, cancellations, and refunds.
4. Merchant analytics and measurable search/ranking fairness with controlled discovery.
