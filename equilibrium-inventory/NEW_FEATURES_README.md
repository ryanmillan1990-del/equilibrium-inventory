# New Quick Add Features

The floating + button on Dashboard and Machine Inventory now offers:
- Machine → existing register.html
- Accessories → new accessories.html (SKU, name, count, unit, location)
- For Delivery to Client → new delivery.html (client, item, quantity, date)

## Required activation (once)
1. In Supabase SQL Editor, run `sql/010_inventory_extensions.sql` using your project owner account.
2. Publish updated repository to GitHub, and wait for Vercel deployment.
3. Sign in as active Admin or Warehouse staff and open Dashboard / Machine Inventory.
4. Click + and test each option.

## Scope
Client delivery requests are **records only**. They do not yet reduce accessory stock or update machine availability, and they do not create an issuance Word document. Delivery status starts at FOR_DELIVERY. Do not treat this as an operational stock-dispatch process until dispatch/confirmation is implemented.
This update does not implement Admin account registration discussed previously.
