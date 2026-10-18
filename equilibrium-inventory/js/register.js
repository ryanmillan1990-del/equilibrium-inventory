
import { db, currentStaff } from './client.js';

const form = document.getElementById('machineForm');
const message = document.getElementById('message');
const button = document.getElementById('saveButton');

// VERIFY LOGIN
async function verifyAccess() {
  try {
    const staff = await currentStaff();

    if (!staff) {
      window.location.replace('./index.html');
      return;
    }

    console.log('Authorized staff:', staff.full_name);

  } catch (error) {
    console.error('Access verification failed:', error);
    message.textContent =
      'Unable to verify staff access. Refresh and try again.';
    button.disabled = true;
  }
}

await verifyAccess();

// REGISTER MACHINE
form.addEventListener('submit', async (event) => {

  event.preventDefault();

  button.disabled = true;
  button.textContent = 'Registering...';

  message.textContent = '';

  const machineName =
    document.getElementById('machineName').value.trim();

  const serialNumber =
    document.getElementById('serialNumber').value.trim();

  const brand =
    document.getElementById('brand').value.trim();

  const category =
    document.getElementById('category').value.trim();

  const location =
    document.getElementById('location').value.trim();

  try {

    // VERIFY AUTHORIZED STAFF
    const staff = await currentStaff();

    if (!staff) {
      throw new Error('Unauthorized staff account.');
    }

    // CALL SUPABASE DATABASE FUNCTION
    const { data, error } = await db.rpc(
      'register_machine',
      {
        p_machine_name: machineName,
        p_serial_number: serialNumber,
        p_brand: brand || null,
        p_category: category || null,
        p_location: location
      }
    );

    if (error) throw error;

    message.style.color = '#24543b';
    message.textContent =
      'Machine registered successfully! Machine ID: ' + data;

    console.log('New Machine ID:', data);

    form.reset();

  } catch (error) {

    console.error('Registration error:', error);

    message.style.color = '#b42318';

    if (error.code === '23505') {
      message.textContent =
        'This machine serial number or asset ID already exists.';
    } else {
      message.textContent =
        error.message || 'Machine registration failed.';
    }

  } finally {

    button.disabled = false;
    button.textContent = 'Register Machine';

  }

});
