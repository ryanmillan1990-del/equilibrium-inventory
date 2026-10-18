# Product Issuance in View Details

This update preserves your current pages. On **Loaner Transaction History > View Details**, an ACTIVE loan with an existing issuance record shows **Download & Print Product Issuance**. This retrieves your original Word form populated with the saved issuance number. Returned loans do not show the button.

## Install and run
1. Extract this ZIP and use the included project as your VS Code folder. Keep a backup of your current folder.
2. Verify `js/config.js` still uses your own Supabase project URL and **publishable** key.
3. In Supabase SQL Editor, check existing issuance records:

```sql
SELECT l.id, l.status, p.issuance_number
FROM public.machine_loans l
LEFT JOIN public.product_issuances p ON p.loan_id=l.id
ORDER BY l.borrowed_at DESC;
```

4. Deploy the project to **Vercel** (the API cannot run under `python -m http.server`). Run `npm install` before local Vercel development. `package.json` and `vercel.json` are included.
5. In Vercel Project Settings > Environment Variables set:
   - `SUPABASE_URL` (the project URL)
   - `SUPABASE_SERVICE_ROLE_KEY` (server secret, never expose in frontend files or GitHub)
   Redeploy after setting variables.
6. Sign in to the deployed site, open history, select **View Details** for an ACTIVE loan with a saved issuance number, and click **Download & Print Product Issuance**. Open the downloaded DOCX in Word and choose Print.

## Important
- Existing old loans without issuance numbers do not show the button. Do not assign numbers retroactively without reconciling company numbering.
- The document retains the company's existing layout and the fixed typed text **Ferdinand Coderias** under Approved by, but signatures remain blank. The typed name is not proof of approval.
- Printing never increments the issuance number; only a newly successful borrow assigns one.
- The current template is Word (.docx). The original design is retained, and printing happens from Word. This version does not silently produce a separately redesigned PDF form.
- Do not upload the original file with historic handwritten signatures as the template. Use the cleaned `templates/PRODUCT-ISSUANCE-FORM-406-TEMPLATE.docx` provided.
