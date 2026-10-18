
import { db, currentStaff } from './client.js';

const list = document.getElementById('requests');
const message = document.getElementById('message');

// ==========================================
// DISPLAY SYSTEM MESSAGES
// ==========================================

function showMessage(text, isError = false) {
  message.textContent = text;
  message.className = isError ? 'error' : '';
}

// ==========================================
// SECURE STAFF MANAGEMENT API
// ==========================================

async function api(method = 'GET', body = null) {

  const {
    data: { session },
    error: sessionError
  } = await db.auth.getSession();

  if (sessionError || !session) {
    throw new Error('Please sign in again.');
  }

  const response = await fetch('/api/staff-management', {
    method,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: 'no-store'
  });

  // Read as text first, so HTML/empty responses
  // produce useful errors instead of JSON syntax errors.
  const responseText = await response.text();

  if (!responseText.trim()) {
    throw new Error(
      `Staff management API returned an empty response (HTTP ${response.status}).`
    );
  }

  let result;

  try {
    result = JSON.parse(responseText);
  } catch {
    throw new Error(
      `Staff management API returned HTML or invalid JSON (HTTP ${response.status}). Check /api/staff-management deployment.`
    );
  }

  if (!response.ok) {
    throw new Error(
      result.error ||
      `Staff request failed (HTTP ${response.status}).`
    );
  }

  return result;
}

// ==========================================
// LOAD STAFF ACCOUNTS
// ==========================================

async function load() {

  const staff = await currentStaff();

  if (!staff || staff.role !== 'ADMIN') {
    window.location.replace('dashboard.html');
    return;
  }

  list.textContent = 'Loading staff accounts...';

  const result = await api('GET');

  if (!Array.isArray(result.staff)) {
    throw new Error('Invalid staff list returned by API.');
  }

  list.replaceChildren();

  const table = document.createElement('table');

  const header = document.createElement('tr');

  for (const title of [
    'Full Name',
    'Role',
    'Status',
    'Registered',
    'Actions'
  ]) {
    const th = document.createElement('th');
    th.textContent = title;
    header.appendChild(th);
  }

  table.appendChild(header);

  for (const person of result.staff) {

    const row = document.createElement('tr');

    const values = [
      person.full_name || '—',
      person.role || '—',
      person.approval_status || '—',
      person.created_at
        ? new Date(person.created_at).toLocaleDateString('en-PH')
        : '—'
    ];

    for (const value of values) {
      const td = document.createElement('td');
      td.textContent = value;
      row.appendChild(td);
    }

    const actionCell = document.createElement('td');

    if (person.approval_status === 'PENDING') {

      const actions = document.createElement('div');
      actions.className = 'review-actions';

      for (const [label, decision] of [
        ['Approve', 'APPROVED'],
        ['Reject', 'REJECTED']
      ]) {

        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = label;

        if (decision === 'REJECTED') {
          button.className = 'reject';
        }

        button.addEventListener('click', async () => {

          const confirmed = window.confirm(
            `${label} account for ${person.full_name}?`
          );

          if (!confirmed) return;

          // Disable both buttons during request.
          const buttons = actions.querySelectorAll('button');

          buttons.forEach(btn => {
            btn.disabled = true;
          });

          showMessage('Processing account request...');

          try {

            const result = await api('POST', {
              id: person.id,
              decision
            });

            await load();

            showMessage(
              result.message ||
              `Staff account ${decision.toLowerCase()}.`
            );

          } catch (error) {

            showMessage(
              error.message || 'Unable to update staff.',
              true
            );

            buttons.forEach(btn => {
              btn.disabled = false;
            });

          }

        });

        actions.appendChild(button);
      }

      actionCell.appendChild(actions);

    } else {

      actionCell.textContent = '—';

    }

    row.appendChild(actionCell);
    table.appendChild(row);
  }

  list.appendChild(table);
}

// ==========================================
// INITIALIZE
// ==========================================

load().catch(error => {

  console.error('Staff management error:', error);

  showMessage(
    error.message || 'Unable to load staff accounts.',
    true
  );

  list.textContent = 'Unable to load staff accounts.';
});
