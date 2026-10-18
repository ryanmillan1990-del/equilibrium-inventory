
import { db, currentStaff } from './client.js';

const byId = id => document.getElementById(id);

// LOGOUT
byId('logout').addEventListener('click', async () => {
  await db.auth.signOut();
  window.location.replace('index.html');
});

// LOAD DASHBOARD
(async () => {
  try {

    // CHECK STAFF ACCESS
    const staff = await currentStaff();

    if (!staff) {
      await db.auth.signOut();
      window.location.replace('index.html');
      return;
    }

    byId('welcome').textContent =
      `${staff.full_name} • ${staff.role}`;

    console.log('Loading machine inventory...');

    // FETCH MACHINES
    const { data: machines, error } = await db
      .from('machines')
      .select(
        'asset_code,machine_name,serial_number,status'
      )
      .order('created_at', { ascending: false });

    // DATABASE DIAGNOSTICS
    console.log('MACHINE DATA:', machines);
    console.log('DATABASE ERROR:', error);
    console.log('TOTAL MACHINES:', machines?.length);

    if (error) {
      throw error;
    }

    const machineList = machines || [];

    // UPDATE DASHBOARD COUNTERS
    byId('total').textContent = machineList.length;

    const statuses = [
      ['available', 'AVAILABLE'],
      ['borrowed', 'BORROWED'],
      ['maintenance', 'MAINTENANCE']
    ];

    for (const [elementId, status] of statuses) {
      byId(elementId).textContent =
        machineList.filter(
          machine => machine.status === status
        ).length;
    }

    // DISPLAY REGISTERED MACHINES
    const records = byId('records');

    records.replaceChildren();

    if (machineList.length === 0) {
      records.textContent =
        'No machine records are visible to this account.';

      return;
    }

    const table = document.createElement('table');

    const heading = document.createElement('tr');

    for (const name of [
      'Asset ID',
      'Machine',
      'Serial Number',
      'Status'
    ]) {
      const th = document.createElement('th');
      th.textContent = name;
      heading.appendChild(th);
    }

    table.appendChild(heading);

    for (const machine of machineList) {

      const row = document.createElement('tr');

      const values = [
        machine.asset_code,
        machine.machine_name,
        machine.serial_number,
        machine.status
      ];

      for (const value of values) {
        const td = document.createElement('td');
        td.textContent = value ?? '—';
        row.appendChild(td);
      }

      table.appendChild(row);
    }

    records.appendChild(table);

    console.log('Dashboard loaded successfully.');

  } catch (error) {

    console.error('Dashboard error:', error);

    byId('message').textContent =
      'Error loading dashboard: ' + error.message;

  }
})();
