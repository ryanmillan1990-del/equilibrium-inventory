import { createClient } from '@supabase/supabase-js';
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if (!['GET','POST'].includes(req.method)) {res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Method not allowed'});}
  if(!url || !key) return res.status(500).json({error:'Server is not configured'});
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return res.status(401).json({error:'Sign in required'});
  const db = createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  try {
    const {data:{user},error:authError} = await db.auth.getUser(auth.slice(7));
    if(authError || !user) return res.status(401).json({error:'Invalid session'});
    const {data:staff,error:staffError} = await db.from('staff_profiles')
      .select('role,is_active,approval_status').eq('id',user.id).maybeSingle();
    if(staffError) throw staffError;
    if(staff?.role!=='ADMIN' || !staff.is_active || staff.approval_status!=='APPROVED')
      return res.status(403).json({error:'Administrator access required'});
    if(req.method==='GET') {
      const {data,error} = await db.from('staff_profiles')
        .select('id,full_name,role,is_active,approval_status,created_at')
        .order('created_at',{ascending:false});
      if(error) throw error;
      return res.status(200).json({staff:data});
    }
    const origin = req.headers.origin;
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    if(origin && (!host || new URL(origin).host !== host)) return res.status(403).json({error:'Invalid request origin'});
    const {id,decision}=req.body || {};
    if(!uuid.test(String(id)) || !['APPROVED','REJECTED'].includes(decision))
      return res.status(400).json({error:'Invalid staff ID or decision'});
    if(id===user.id) return res.status(400).json({error:'Cannot change your own approval'});
    const {data:pending,error:lookupError} = await db.from('staff_profiles')
      .select('approval_status').eq('id',id).maybeSingle();
    if(lookupError) throw lookupError;
    if(!pending || pending.approval_status !== 'PENDING')
      return res.status(409).json({error:'Only pending registrations can be reviewed'});
    const {data,error} = await db.from('staff_profiles').update({
      approval_status:decision,is_active:decision==='APPROVED'
    }).eq('id',id).eq('approval_status','PENDING').select('id').maybeSingle();
    if(error) throw error;
    if(!data) return res.status(409).json({error:'This request was already reviewed'});
    return res.status(200).json({message:decision==='APPROVED'?'Account approved':'Registration rejected'});
  } catch(e) {
    console.error('Staff management error:',e.message);
    return res.status(500).json({error:'Unable to manage staff accounts'});
  }
}
