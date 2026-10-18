
import { db, currentStaff } from './client.js';

const table = document.getElementById('machineTable');
const search = document.getElementById('searchInput');
const message = document.getElementById('message');
const qrPanel = document.getElementById('qrPanel');

let machines = [];
let currentRole = null;

// 1. VERIFY STAFF
async function checkAccess() {
  const staff = await currentStaff();

  if (!staff) {
    window.location.replace('./index.html');
    return false;
  }

  currentRole = staff.role;
  const addPanel = document.querySelector('.quick-add');
  if (addPanel) addPanel.hidden = staff.role !== 'ADMIN';
  return true;
}

// 2. FETCH INVENTORY
async function loadMachines() {
  message.textContent = 'Loading inventory...';

  const { data, error } = await db
    .from('machines')
    .select(`
      id,
      asset_code,
      machine_name,
      serial_number,
      location,
      status,
      qr_token
    `)
    .order('created_at', { ascending: false })
    .limit(1000);

  if (error) {
    throw error;
  }

  machines = data || [];
  message.textContent =
    `${machines.length} machine(s) loaded.`;

  renderTable();

  // Handle a QR scan that opened this page
  const token = new URLSearchParams(
    window.location.search
  ).get('qr');

  if (token) {
    const found = machines.find(
      m => m.qr_token === token
    );

    if (found) {
      showQR(found);
    } else {
      message.textContent =
        'Machine not found in loaded records.';
    }
  }
}

// 3. DISPLAY TABLE
function renderTable() {
  table.replaceChildren();

  const keyword = search.value.trim().toLowerCase();

  const filtered = machines.filter(m =>
    [
      m.asset_code,
      m.machine_name,
      m.serial_number,
      m.location
    ].some(value =>
      String(value || '').toLowerCase().includes(keyword)
    )
  );

  if (!filtered.length) {
    const row = table.insertRow();
    const cell = row.insertCell();
    cell.colSpan = 6;
    cell.textContent = 'No matching machines.';
    return;
  }

  filtered.forEach(machine => {
    const row = table.insertRow();

    [
      machine.asset_code,
      machine.machine_name,
      machine.serial_number,
      machine.location || '—',
      machine.status
    ].forEach(value => {
      row.insertCell().textContent = value;
    });

    const button = document.createElement('button');
    button.textContent = 'View QR';

    button.addEventListener('click', () => {
      showQR(machine);
    });

    row.insertCell().appendChild(button);
  });
}

// 4. GENERATE MACHINE QR
function showQR(machine) {
  qrPanel.classList.remove('hidden');

  document.getElementById('qrMachineName')
    .textContent = machine.machine_name;

  document.getElementById('qrAssetCode')
    .textContent = `Asset: ${machine.asset_code}`;

  document.getElementById('qrSerial')
    .textContent = `Serial: ${machine.serial_number}`;

  const qrContainer = document.getElementById('qrcode');
  qrContainer.replaceChildren();

  // Opens this same inventory page with the QR token
  
const url = new URL(
  './machine.html',
  window.location.href
);

url.search = '';
url.searchParams.set('qr', machine.qr_token);


  const qrUrl = url.toString();

  document.getElementById('qrUrl')
    .textContent = qrUrl;

  if (typeof QRCode === 'undefined') {
    message.textContent =
      'QR library failed to load. Check internet connection.';
    return;
  }

  new QRCode(qrContainer, {
    text: qrUrl,
    width: 200,
    height: 200,
    colorDark: '#000000',
    colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.M
  });

  qrPanel.scrollIntoView({ behavior: 'smooth' });
}

// 5. SEARCH
search.addEventListener('input', renderTable);

// 6. PRINT QR
document.getElementById('printBtn')
  .addEventListener('click', () => {
    window.print();
  });

// 7. CLOSE QR
document.getElementById('closeQrBtn')
  .addEventListener('click', () => {
    qrPanel.classList.add('hidden');
  });

// 8. REFRESH
document.getElementById('refreshBtn')
  .addEventListener('click', async () => {
    try {
      await loadMachines();
    } catch (error) {
      console.error(error);
      message.textContent = error.message;
      message.className = 'error';
    }
  });

// 9. INITIALIZE
try {
  if (await checkAccess()) {
    await loadMachines();
  }
} catch (error) {
  console.error('Inventory error:', error);
  message.textContent = error.message;
  message.className = 'error';
}
