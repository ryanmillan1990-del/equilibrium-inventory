import { db, currentStaff } from './client.js';
const $ = id => document.getElementById(id);
const token = new URLSearchParams(location.search).get('qr');
let machine = null, busy = false;
const message = $('message');
const button = $('borrowButton');
function show(text, error = false) { message.textContent = text; message.className = error ? 'error' : 'success'; }

async function init() {
  try {
    const staff = await currentStaff();
    if (!staff) {
      sessionStorage.setItem('inventoryReturnUrl', location.href);
      location.replace('./index.html'); return;
    }
    if (!['TECHNICAL','WAREHOUSE'].includes(staff.role)) {
      location.replace('./approvals.html'); return;
    }
    if (!token) throw new Error('Missing QR token. Open the machine from its QR label.');
    const back = new URL('./machine.html', location.href);
    back.searchParams.set('qr', token);
    $('backLink').href = back.href;
    const { data, error } = await db.from('machines')
      .select('id,asset_code,machine_name,serial_number,status,condition')
      .eq('qr_token', token).maybeSingle();
    if (error) throw error;
    if (!data || data.status !== 'AVAILABLE' || data.condition !== 'GOOD')
      throw new Error('Machine is not available for a borrowing request.');
    machine = data;
    $('machineName').textContent = data.machine_name;
    $('assetCode').textContent = `Asset ID: ${data.asset_code}`;
    $('serialNumber').textContent = `Serial Number: ${data.serial_number}`;
    $('machineStatus').textContent = `Status: ${data.status}`;
    $('borrowContent').hidden = false;
    button.textContent = 'Send Borrow Request to Admin';
    show('Your request will be pending until the Administrator approves it.');
  } catch (e) { $('borrowContent').hidden = true; show(e.message, true); }
}

$('borrowForm').addEventListener('submit', async event => {
  event.preventDefault();
  if (busy || !machine) return;
  const name = $('borrowerName').value.trim();
  const due = new Date($('dueAt').value);
  if (!name || Number.isNaN(due.valueOf()) || due <= new Date()) {
    show('Enter a borrower name and a future expected return date.', true); return;
  }
  if (!confirm(`Send a borrowing request for ${machine.machine_name} to the Admin?`)) return;
  busy = true; button.disabled = true; show('Submitting request...');
  try {
    const staff = await currentStaff();
    if (!staff || !['TECHNICAL','WAREHOUSE'].includes(staff.role)) throw new Error('Staff permission required.');
    const { data, error } = await db.rpc('submit_machine_action_request', {
      p_machine_id: machine.id,
      p_action: 'BORROW',
      p_borrower_name: name,
      p_organization: $('organization').value.trim() || null,
      p_contact_number: $('contactNumber').value.trim() || null,
      p_purpose: $('purpose').value.trim() || null,
      p_due_at: due.toISOString(),
      p_condition_in: null,
      p_remarks: null
    });
    if (error) throw error;
    show(`Borrow request submitted (reference: ${data}). Machine status has not changed.`);
    button.textContent = 'Awaiting Admin Approval';
    setTimeout(() => location.assign('./my-requests.html'), 1200);
  } catch (e) {
    show(`Could not submit request: ${e.message}`, true);
    busy = false; button.disabled = false;
    button.textContent = 'Send Borrow Request to Admin';
  }
});
await init();
