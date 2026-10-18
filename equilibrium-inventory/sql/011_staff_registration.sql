-- RUN ONCE as project owner in Supabase SQL Editor.
-- Preserve existing staff IDs, roles and active accounts.
ALTER TABLE public.staff_profiles DROP CONSTRAINT IF EXISTS staff_profiles_role_check;
ALTER TABLE public.staff_profiles ADD CONSTRAINT staff_profiles_role_check
  CHECK (role IN ('ADMIN', 'WAREHOUSE', 'TECHNICAL'));
ALTER TABLE public.staff_profiles ADD COLUMN IF NOT EXISTS approval_status text;
UPDATE public.staff_profiles
SET approval_status = CASE WHEN is_active THEN 'APPROVED' ELSE 'PENDING' END
WHERE approval_status IS NULL;
ALTER TABLE public.staff_profiles ALTER COLUMN approval_status SET DEFAULT 'PENDING';
ALTER TABLE public.staff_profiles ALTER COLUMN approval_status SET NOT NULL;
ALTER TABLE public.staff_profiles DROP CONSTRAINT IF EXISTS staff_profiles_approval_status_check;
ALTER TABLE public.staff_profiles ADD CONSTRAINT staff_profiles_approval_status_check
  CHECK (approval_status IN ('PENDING','APPROVED','REJECTED'));
-- Existing self-read policy only exposes active users; pending accounts must not have inventory access.
-- Admin listing runs server-side after verifying the requesting active Admin.
-- No browser UPDATE/INSERT permissions added.
