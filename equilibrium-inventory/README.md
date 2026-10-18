# Equilibrium Inventory — Phase 1

1. Create a NEW Supabase project.
2. SQL Editor: run `sql/001_phase1.sql` once.
3. Authentication > Providers > Email: disable public self-sign-up; keep email/password sign-in enabled.
4. Authentication > Users > Add user: create first Admin and confirm email as required. Copy the user's UUID.
5. Edit `sql/002_create_first_admin.sql` with copied UUID, then run in SQL Editor.
6. Copy **Project URL** and **publishable key** (or legacy anon key) from Supabase project settings into `js/config.js`. NEVER use service_role/secret key.
7. In VS Code terminal, with this project folder open, run `py -m http.server 5500` (or `python -m http.server 5500`).
8. Go to http://localhost:5500 and sign in. You should land on Dashboard (initially 0 machines).
9. To test machine read access, run the below in SQL Editor, then reload Dashboard:

```sql
insert into public.machines(asset_code,machine_name,brand,model,serial_number,category,location)
values('EQ-0001','JL22 Coffee Machine','Jetinno','JL22','JL22-TEST-001','Coffee Machine','Main Warehouse');
```

10. Verify a nonexistent/unapproved Auth account cannot access machine data. Do not create browser-side registration or direct client write actions.

No borrow, return, or general machine registration writes are exposed in Phase 1. Add controlled RPCs in the following stage.

## Updated Admin Approval & Technical Workspace (Phase 12)

See **`PHASE12_DESIGN_AND_APPROVAL_SETUP.md`** for the new role-based UI,
required Supabase SQL migration (`sql/012_machine_requests_and_permissions.sql`),
admin approval flow, deployment sequence, and safety checks. The migration is
**not** applied automatically by GitHub or Vercel.
