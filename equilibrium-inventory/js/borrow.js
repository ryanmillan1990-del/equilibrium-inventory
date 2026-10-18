
import { db, currentStaff } from './client.js';

const byId = id => document.getElementById(id);

const message = byId('message');
const content = byId('borrowContent');
const form = byId('borrowForm');
const button = byId('borrowButton');

const params = new URLSearchParams(window.location.search);
const token = params.get('qr');

let selectedMachine = null;
let submitting = false;

function showMessage(text, type = '') {
  message.textContent = text;
  message.className = type;
}

// LOAD MACHINE
async function initialize() {
  try {
    content.hidden = true;

    const staff = await currentStaff();

    if (!staff) {
      // Preserve the URL so staff can return after login.
      sessionStorage.setItem(
        'inventoryReturnUrl',
        window.location.href
      );
      window.location.replace('./index.html');
      return;
    }

    if (!token) {
      throw new Error('Missing machine QR token.');
    }

    const detailsUrl = new URL(
      './machine.html',
      window.location.href
    );
    detailsUrl.searchParams.set('qr', token);
    byId('backLink').href = detailsUrl.toString();

    const { data, error } = await db
      .from('machines')
      .select(`
        id,
        asset_code,
        machine_name,
        serial_number,
        status,
        condition
      `)
      .eq('qr_token', token)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      throw new Error('Machine not found.');
    }

    selectedMachine = data;

    byId('machineName').textContent =
      data.machine_name;

    byId('assetCode').textContent =
      'Asset ID: ' + data.asset_code;

    byId('serialNumber').textContent =
      'Serial Number: ' + data.serial_number;

    byId('machineStatus').textContent =
      'Status: ' + data.status;

    if (
      data.status !== 'AVAILABLE' ||
      data.condition !== 'GOOD'
    ) {
      throw new Error(
        'This machine is not available for borrowing.'
      );
    }

    content.hidden = false;
    showMessage('');

  } catch (error) {
    console.error('Borrow page error:', error);
    showMessage(error.message, 'error');
    content.hidden = true;
  }
}

// CONFIRM BORROWING
form.addEventListener('submit', async event => {
  event.preventDefault();

  if (submitting || !selectedMachine) return;

  const borrowerName =
    byId('borrowerName').value.trim();

  const organization =
    byId('organization').value.trim();

  const contactNumber =
    byId('contactNumber').value.trim();

  const purpose =
    byId('purpose').value.trim();

  const dueValue = byId('dueAt').value;

  if (!borrowerName || !dueValue) {
    showMessage(
      'Borrower name and expected return are required.',
      'error'
    );
    return;
  }

  const dueDate = new Date(dueValue);

  if (
    Number.isNaN(dueDate.getTime()) ||
    dueDate.getTime() <= Date.now()
  ) {
    showMessage(
      'Expected return date must be in the future.',
      'error'
    );
    return;
  }

  const confirmed = window.confirm(
    `Confirm borrowing ${selectedMachine.machine_name} ` +
    `to ${borrowerName}?`
  );

  if (!confirmed) return;

  submitting = true;
  button.disabled = true;
  button.textContent = 'Processing...';
  showMessage('Saving borrowing transaction...');

  try {
    const staff = await currentStaff();

    if (!staff) {
      throw new Error(
        'Your staff session has expired. Please log in.'
      );
    }

    const { data: loanId, error } = await db.rpc(
      'borrow_machine',
      {
        p_machine_id: selectedMachine.id,
        p_borrower_name: borrowerName,
        p_organization: organization || null,
        p_contact_number: contactNumber || null,
        p_purpose: purpose || null,
        p_due_at: dueDate.toISOString()
      }
    );

    if (error) throw error;

    showMessage(
      'Machine borrowed successfully. Loan ID: ' +
      loanId,
      'success'
    );

    form.reset();

    // Avoid accidental resubmission
    button.textContent = 'Borrowing Completed';
    button.disabled = true;

    console.log('Loan created:', loanId);

    // Return to machine details after successful transaction
    const url = new URL(
      './machine.html',
      window.location.href
    );
    url.searchParams.set('qr', token);

    window.location.replace(url.toString());

  } catch (error) {
    console.error('Borrowing failed:', error);

    showMessage(
      'Borrowing failed: ' + error.message,
      'error'
    );

    submitting = false;
    button.disabled = false;
    button.textContent = 'Confirm Borrowing';
  }
});

await initialize();



