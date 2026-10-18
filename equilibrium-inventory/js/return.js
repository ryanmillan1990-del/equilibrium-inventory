
import { db, currentStaff } from './client.js';

const byId = id => document.getElementById(id);

const message = byId('message');
const content = byId('returnContent');
const form = byId('returnForm');
const button = byId('returnButton');

const params = new URLSearchParams(
  window.location.search
);

const token = params.get('qr');

let selectedMachine = null;
let activeLoan = null;
let submitting = false;

function showMessage(text, type = '') {
  message.textContent = text;
  message.className = type;
}

function formatDate(value) {
  return new Date(value).toLocaleString('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

// LOAD MACHINE AND ACTIVE LOAN
async function initialize() {
  try {
    content.hidden = true;

    const staff = await currentStaff();

    if (!staff) {
      sessionStorage.setItem(
        'inventoryReturnUrl',
        window.location.href
      );

      window.location.replace('./index.html');
      return;
    }

    if (!token) {
      throw new Error('Missing QR token.');
    }

    const detailsUrl = new URL(
      './machine.html',
      window.location.href
    );

    detailsUrl.searchParams.set('qr', token);
    byId('backLink').href = detailsUrl.toString();

    // FIND MACHINE
    const { data: machine, error: machineError } =
      await db
        .from('machines')
        .select(`
          id,
          asset_code,
          machine_name,
          serial_number,
          status
        `)
        .eq('qr_token', token)
        .maybeSingle();

    if (machineError) throw machineError;

    if (!machine) {
      throw new Error('Machine not found.');
    }

    if (machine.status !== 'BORROWED') {
      throw new Error(
        'This machine is not currently borrowed.'
      );
    }

    selectedMachine = machine;

    // FIND THE ACTIVE BORROWING TRANSACTION
    const { data: loan, error: loanError } =
      await db
        .from('machine_loans')
        .select(`
          id,
          borrowed_at,
          due_at,
          status,
          borrowers (
            borrower_name,
            organization
          )
        `)
        .eq('machine_id', machine.id)
        .eq('status', 'ACTIVE')
        .maybeSingle();

    if (loanError) throw loanError;

    if (!loan) {
      throw new Error(
        'No active borrowing record was found.'
      );
    }

    activeLoan = loan;

    // DISPLAY MACHINE
    byId('machineName').textContent =
      machine.machine_name;

    byId('assetCode').textContent =
      'Asset ID: ' + machine.asset_code;

    byId('serialNumber').textContent =
      'Serial Number: ' + machine.serial_number;

    byId('machineStatus').textContent =
      'Status: ' + machine.status;

    // DISPLAY BORROWER
    byId('borrowerName').textContent =
      loan.borrowers?.borrower_name || 'Unknown';

    byId('organization').textContent =
      loan.borrowers?.organization || 'Not specified';

    byId('borrowedAt').textContent =
      formatDate(loan.borrowed_at);

    byId('dueAt').textContent =
      formatDate(loan.due_at);

    content.hidden = false;
    showMessage('');

  } catch (error) {
    console.error('Return page error:', error);
    showMessage(error.message, 'error');
    content.hidden = true;
  }
}

// PROCESS MACHINE RETURN
form.addEventListener('submit', async event => {
  event.preventDefault();

  if (
    submitting ||
    !selectedMachine ||
    !activeLoan
  ) return;

  const condition =
    byId('conditionIn').value;

  const remarks =
    byId('remarks').value.trim();

  if (![
    'GOOD',
    'NEEDS_INSPECTION',
    'DAMAGED'
  ].includes(condition)) {
    showMessage(
      'Please select a valid machine condition.',
      'error'
    );
    return;
  }

  const confirmed = window.confirm(
    'Confirm return of ' +
    selectedMachine.machine_name +
    '?\n\nCondition: ' + condition
  );

  if (!confirmed) return;

  submitting = true;
  button.disabled = true;
  button.textContent = 'Processing return...';

  try {
    const staff = await currentStaff();

    if (!staff) {
      throw new Error(
        'Staff session expired. Please log in again.'
      );
    }

    const { data: loanId, error } = await db.rpc(
      'return_machine',
      {
        p_machine_id: selectedMachine.id,
        p_condition_in: condition,
        p_remarks: remarks || null
      }
    );

    if (error) throw error;

    if (loanId !== activeLoan.id) {
      console.warn(
        'Returned loan differs from displayed loan.'
      );
    }

    showMessage(
      'Machine returned successfully!',
      'success'
    );

    button.textContent = 'Return Completed';

    const detailsUrl = new URL(
      './machine.html',
      window.location.href
    );

    detailsUrl.searchParams.set('qr', token);

    window.location.replace(detailsUrl.toString());

  } catch (error) {
    console.error('Return failed:', error);

    showMessage(
      'Return failed: ' + error.message,
      'error'
    );

    submitting = false;
    button.disabled = false;
    button.textContent = 'Confirm Machine Return';
  }
});

await initialize();
