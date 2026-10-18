
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import {
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
} from './config.js';

if (
  !SUPABASE_URL ||
  !SUPABASE_PUBLISHABLE_KEY ||
  SUPABASE_URL.includes('REPLACE_') ||
  SUPABASE_PUBLISHABLE_KEY.includes('REPLACE_')
) {
  throw new Error(
    'Configure js/config.js with your Supabase credentials.'
  );
}

export const db = createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

export async function currentStaff() {

  console.log('========== STAFF AUTH CHECK ==========');

  // STEP 1: VERIFY LOGGED-IN USER
  const { data: auth, error: authError } =
    await db.auth.getUser();

  console.log('User ID:', auth?.user?.id);
  console.log('Authentication Error:', authError);

  if (authError || !auth?.user) {
    console.log('No authenticated user found.');
    return null;
  }

  // STEP 2: CHECK STAFF PROFILE
  const { data: staff, error: staffError } =
    await db
      .from('staff_profiles')
      .select('id, full_name, role, is_active')
      .eq('id', auth.user.id)
      .maybeSingle();

  console.log('Staff Data:', staff);
  console.log('Staff Error:', staffError);

  if (staffError) {
    throw staffError;
  }

  // STEP 3: VERIFY AUTHORIZATION
  if (!staff) {
    console.error(
      'Staff profile not found or not visible under RLS.'
    );
    return null;
  }

  if (staff.is_active !== true) {
    console.error('Staff account is inactive.');
    return null;
  }

  if (!['ADMIN', 'WAREHOUSE', 'TECHNICAL'].includes(staff.role)) {
    console.error('Invalid staff role:', staff.role);
    return null;
  }

  console.log('AUTHORIZED STAFF:', staff.full_name);
  console.log('ROLE:', staff.role);
  console.log('======================================');

  return staff;
}
