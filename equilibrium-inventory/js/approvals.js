import {db,currentStaff} from './client.js';
const $=id=>document.getElementById(id);
const message=$('message');
let processing=false;
function notice(text,isError=false){message.textContent=text;message.className=isError?'error':'success';}
function cell(row,value){const td=row.insertCell();td.textContent=value??'—';return td;}
function dt(value){return value?new Date(value).toLocaleString('en-PH',{dateStyle:'medium',timeStyle:'short'}):'—';}
async function refresh(){
  const {data,error}=await db.from('machine_action_requests')
    .select('id,machine_id,requested_by,action,status,borrower_name,organization,purpose,due_at,condition_in,remarks,created_at,reviewed_at,loan_id')
    .order('created_at',{ascending:false}).limit(250);
  if(error)throw error;
  const {data:machines,error:machineError}=await db.from('machines').select('id,asset_code,machine_name');
  if(machineError)throw machineError;
  const {data:staff,error:staffError}=await db.from('staff_profiles').select('id,full_name');
  if(staffError)throw staffError;
  const machineMap=new Map((machines||[]).map(x=>[x.id,x]));
  const nameMap=new Map((staff||[]).map(x=>[x.id,x.full_name]));
  const records=data||[];
  $('pendingCount').textContent=records.filter(x=>x.status==='PENDING').length;
  $('reviewedCount').textContent=records.filter(x=>x.status!=='PENDING').length;
  const keyword=$('searchInput').value.trim().toLowerCase();
  const filter=$('statusFilter').value;
  const body=$('requestRows');body.replaceChildren();
  for(const r of records.filter(x=>{
    const m=machineMap.get(x.machine_id);
    return (filter==='ALL'||r.status===filter) && [m?.machine_name,m?.asset_code,nameMap.get(r.requested_by),r.action,r.borrower_name].some(v=>String(v||'').toLowerCase().includes(keyword));
  })){
    const machine=machineMap.get(r.machine_id)||{};
    const row=body.insertRow();
    cell(row,`${machine.machine_name||'Machine'} · ${machine.asset_code||r.machine_id}`);
    cell(row,r.action);
    cell(row,nameMap.get(r.requested_by)||'Staff member');
    const info=r.action==='BORROW'
      ? `Borrower: ${r.borrower_name||'—'}\nCompany: ${r.organization||'—'}\nPurpose: ${r.purpose||'—'}\nDue: ${dt(r.due_at)}`
      : `Condition: ${r.condition_in||'—'}\nRemarks: ${r.remarks||'—'}`;
    const details=cell(row,info);details.classList.add('details-cell');
    cell(row,dt(r.created_at));
    const statusCell=row.insertCell();
    const badge=document.createElement('span');badge.className='status-pill '+r.status.toLowerCase();badge.textContent=r.status;statusCell.append(badge);
    const actionCell=row.insertCell();
    if(r.status==='PENDING'){
      const group=document.createElement('div');group.className='review-actions';
      for(const [label,decision,extra] of [['Approve','APPROVED',''],['Reject','REJECTED','reject']]){
        const button=document.createElement('button');button.type='button';button.textContent=label;button.className=extra;
        button.addEventListener('click',async()=>{
          if(processing) return;
          if(!confirm(`${label} ${r.action.toLowerCase()} request for ${machine.machine_name||'machine'}?\n\n${info}`))return;
          processing=true;group.querySelectorAll('button').forEach(b=>b.disabled=true);notice('Processing approval...');
          try {
            const {error}=await db.rpc('review_machine_action_request',{p_request_id:r.id,p_decision:decision});
            if(error)throw error;
            await refresh();notice(`Request ${decision.toLowerCase()}. Inventory changed only if approved.`);
          }catch(e){notice(`Unable to review: ${e.message}`,true);group.querySelectorAll('button').forEach(b=>b.disabled=false);}
          finally{processing=false;}
        });group.append(button);
      }actionCell.append(group);
    }else actionCell.textContent=r.loan_id?`Loan: ${r.loan_id.slice(0,8)}…`:'—';
  }
  if(!body.children.length){const row=body.insertRow();const empty=row.insertCell();empty.colSpan=7;empty.textContent='No matching requests.';}
}
(async()=>{
  try { const s=await currentStaff();
    if(!s){location.replace('./index.html');return;}
    if(s.role!=='ADMIN'){location.replace('./dashboard.html');return;}
    $('staffName').textContent=`${s.full_name} · Administrator`;
    await refresh();
    $('refreshBtn').addEventListener('click',()=>refresh().catch(e=>notice(e.message,true)));
    $('searchInput').addEventListener('input',()=>refresh().catch(e=>notice(e.message,true)));
    $('statusFilter').addEventListener('change',()=>refresh().catch(e=>notice(e.message,true)));
  }catch(e){notice(e.message,true);}
})();
