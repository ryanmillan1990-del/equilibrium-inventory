import { db, currentStaff } from './client.js';
const $ = id => document.getElementById(id);
const staff = await currentStaff();
if (!staff) location.replace('./index.html');
else if (staff.role !== 'ADMIN') location.replace('./dashboard.html');
else {
  // Use today's Manila date, not the viewer's timezone.
  $('deliveryDate').value=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  async function refresh() {
    const { data,error }=await db.from('client_deliveries').select('delivery_date,client_name,item_name,quantity,status').order('created_at',{ascending:false}).limit(100);
    if(error) throw error;
    $('records').replaceChildren();
    for(const d of data || []) {
      const tr=$('records').insertRow();
      for(const value of [d.delivery_date,d.client_name,d.item_name,d.quantity,d.status]) tr.insertCell().textContent=value;
    }
    if(!data?.length) $('records').insertRow().insertCell().textContent='No delivery requests yet.';
  }
  $('deliveryForm').addEventListener('submit',async event=>{
    event.preventDefault(); $('saveBtn').disabled=true; $('message').textContent='Saving...';
    try {
      const {error}=await db.rpc('admin_create_client_delivery',{
        p_client_name:$('clientName').value.trim(), p_client_contact:$('clientContact').value.trim(),
        p_delivery_address:$('deliveryAddress').value.trim(),p_item_type:$('itemType').value,
        p_item_name:$('itemName').value.trim(),p_item_code:$('itemCode').value.trim(),
        p_quantity:Number($('quantity').value),p_delivery_date:$('deliveryDate').value,
        p_remarks:$('remarks').value.trim()
      });
      if(error)throw error;
      $('message').textContent='Delivery request saved. Status: FOR_DELIVERY.'; $('deliveryForm').reset();await refresh();
    } catch(e){$('message').textContent=e.message||'Could not save delivery request.';}
    finally{$('saveBtn').disabled=false;}
  });
  try{await refresh();}catch(e){$('message').textContent='Unable to load deliveries: '+e.message+' (Run sql/010_inventory_extensions.sql first.)';}
}
