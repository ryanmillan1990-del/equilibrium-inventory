# Staff Registration – Equilibrium Intertrade

## Apply SQL first
Run `sql/011_staff_registration.sql` in existing Supabase project's SQL editor. Do not rerun 001_phase1.sql.
Your existing ADMIN and WAREHOUSE accounts remain unchanged; active accounts become APPROVED.

## Deploy
Keep existing `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` set as Vercel **server** environment variables (never put the service role key in browser JS). Copy the updated files into your existing repo, commit, push, and wait for Vercel Ready.

## Use
Open `/index.html`, Register, enter full name / requested role / password (12+ chars).
New account is created in Supabase Auth and `staff_profiles` with `is_active=false`, `approval_status=PENDING`.
Existing Admin signs in, visits Dashboard > User Management, approves or rejects. Only APPROVED active accounts can enter inventory.
Admin login requests never automatically elevate privileges.

## Important
- `@equinventory.com` emails are *login IDs*, not mailboxes. Password reset and email delivery will not work until an actual email/recovery mechanism is arranged. In Supabase Email Auth configuration, use appropriate verification settings; the API creates confirmed Auth users but profile stays inactive until approved.
- Public self-registration endpoint needs bot protection and rate limiting before open internet use. Recommend Cloudflare Turnstile / WAF and Vercel-level rate limiting.
- Existing business RPCs may only authorize ADMIN / WAREHOUSE. Audit those before allowing TECHNICAL borrowing or stock management. `currentStaff` and issuance API now recognize TECHNICAL.
- Keep a trusted existing Admin account. Never set new ADMIN account active without review.
- Admin approvals work through server-only service role key after verifying requester is an active approved Admin.
