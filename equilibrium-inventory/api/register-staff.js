import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const validName = /^[\p{L}][\p{L} .'-]{1,99}$/u;
const slug = (v) => v.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g,'');

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow','POST'); return res.status(405).json({error:'Method not allowed'}); }
  if (!url || !key) return res.status(500).json({error:'Server is not configured'});
  // Check the Origin on browsers; production website only.
  const origin = req.headers.origin;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  if (origin && (!host || new URL(origin).host !== host)) return res.status(403).json({error:'Invalid request origin'});
  const { full_name, role, password } = req.body || {};
  const name = String(full_name || '').trim().replace(/\s+/g,' ');
  const selectedRole = String(role || '').toUpperCase();
  if (!validName.test(name) || !['ADMIN','TECHNICAL'].includes(selectedRole)
      || typeof password !== 'string' || password.length < 12 || password.length > 128)
    return res.status(400).json({error:'Enter a full name, valid role and password of 12–128 characters'});
  const namePart = slug(name);
  if (!namePart || namePart.length > 55) return res.status(400).json({error:'Name cannot generate a valid login email'});
  const email = `${namePart}@equinventory.com`;
  const admin = createClient(url, key, {auth:{persistSession:false,autoRefreshToken:false}});
  let createdId;
  try {
    // Email addresses are internal login IDs. No actual mailbox is provisioned.
    const created = await admin.auth.admin.createUser({
      email, password, email_confirm:true,
      user_metadata:{full_name:name}
    });
    if (created.error) {
      if (/already|registered|exists|duplicate/i.test(created.error.message))
        return res.status(409).json({error:'This generated login email is already in use. Contact your administrator.'});
      throw created.error;
    }
    createdId = created.data.user.id;
    const {error} = await admin.from('staff_profiles').insert({
      id:createdId,full_name:name,role:selectedRole,is_active:false,approval_status:'PENDING'
    });
    if (error) throw error;
    return res.status(201).json({message:'Registration submitted for administrator approval.',email});
  } catch(e) {
    if(createdId) await admin.auth.admin.deleteUser(createdId).catch(()=>{});
    console.error('Registration failure:', e.message);
    return res.status(500).json({error:'Could not submit registration. Contact your administrator.'});
  }
}
