import {db,currentStaff} from './client.js';
const list=document.getElementById('requests');
const message=document.getElementById('message');
async function api(method='GET',body){
  const {data:{session}}=await db.auth.getSession();
  if(!session) throw new Error('Please sign in again');
  const response=await fetch('/api/staff-management',{
    method,headers:{'Authorization':`Bearer ${session.access_token}`,...(body?{'Content-Type':'application/json'}:{})},
    ...(body?{body:JSON.stringify(body)}:{})
  });
  const result=await response.json();
  if(!response.ok)throw new Error(result.error||'Staff request failed');
  return result;
}
async function load(){
  const staff=await currentStaff();
  if(!staff || staff.role!=='ADMIN') {location.replace('dashboard.html');return;}
  const result=await api();
  list.replaceChildren();
  const table=document.createElement('table');
  const tr=document.createElement('tr');
  for(const h of ['Full Name','Role','Status','Registered','Actions']) {
    const th=document.createElement('th');th.textContent=h;tr.append(th);
  }
  table.append(tr);
  for(const person of result.staff){
    const row=document.createElement('tr');
    for(const value of [person.full_name,person.role,person.approval_status,new Date(person.created_at).toLocaleDateString('en-PH')]){
      const td=document.createElement('td');td.textContent=value;row.append(td);
    }
    const td=document.createElement('td');
    if(person.approval_status==='PENDING'){
      const box=document.createElement('div');box.className='review-actions';
      for(const [label,decision] of [['Approve','APPROVED'],['Reject','REJECTED']]){
        const btn=document.createElement('button');btn.type='button';btn.textContent=label;
        if(decision==='REJECTED')btn.className='reject';
        btn.addEventListener('click',async()=>{
          if(!confirm(`${label} account for ${person.full_name}?`))return;
          btn.disabled=true;message.textContent='Processing...';
          try{const r=await api('POST',{id:person.id,decision});message.textContent=r.message;await load();}
          catch(e){message.textContent=e.message;btn.disabled=false;}
        });box.append(btn);
      }td.append(box);
    }else td.textContent='—';
    row.append(td);table.append(row);
  }
  list.append(table);
}
load().catch(e=>{message.textContent=e.message;list.textContent='Unable to load staff';});
