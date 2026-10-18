
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
  const {data:{user},error:authError}=await db.auth.getUser();
  if(authError || !user) return null;
  const {data:staff,error}=await db.from('staff_profiles')
    .select('id,full_name,role,is_active,approval_status')
    .eq('id',user.id).maybeSingle();
  if(error) throw error;
  if(!staff || staff.is_active !== true || staff.approval_status !== 'APPROVED'
      || !['ADMIN','WAREHOUSE','TECHNICAL'].includes(staff.role)) return null;
  return staff;
}
