import {db,currentStaff} from './client.js';
const $=id=>document.getElementById(id);
(async()=>{
  try{
    const staff=await currentStaff();
    if(!staff){location.replace('./index.html');return;}
    if(staff.role==='ADMIN'){location.replace('./approvals.html');return;}
    $('staffName').textContent=`${staff.full_name} · ${staff.role}`;
    const {data,error}=await db.from('machine_action_requests')
      .select('id,machine_id,action,status,borrower_name,created_at,reviewed_at')
      .eq('requested_by',staff.id).order('created_at',{ascending:false}).limit(100);
    if(error)throw error;
    const {data:machines,error:machineError}=await db.from('machines').select('id,machine_name,asset_code');
    if(machineError)throw machineError;
    const map=new Map((machines||[]).map(m=>[m.id,m]));
    const body=$('requestRows');body.replaceChildren();
    for(const r of data||[]){
      const tr=body.insertRow(),m=map.get(r.machine_id)||{};
      for(const value of [m.machine_name||'Machine',m.asset_code||'—',r.action,r.borrower_name||'—',new Date(r.created_at).toLocaleString('en-PH'),r.status]){
        const td=tr.insertCell();td.textContent=value;
        if(value===r.status){const badge=document.createElement('span');badge.className='status-pill '+r.status.toLowerCase();badge.textContent=r.status;td.replaceChildren(badge);}
      }
    }
    if(!body.children.length){const tr=body.insertRow(),td=tr.insertCell();td.colSpan=6;td.textContent='No requests yet. Open Machine Inventory to view a QR and submit one.';}
    $('message').textContent=`${(data||[]).length} request(s) loaded. Pending requests do not change machine status.`;
  }catch(e){$('message').textContent=e.message;}
})();
