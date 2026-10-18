
import { db, currentStaff } from './client.js';

const byId = id => document.getElementById(id);

let loans = [];
let issuanceLoanIds = new Set();

function formatDate(value) {
  if (!value) return '—';

  return new Date(value).toLocaleString('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

function displayStatus(loan) {
  if (
    loan.loan_status === 'ACTIVE' &&
    new Date(loan.due_at).getTime() < Date.now()
  ) {
    return 'OVERDUE';
  }

  return loan.loan_status;
}

function showMessage(text, isError = false) {
  const element = byId('message');
  element.textContent = text;
  element.className = isError ? 'error' : '';
}

// GET HISTORY FROM SUPABASE
async function loadHistory() {
  showMessage('Loading transaction history...');

  const { data, error } = await db.rpc(
    'get_admin_loan_history'
  );

  if (error) throw error;

  loans = data || [];

  // Read only existing issuance numbers; printing never allocates a number.
  const { data: issuances, error: issuanceError } = await db
    .from('product_issuances')
    .select('loan_id');
  if (issuanceError) throw issuanceError;
  issuanceLoanIds = new Set((issuances || []).map(i => i.loan_id));

  console.log('Loan history records:', loans.length);

  byId('totalLoans').textContent = loans.length;

  byId('activeLoans').textContent =
    loans.filter(l => l.loan_status === 'ACTIVE').length;

  byId('returnedLoans').textContent =
    loans.filter(l => l.loan_status === 'RETURNED').length;

  showMessage(`${loans.length} transaction(s) loaded.`);

  renderTable();
}

// DISPLAY TRANSACTIONS
function renderTable() {
  const tbody = byId('historyTable');
  tbody.replaceChildren();

  const keyword = byId('searchInput')
    .value.trim().toLowerCase();

  const status = byId('statusFilter').value;

  const filtered = loans.filter(loan => {
    const values = [
      loan.machine_name,
      loan.asset_code,
      loan.serial_number,
      loan.borrower_name,
      loan.organization
    ];

    const matchesSearch = values.some(value =>
      String(value || '')
        .toLowerCase()
        .includes(keyword)
    );

    const actualStatus = displayStatus(loan);

    const matchesStatus =
      status === 'ALL' || actualStatus === status;

    return matchesSearch && matchesStatus;
  });

  if (!filtered.length) {
    const row = tbody.insertRow();
    const cell = row.insertCell();

    cell.colSpan = 7;
    cell.textContent = 'No matching transactions.';
    return;
  }

  filtered.forEach(loan => {
    const row = tbody.insertRow();

    const values = [
      `${loan.machine_name} (${loan.asset_code})`,
      loan.borrower_name,
      formatDate(loan.borrowed_at),
      formatDate(loan.due_at),
      formatDate(loan.returned_at)
    ];

    values.forEach(value => {
      row.insertCell().textContent = value || '—';
    });

    const statusCell = row.insertCell();
    const statusBadge = document.createElement('span');

    const status = displayStatus(loan);
    statusBadge.textContent = status;
    statusBadge.className = `badge ${status}`;

    statusCell.appendChild(statusBadge);

    const actionCell = row.insertCell();

    const button = document.createElement('button');
    button.textContent = 'View Details';
    button.type = 'button';

    button.addEventListener('click', () => {
      showDetails(loan);
    });

    actionCell.appendChild(button);
  });
}

// SHOW A COMPLETE LOAN RECORD
function showDetails(loan) {
  const panel = byId('detailPanel');
  const container = byId('detailContent');

  container.replaceChildren();

  const fields = [
    ['Machine Name', loan.machine_name],
    ['Asset ID', loan.asset_code],
    ['Serial Number', loan.serial_number],
    ['Borrower Name', loan.borrower_name],
    ['Company / Department', loan.organization],
    ['Purpose', loan.purpose],
    ['Date Borrowed', formatDate(loan.borrowed_at)],
    ['Expected Return', formatDate(loan.due_at)],
    ['Actual Return', formatDate(loan.returned_at)],
    ['Loan Status', displayStatus(loan)],
    ['Condition Out', loan.condition_out],
    ['Condition In', loan.condition_in],
    ['Released By', loan.released_by_name],
    ['Received By', loan.received_by_name],
    ['Remarks', loan.remarks],
    ['Loan ID', loan.loan_id]
  ];

  fields.forEach(([label, value]) => {
    const item = document.createElement('div');
    item.className = 'detail-item';

    const caption = document.createElement('small');
    caption.textContent = label;

    const content = document.createElement('strong');
    content.textContent = value ?? '—';

    item.append(caption, content);
    container.appendChild(item);
  });

  const issueButton = byId('issuanceBtn');
  const mayPrint = loan.loan_status === 'ACTIVE'
    && issuanceLoanIds.has(loan.loan_id);
  issueButton.hidden = !mayPrint;
  issueButton.dataset.loanId = mayPrint ? loan.loan_id : '';

  panel.hidden = false;
  panel.scrollIntoView({ behavior: 'smooth' });
}

// Download the existing company Word form for the selected ACTIVE loan.
byId('issuanceBtn').addEventListener('click', async () => {
  const button = byId('issuanceBtn');
  const loanId = button.dataset.loanId;
  const selected = loans.find(l => l.loan_id === loanId);
  if (!selected || selected.loan_status !== 'ACTIVE' || !issuanceLoanIds.has(loanId)) return;
  button.disabled = true;
  try {
    const { data: { session }, error: authError } = await db.auth.getSession();
    if (authError || !session?.access_token) {
      throw new Error('Please log in again to download the issuance form.');
    }
    const response = await fetch(`/api/product-issuance?loan_id=${encodeURIComponent(loanId)}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: 'no-store'
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || `Download failed (${response.status})`);
    }
    const file = await response.blob();
    const disposition = response.headers.get('content-disposition') || '';
    const filename = disposition.match(/filename="([^"]+)"/)?.[1]
      || 'Product_Issuance.docx';
    const objectUrl = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
    showMessage('Original Product Issuance Word form downloaded. Open it to print.');
  } catch (error) {
    console.error('Issuance download error:', error);
    showMessage(error.message, true);
  } finally {
    button.disabled = false;
  }
});

// EVENT LISTENERS
byId('searchInput').addEventListener(
  'input',
  renderTable
);

byId('statusFilter').addEventListener(
  'change',
  renderTable
);

byId('closeBtn').addEventListener(
  'click',
  () => {
    byId('detailPanel').hidden = true;
  }
);

byId('printBtn').addEventListener(
  'click',
  () => window.print()
);

byId('refreshBtn').addEventListener(
  'click',
  async () => {
    try {
      await loadHistory();
    } catch (error) {
      console.error(error);
      showMessage(error.message, true);
    }
  }
);

// VERIFY LOGIN AND INITIALIZE
try {
  const staff = await currentStaff();

  if (!staff) {
    window.location.replace('./index.html');
  } else if (staff.role !== 'ADMIN') {
    window.location.replace('./dashboard.html');
  } else {
    byId('welcome').textContent =
      `${staff.full_name} • ${staff.role}`;

    await loadHistory();
  }
} catch (error) {
  console.error('History error:', error);
  showMessage(
    'Unable to load transaction history: ' +
      error.message,
    true
  );
}
