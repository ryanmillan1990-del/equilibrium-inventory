import { db, currentStaff } from './client.js';
const $ = id => document.getElementById(id);
const staff = await currentStaff();
if (!staff) location.replace('./index.html');
else {
  async function refresh() {
    const { data, error } = await db.from('inventory_accessories').select('sku,name,quantity,unit,location').order('created_at',{ascending:false}).limit(150);
    if (error) throw error;
    $('records').replaceChildren();
    for (const a of data || []) {
      const tr = $('records').insertRow();
      for (const value of [a.sku,a.name,`${a.quantity} ${a.unit}`,a.location || '—']) tr.insertCell().textContent=value;
    }
    if (!data?.length) $('records').insertRow().insertCell().textContent='No accessories yet.';
  }
  $('accessoryForm').addEventListener('submit', async event => {
    event.preventDefault(); $('saveBtn').disabled=true; $('message').textContent='Saving...';
    try {
      const { error }=await db.rpc('register_accessory',{
        p_sku:$('sku').value.trim(),p_name:$('name').value.trim(),
        p_quantity:Number($('quantity').value),p_unit:$('unit').value,
        p_location:$('location').value.trim(),p_notes:$('notes').value.trim()
      });
      if(error) throw error;
      $('message').textContent='Accessory saved successfully.'; $('accessoryForm').reset(); await refresh();
    } catch(e){$('message').textContent=e.message || 'Could not save accessory.';}
    finally{$('saveBtn').disabled=false;}
  });
  try { await refresh(); } catch(e) { $('message').textContent='Unable to load accessories: '+e.message+' (Run sql/010_inventory_extensions.sql in Supabase first.)'; }
}
