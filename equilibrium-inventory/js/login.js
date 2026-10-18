import { db, currentStaff } from './client.js';
const form = document.getElementById('login');
const message = document.getElementById('message');
const submit = document.getElementById('submit');
(async()=>{ try { if(await currentStaff()) window.location.replace('dashboard.html'); } catch(e) { message.textContent=e.message; } })();
form.addEventListener('submit', async event => {
  event.preventDefault(); submit.disabled=true; message.textContent='Checking credentials...';
  try {
    const {error} = await db.auth.signInWithPassword({
      email:document.getElementById('email').value.trim(),
      password:document.getElementById('password').value
    });
    if(error) throw error;
    const staff = await currentStaff();
    if(!staff) { await db.auth.signOut(); throw new Error('This account is not an active authorized staff member.'); }
    window.location.replace('dashboard.html');
  } catch(error) { message.textContent=error.message || 'Unable to sign in.'; submit.disabled=false; }
});
