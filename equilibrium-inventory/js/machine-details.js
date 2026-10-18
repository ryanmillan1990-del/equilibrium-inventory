
import { db, currentStaff } from './client.js';

const byId = id => document.getElementById(id);

const message = byId('message');
const content = byId('machineContent');

async function loadMachineDetails() {
  try {
    // 1. Verify logged-in staff
    const staff = await currentStaff();

    if (!staff) {
      // Preserve scanned QR URL after login
      sessionStorage.setItem(
        'inventoryReturnUrl',
        window.location.href
      );

      window.location.replace('./index.html');
      return;
    }

    // 2. Read machine QR token from URL
    const params = new URLSearchParams(
      window.location.search
    );

    const token = params.get('qr');

    if (!token) {
      throw new Error(
        'Missing QR code. Please scan a valid machine QR.'
      );
    }

    // 3. Get the exact machine from Supabase
    const { data: machine, error } = await db
      .from('machines')
      .select(`
        id,
        asset_code,
        machine_name,
        serial_number,
        brand,
        category,
        location,
        condition,
        status
      `)
      .eq('qr_token', token)
      .maybeSingle();

    if (error) throw error;

    if (!machine) {
      throw new Error(
        'Machine not found or not accessible.'
      );
    }

    // 4. Display machine details
    byId('machineName').textContent =
      machine.machine_name;

    byId('assetCode').textContent =
      machine.asset_code;

    byId('serialNumber').textContent =
      machine.serial_number;

    byId('brand').textContent =
      machine.brand || 'Not specified';

    byId('category').textContent =
      machine.category || 'Not specified';

    byId('location').textContent =
      machine.location || 'Not specified';

    byId('condition').textContent =
      machine.condition || 'Not specified';

    const status = byId('status');
    status.textContent = machine.status;

    status.className = 'status';

    if (machine.status === 'AVAILABLE') {
      status.classList.add('available');
    }

    if (machine.status === 'BORROWED') {
      status.classList.add('borrowed');
    }

    // 5. Display appropriate future action
    const borrowBtn = byId('borrowBtn');
    const returnBtn = byId('returnBtn');
    const notice = byId('actionNotice');

    borrowBtn.hidden = true;
    returnBtn.hidden = true;

    if (machine.status === 'AVAILABLE') {
      borrowBtn.hidden = false;
      notice.textContent =
        'Borrowing will be enabled in Phase 4.';
    } else if (machine.status === 'BORROWED') {
      returnBtn.hidden = false;
      notice.textContent =
        'Returning will be enabled in Phase 4.';
    } else {
      notice.textContent =
        'This machine is currently unavailable.';
    }

    // Keep buttons disabled until secure
    // borrow/return functions are implemented
    

borrowBtn.disabled =
  machine.status !== 'AVAILABLE' ||
  machine.condition !== 'GOOD';

returnBtn.disabled =
  machine.status !== 'BORROWED';

// ENABLE BORROW BUTTON
if (!borrowBtn.disabled) {
  borrowBtn.onclick = () => {
    const url = new URL(
      './borrow.html',
      window.location.href
    );

    url.searchParams.set('qr', token);
    window.location.href = url.toString();
  };

  notice.textContent =
    'This machine is available for borrowing.';
}

// ENABLE RETURN BUTTON
if (!returnBtn.disabled) {
  returnBtn.onclick = () => {
    const url = new URL(
      './return.html',
      window.location.href
    );

    url.searchParams.set('qr', token);
    window.location.href = url.toString();
  };

  notice.textContent =
    'This machine is currently borrowed.';
}


if (!borrowBtn.disabled) {
  borrowBtn.onclick = () => {
    const url = new URL(
      './borrow.html',
      window.location.href
    );

    url.search = '';
    url.searchParams.set('qr', token);

    window.location.href = url.toString();
  };

  notice.textContent =
    'This machine is available for borrowing.';
}


    content.hidden = false;
    message.textContent = '';

    console.log(
      'Machine details loaded:',
      machine.asset_code
    );

  } catch (error) {
    console.error('Machine details error:', error);
    message.className = 'error';
    message.textContent = error.message;
    content.hidden = true;
  }
}

await loadMachineDetails();
