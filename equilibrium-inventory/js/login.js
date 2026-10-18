
import { db, currentStaff } from './client.js';

const $ = (id) => document.getElementById(id);

const message = $('message');

function showMessage(text, isError = false) {
  message.textContent = text;
  message.className = isError ? 'error' : '';
}

// ========================================
// LOGIN / REGISTER TAB SWITCHING
// ========================================

function setMode(register) {
  $('login-section').hidden = register;
  $('register-section').hidden = !register;

  $('login-tab').setAttribute(
    'aria-selected',
    String(!register)
  );

  $('register-tab').setAttribute(
    'aria-selected',
    String(register)
  );

  showMessage('');
}

$('login-tab').addEventListener('click', () => {
  setMode(false);
});

$('register-tab').addEventListener('click', () => {
  setMode(true);
});

// ========================================
// CHECK EXISTING LOGIN SESSION
// ========================================

(async () => {
  try {
    const staff = await currentStaff();

    if (staff) {
      const returnUrl = sessionStorage.getItem(
        'inventoryReturnUrl'
      );

      if (returnUrl) {
        sessionStorage.removeItem('inventoryReturnUrl');

        const target = new URL(returnUrl);

        // Only redirect within this website.
        if (target.origin === window.location.origin) {
          window.location.replace(target.href);
          return;
        }
      }

      window.location.replace('dashboard.html');
    }
  } catch (error) {
    showMessage(
      error.message || 'Unable to verify login session.',
      true
    );
  }
})();

// ========================================
// STAFF LOGIN
// ========================================

$('login').addEventListener('submit', async (event) => {
  event.preventDefault();

  const submit = $('submit');
  submit.disabled = true;

  showMessage('Checking credentials...');

  try {
    const email = $('email').value.trim();
    const password = $('password').value;

    const { error } = await db.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    const staff = await currentStaff();

    if (!staff) {
      await db.auth.signOut();

      throw new Error(
        'Your account is pending approval or is not authorized.'
      );
    }

    const returnUrl = sessionStorage.getItem(
      'inventoryReturnUrl'
    );

    if (returnUrl) {
      sessionStorage.removeItem('inventoryReturnUrl');

      const target = new URL(returnUrl);

      if (target.origin === window.location.origin) {
        window.location.replace(target.href);
        return;
      }
    }

    window.location.replace('dashboard.html');

  } catch (error) {
    showMessage(
      error.message || 'Unable to sign in.',
      true
    );
  } finally {
    submit.disabled = false;
  }
});

// ========================================
// GENERATE STAFF LOGIN EMAIL
// ========================================

function nameToEmail(name) {
  const username = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return username
    ? `${username}@equinventory.com`
    : '';
}

$('full-name').addEventListener('input', () => {
  $('generated-email').value = nameToEmail(
    $('full-name').value.trim()
  );
});

// ========================================
// REGISTRATION API RESPONSE HANDLING
// ========================================

async function readApiResponse(response) {
  const responseText = await response.text();

  if (!responseText.trim()) {
    throw new Error(
      `Registration server returned an empty response (HTTP ${response.status}). Check Vercel Function Logs.`
    );
  }

  let result;

  try {
    result = JSON.parse(responseText);
  } catch {
    throw new Error(
      `Registration server returned invalid JSON (HTTP ${response.status}). Check the API deployment.`
    );
  }

  if (!response.ok) {
    throw new Error(
      result.error ||
      result.message ||
      `Registration failed (HTTP ${response.status}).`
    );
  }

  return result;
}

// ========================================
// STAFF REGISTRATION
// ========================================

$('registration').addEventListener(
  'submit',
  async (event) => {

    event.preventDefault();
    showMessage('');

    const fullName = $('full-name').value.trim();
    const role = $('requested-role').value;
    const password = $('new-password').value;
    const confirmPassword = $('confirm-password').value;

    if (fullName.length < 2) {
      showMessage(
        'Please enter your complete name.',
        true
      );
      return;
    }

    if (!['ADMIN', 'TECHNICAL'].includes(role)) {
      showMessage(
        'Please select a valid account type.',
        true
      );
      return;
    }

    if (password.length < 12) {
      showMessage(
        'Password must contain at least 12 characters.',
        true
      );
      return;
    }

    if (password !== confirmPassword) {
      showMessage(
        'Passwords do not match.',
        true
      );
      return;
    }

    const submit = $('register-submit');
    submit.disabled = true;

    showMessage('Submitting registration request...');

    try {
      const response = await fetch('/api/register-staff', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          full_name: fullName,
          role,
          password
        })
      });

      const result = await readApiResponse(response);

      // Successful registration
      $('registration').reset();
      $('generated-email').value = '';

      const generatedEmail =
        result.email || nameToEmail(fullName);

      showMessage(
        `${result.message || 'Registration request submitted successfully. Awaiting administrator approval.'} Login ID: ${generatedEmail}`
      );

    } catch (error) {
      console.error('Registration error:', error);

      showMessage(
        error.message || 'Unable to register staff account.',
        true
      );

    } finally {
      submit.disabled = false;
    }
  }
);
