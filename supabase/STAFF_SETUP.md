# Staff access and admin workflows

Apply the migrations in order before using the live staff workspace:

1. `supabase/migrations/20261014000100_backend_foundation.sql`
2. `supabase/migrations/20261029000100_staff_admin_workflows.sql`
3. `supabase/migrations/20261029000200_customer_carts.sql`

The public storefront reads active products and verified merchant offers directly from Supabase; it does not use a local product database. Visitors can browse and add offers to a device-local guest basket without signing in. On consumer sign-in, that basket is merged into the consumer's Supabase cart and removed from local storage. Signed-in cart changes are saved through authenticated database functions. Checkout and payment remain unavailable.

Staff log in through **Staff access** with a normal Supabase Auth account. A login has no admin access unless an operator explicitly assigns one or more rows in `public.staff_roles`. Role assignment is not available from the browser/API; provision roles only through a trusted Supabase SQL session or a separately secured operator process.

For example, after creating the staff user's Auth account, an operator can grant one role by email:

```sql
insert into public.staff_roles (user_id, role)
select id, 'merchant_reviewer'
from auth.users
where lower(email) = lower('reviewer@example.com')
on conflict (user_id, role) do nothing;
```

Available roles are `merchant_reviewer`, `support_agent`, `account_manager`, `operations_viewer`, `catalog_reviewer`, `finance_reviewer`, `finance_approver`, and `audit_viewer`. The live control center currently exposes merchant review, complaint handling, finance approvals, and audit history only to their corresponding roles. Other preview sections are not exposed as live data.

Merchant check changes, merchant decisions, merchant resubmissions, complaint updates, complaint submissions, and finance approval requests/decisions create audit events in the same database transaction. Merchant approval is rejected unless all four checks are complete. Applicants can only resubmit after `needs_changes`, and staff feedback is returned to the applicant. Complaint notes created by staff are internal-only. Customer complaint inserts are restricted to the customer's own account and optional own order.

Finance reviewers can submit a request with an amount, reference, and reason. A different user assigned `finance_approver` must approve or reject it with a reason. Approval records are controls only: this migration does not execute payments, refunds, payout releases, or payment adjustments.
