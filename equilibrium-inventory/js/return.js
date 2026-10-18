import { db, currentStaff } from './client.js';
const $ = id => document.getElementById(id);
const token = new URLSearchParams(location.search).get('qr');
let machine = null, loan = null, busy = false;
const button = $('returnButton');
function show(text, error=false) { $('message').textContent=text; $('message').className=error?'error':'success'; }
function date(value) { return new Date(value).toLocaleString('en-PH', {dateStyle:'medium',timeStyle:'short'}); }
async function init() {
  try {
    const staff = await currentStaff();
    if (!staff) { sessionStorage.setItem('inventoryReturnUrl',location.href); location.replace('./index.html'); return; }
    if (!['TECHNICAL','WAREHOUSE'].includes(staff.role)) { location.replace('./approvals.html'); return; }
    if (!token) throw new Error('Missing QR token.');
    const back=new URL('./machine.html',location.href); back.searchParams.set('qr',token); $('backLink').href=back.href;
    const {data,error}=await db.from('machines').select('id,asset_code,machine_name,serial_number,status').eq('qr_token',token).maybeSingle();
    if(error) throw error;
    if(!data || data.status!=='BORROWED') throw new Error('Machine is not currently borrowed.');
    machine=data;
    const loanResult = await db.rpc('get_machine_active_loan', { p_machine_id: data.id });
    if (loanResult.error) throw loanResult.error;
    loan = loanResult.data?.[0];
    if(!loan) throw new Error('No active loan found.');
    $('machineName').textContent=data.machine_name;
    $('assetCode').textContent='Asset ID: '+data.asset_code;
    $('serialNumber').textContent='Serial Number: '+data.serial_number;
    $('machineStatus').textContent='Status: '+data.status;
    $('borrowerName').textContent=loan.borrower_name || '—';
    $('organization').textContent=loan.organization || '—';
    $('borrowedAt').textContent=date(loan.borrowed_at);
    $('dueAt').textContent=date(loan.due_at);
    $('returnContent').hidden=false;
    button.textContent='Send Return Request to Admin';
    show('The machine stays BORROWED until an Administrator approves the return.');
  } catch(e) { $('returnContent').hidden=true; show(e.message,true); }
}
$('returnForm').addEventListener('submit',async event=>{
  event.preventDefault(); if (busy || !machine || !loan) return;
  const condition=$('conditionIn').value;
  if(!['GOOD','NEEDS_INSPECTION','DAMAGED'].includes(condition)) { show('Select a valid return condition.',true); return; }
  if(!confirm(`Send return request for ${machine.machine_name}?\nCondition: ${condition}`))return;
  busy=true;button.disabled=true;show('Submitting return request...');
  try {
    const staff=await currentStaff();
    if(!staff || !['TECHNICAL','WAREHOUSE'].includes(staff.role)) throw new Error('Staff permission required.');
    const {data,error}=await db.rpc('submit_machine_action_request',{
      p_machine_id:machine.id, p_action:'RETURN',
      p_borrower_name:null,p_organization:null,p_contact_number:null,p_purpose:null,p_due_at:null,
      p_condition_in:condition,p_remarks:$('remarks').value.trim()||null
    });
    if(error)throw error;
    show(`Return request sent (${data}). Awaiting Admin decision. Machine status has not changed.`);
    button.textContent='Awaiting Admin Approval';
    setTimeout(()=>location.assign('./my-requests.html'),1200);
  } catch(e){show(`Return request failed: ${e.message}`,true);busy=false;button.disabled=false;button.textContent='Send Return Request to Admin';}
});
await init();
