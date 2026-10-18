import {db,currentStaff} from './client.js';
const $=id=>document.getElementById(id);
const message=$('message');
const setMode=(register)=>{
  $('login-section').hidden=register;
  $('register-section').hidden=!register;
  $('login-tab').setAttribute('aria-selected',String(!register));
  $('register-tab').setAttribute('aria-selected',String(register));
  message.textContent='';
};
$('login-tab').addEventListener('click',()=>setMode(false));
$('register-tab').addEventListener('click',()=>setMode(true));
(async()=>{try{if(await currentStaff()) location.replace('dashboard.html');}catch(e){message.textContent=e.message;}})();
$('login').addEventListener('submit',async event=>{
  event.preventDefault(); $('submit').disabled=true;message.textContent='Checking credentials...';
  try{
    const {error}=await db.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});
    if(error) throw error;
    const staff=await currentStaff();
    if(!staff) {await db.auth.signOut();throw new Error('Account pending approval or not authorized.');}
    location.replace('dashboard.html');
  }catch(e){message.textContent=e.message || 'Unable to sign in';}finally{$('submit').disabled=false;}
});
const nameToEmail=name=>{
  const s=name.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
    .replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');
  return s ? `${s}@equinventory.com`:'';
};
$('full-name').addEventListener('input',()=>{$('generated-email').value=nameToEmail($('full-name').value.trim());});
$('registration').addEventListener('submit',async event=>{
  event.preventDefault();message.textContent='';
  if($('new-password').value!==$('confirm-password').value){message.textContent='Passwords do not match';return;}
  $('register-submit').disabled=true;
  try{
    const response=await fetch('/api/register-staff',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({full_name:$('full-name').value.trim(),role:$('requested-role').value,password:$('new-password').value})
    });
    const result=await response.json();
    if(!response.ok) throw new Error(result.error || 'Registration failed');
    $('registration').reset();
    message.textContent=`${result.message} Login ID: ${result.email}`;
  }catch(e){message.textContent=e.message;}finally{$('register-submit').disabled=false;}
});
