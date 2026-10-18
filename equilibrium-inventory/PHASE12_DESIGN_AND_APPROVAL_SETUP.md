# Equilibrium Inventory — Visual Redesign & Admin Approval Workflow

## New experience

The site has a shared forest-green, coffee-brown, cream gradient theme on all pages, responsive cards/tables, and role-specific dashboard links.

| Capability | Admin | Technical / Warehouse |
|---|---|---|
| View inventory and machine QR labels | Yes | Yes |
| Submit borrow and return requests | No (reviews them) | Yes |
| Approve/reject a request | Yes | No |
| Check request tracking | All requests | Their own requests |
| Manage staff registrations | Yes | No |
| Register new machines / accessories / deliveries | Yes | No |
| View complete historical loans / generate issuance form | Yes | No |

**Important:** A submitted request does not borrow or return the machine. Machine status and loan records change only after Admin approval. A rejected request causes no inventory change. Approving a return records the **Admin as receiving staff**, and approving a borrow records the **Admin as releasing staff**, consistent with the existing legacy transaction RPCs. The original Technical requester is saved separately on the request. A new machine cannot receive two simultaneous pending requests.

## Setup order — do not skip

1. **Make a Supabase backup**. Use a staging project first if possible.
2. In Supabase SQL Editor, confirm your current schema includes `public.staff_profiles.approval_status`, role `TECHNICAL`, the original RPC functions, and `sql/010_inventory_extensions.sql` tables.
3. Upload or push the **full updated project** to the *same* GitHub-connected folder (keep `.git` and private `.env` files). `api/` must be in the project root seen by Vercel. If deployed nested, set Vercel Root Directory to `equilibrium-inventory` only when that is the actual GitHub layout.
4. On Vercel confirm the deployment shows **Ready** and the previously configured endpoints `/api/staff-management`, `/api/register-staff`, `/api/product-issuance` are included. If an endpoint gives 404 HTML, fix deployment/root configuration before attempting admin staff approval. **Never store the service-role key in frontend JS.**
5. Run **`sql/012_machine_requests_and_permissions.sql` in Supabase SQL Editor** as project owner. This is a required database change; pushing HTML/JS does *not* execute SQL. It intentionally removes direct authenticated EXECUTE permissions on the old borrowing/returning, history, and registration RPCs and replaces them with Admin-only wrappers and request/approval RPCs. **Do not rerun old SQL definitions of those legacy functions afterwards without reviewing privileges.**
6. Refresh the deployed site (Ctrl+Shift+R). Log in as an approved Technical Staff account. Open Machine Inventory → View QR → machine details → **Borrow Request** or **Return Request** → submit, then open **My Requests**.
7. Log in as approved Admin. Open Dashboard → **Request Approvals**, review request details, approve one test request, and verify the machine status / Loaner History. Then test a rejected request and verify inventory did not change.
8. Confirm Admin can still use **User Management, Register Machine, Accessories, Deliveries, Loaner History**, and Technical accounts do not see or successfully invoke those sensitive workflows.

## Required existing RPCs

This patch deliberately **reuses your existing business logic and issuance-number assignment**. The migration expects all of these original functions to already exist: `public.borrow_machine`, `public.return_machine`, `public.register_machine`, `public.get_loan_history`, `public.register_accessory`, and `public.create_client_delivery`. It calls them with the named arguments used by this uploaded project. If your live functions differ, inspect their signatures in Supabase and adjust the migration before running it.

```sql
select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as arguments,
       pg_get_function_result(p.oid) as returns
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in (
 'borrow_machine','return_machine','register_machine','get_loan_history',
 'register_accessory','create_client_delivery')
order by 2;
```

### Verify direct legacy calls are restricted

```sql
select p.proname,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in
  ('borrow_machine','return_machine','register_machine','register_accessory',
   'create_client_delivery','get_loan_history')
order by p.proname;
```

Expected after running SQL 012: `authenticated_can_execute = false` for the legacy functions. Approvals can still run them indirectly inside the checked SECURITY DEFINER database function. **Database roles, not hidden HTML buttons, enforce this restriction.**

### If something fails

- **404 with `<!DOCTYPE html>`** on `/api/staff-management`: Vercel routing / Root Directory issue, unrelated to the SQL migration.
- **Could not find function `submit_machine_action_request`**: SQL 012 was not successfully run in the connected Supabase project; reload PostgREST schema cache if needed.
- **Permission denied** for a legacy RPC on Technical login: expected; submit a request instead.
- **Request approval errors**: request remains pending and loan/machine updates roll back. Read the Supabase error and verify your original RPC names/arguments.
- **`currentStaff` unavailable**: make sure `approval_status` exists and the account is `APPROVED` + `is_active=true`.
- **Admin UI doesn't show new buttons**: hard-refresh, check correct Vercel domain, and verify that the latest Git commit was deployed.

## Security and live rollout limitations

- Keep `SUPABASE_SERVICE_ROLE_KEY` in Vercel server-only environment variables. Do not upload local `.env` values.
- The supplied SQL tightens the policies present in the attached `sql/001_phase1.sql`. If you previously installed **additional RLS policies or additional SECURITY DEFINER APIs** outside the ZIP, audit them before launch; the migration cannot detect or restrict every unknown custom function/policy.
- Public self-registration can be spammed; use bot protection, rate limits, and internal staff verification before allowing broad public access.
- The rollout could briefly interrupt old clients because the legacy RPCs are intentionally disabled. Coordinate the frontend deployment and SQL migration, preferably during a maintenance window.
- This package has static syntax checks, but it has **not** been connected to or end-to-end tested against your live Supabase/Vercel account. Test with non-production machines or a staging copy before relying on it.
