
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

    const isAdmin = staff.role === 'ADMIN';
    const adminNav = byId('admin-navigation');
    if (adminNav) adminNav.hidden = !isAdmin;
    // Admin-only quick add and history links remain invisible for Technical accounts.
    const quickAdd = document.querySelector('.quick-add');
    if (quickAdd) quickAdd.hidden = !isAdmin;
    document.querySelectorAll('a[href="./history.html"]').forEach(link => {
      link.hidden = !isAdmin;
    });
    const navigation = document.querySelector('.navigation');
    if (navigation) {
      const link = document.createElement('a');
      link.className = 'nav-btn brown';
      link.href = isAdmin ? './approvals.html' : './my-requests.html';
      link.textContent = isAdmin ? 'Request Approvals' : 'My Requests';
      navigation.appendChild(link);
    }
    if (adminNav && isAdmin) {
      for (const [href,label] of [
        ['./register.html','Register Machine'],
        ['./accessories.html','Accessories'],
        ['./delivery.html','Client Deliveries']
      ]) {
        const a=document.createElement('a');a.href=href;a.className='nav-btn';a.textContent=label;
        adminNav.append(a);
      }
    }
    const actions = document.querySelector('.action-grid');
    if (actions) {
      const a=document.createElement('a');
      a.href=isAdmin?'./approvals.html':'./my-requests.html';
      a.className='action-card';
      const heading=document.createElement('h3');heading.textContent=isAdmin?'Approve Machine Requests':'Track My Requests';
      const desc=document.createElement('p');desc.textContent=isAdmin
        ?'Review and approve or reject borrow and return requests.'
        :'View your borrow/return request status after submission.';
      a.append(heading,desc);actions.append(a);
    }
    const welcomeText = isAdmin
      ? 'Administrator • Full Inventory Control'
      : 'Technical Workspace • QR Viewing and Requests';
    const mode = document.createElement('span');
    mode.className='role-badge';mode.textContent=welcomeText;
    byId('welcome').insertAdjacentElement('afterend', mode);
    const headline = document.querySelector('.dashboard-header h1');
    if (headline) headline.textContent = isAdmin ? 'Inventory Control Center' : 'Technical Inventory Portal';

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
