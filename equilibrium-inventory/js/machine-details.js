
import { db, currentStaff } from './client.js';

const byId = (id) => document.getElementById(id);

const message = byId('message');
const content = byId('machineContent');

// Display messages
function showMessage(text, isError = false) {
  if (!message) return;

  message.textContent = text;
  message.className = isError ? 'error' : '';
}

// Update machine status appearance
function updateStatus(element, status) {
  if (!element) return;

  element.textContent = status || 'UNKNOWN';
  element.className = 'status';

  if (status === 'AVAILABLE') {
    element.classList.add('available');
  } else if (status === 'BORROWED') {
    element.classList.add('borrowed');
  } else if (status === 'MAINTENANCE') {
    element.classList.add('maintenance');
  }
}

// Redirect to borrowing or returning page
function navigateToAction(page, qrToken) {
  const url = new URL(page, window.location.href);

  url.search = '';
  url.searchParams.set('qr', qrToken);

  window.location.assign(url.toString());
}

// Load the scanned machine
async function loadMachineDetails() {
  try {

    // 1. VERIFY USER LOGIN
    const staff = await currentStaff();

    if (!staff) {
      sessionStorage.setItem(
        'inventoryReturnUrl',
        window.location.href
      );

      window.location.replace('./index.html');
      return;
    }

    // 2. GET QR TOKEN
    const params = new URLSearchParams(
      window.location.search
    );

    const token = params.get('qr')?.trim();

    if (!token) {
      throw new Error(
        'Missing QR code. Please scan a valid machine QR code.'
      );
    }

    // 3. FETCH MACHINE DETAILS
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

    if (error) {
      throw error;
    }

    if (!machine) {
      throw new Error(
        'Machine not found or you do not have permission to view it.'
      );
    }

    // 4. DISPLAY MACHINE INFORMATION
    const fields = {
      machineName: machine.machine_name,
      assetCode: machine.asset_code,
      serialNumber: machine.serial_number,
      brand: machine.brand,
      category: machine.category,
      location: machine.location,
      condition: machine.condition
    };

    for (const [elementId, value] of Object.entries(fields)) {
      const element = byId(elementId);

      if (element) {
        element.textContent = value || 'Not specified';
      }
    }

    // 5. MACHINE STATUS
    updateStatus(byId('status'), machine.status);

    // 6. ACTION BUTTONS
    const borrowBtn = byId('borrowBtn');
    const returnBtn = byId('returnBtn');
    const notice = byId('actionNotice');

    if (!borrowBtn || !returnBtn || !notice) {
      throw new Error(
        'Machine action elements are missing from machine.html.'
      );
    }

    // Clear previous handlers
    borrowBtn.onclick = null;
    returnBtn.onclick = null;

    // Hide both buttons by default
    borrowBtn.hidden = true;
    returnBtn.hidden = true;

    borrowBtn.disabled = true;
    returnBtn.disabled = true;

    // Administrators review requests; Technical and Warehouse staff submit them.
    const mayRequest = ['TECHNICAL', 'WAREHOUSE'].includes(staff.role);
    if (staff.role === 'ADMIN') {
      notice.textContent = 'Administrator view: borrowing and returning require staff requests. Review them in Approvals.';
    }

    // 7. AVAILABLE MACHINE
    if (mayRequest && machine.status === 'AVAILABLE') {

      borrowBtn.hidden = false;

      const isGoodCondition =
        String(machine.condition || '')
          .trim()
          .toUpperCase() === 'GOOD';

      if (isGoodCondition) {

        borrowBtn.disabled = false;

        borrowBtn.onclick = () => {
          navigateToAction('./borrow.html', token);
        };

        notice.textContent =
          'Available: send a borrow request for Administrator approval.';

      } else {

        notice.textContent =
          'Borrowing is restricted because the machine is not marked in GOOD condition.';

      }

    }

    // 8. BORROWED MACHINE
    else if (mayRequest && machine.status === 'BORROWED') {

      returnBtn.hidden = false;
      returnBtn.disabled = false;

      returnBtn.onclick = () => {
        navigateToAction('./return.html', token);
      };

      notice.textContent =
        'Borrowed: send a return request for Administrator approval.';

    }

    // 9. MAINTENANCE MACHINE
    else if (machine.status === 'MAINTENANCE') {

      notice.textContent =
        'This machine is under maintenance and cannot be borrowed.';

    }

    // 10. UNKNOWN STATUS
    else if (mayRequest) {

      notice.textContent =
        'This machine is currently unavailable for a request.';

    }

    // 11. SHOW DETAILS
    if (content) {
      content.hidden = false;
    }

    showMessage('');

    console.log(
      'Machine details loaded:',
      machine.asset_code
    );

  } catch (error) {

    console.error(
      'Machine details error:',
      error
    );

    showMessage(
      error.message || 'Unable to load machine details.',
      true
    );

    if (content) {
      content.hidden = true;
    }

  }
}

// INITIALIZE PAGE
await loadMachineDetails();
