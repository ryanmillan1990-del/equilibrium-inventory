# Deploy Equilibrium Inventory using GitHub and Vercel

## 1. Open the project in VS Code

Extract the ZIP, then open **equilibrium-inventory-phase1** as the project folder. Do not upload your old handwritten-signature version of the Word form. The cleaned company template is stored under `api/_templates/` and is used only by the protected issuance endpoint.

## 2. Review the security setup

- `js/config.js` contains a **public Supabase URL and publishable key**. These are expected to be visible in a browser. Your Supabase RLS policies and secure RPC functions must enforce permissions.
- `SUPABASE_SERVICE_ROLE_KEY` is a **secret**. Never paste it into `js/`, HTML, a public JSON file, a GitHub issue, or chat screenshots.
- `.gitignore` prevents accidental commits of matching **untracked** files, but cannot hide webpage code or delete secrets already in Git history.
- The original Word form containing a historical signature was intentionally omitted from this distribution.

## 3. Git initialization and publish to GitHub

Create a **private** empty GitHub repository named `equilibrium-inventory` (don't check Add README since one already exists). In VS Code terminal inside the folder:

```powershell
git init
git branch -M main
git status
git add .
git status --short
git commit -m "Prepare secure inventory deployment and issuance printing"
git remote add origin https://github.com/YOUR_USERNAME/equilibrium-inventory.git
git push -u origin main
```

Replace YOUR_USERNAME. If this folder is already a Git repository, do NOT run `git init` or add the remote again. Use `git add .`, `git commit -m "..."`, `git push` instead. Check `git status` before committing to ensure there are no `.env` or secret files.

## 4. Deploy on Vercel

1. Open https://vercel.com/new, import your GitHub repository and authorize access.
2. Pick project **Framework Preset: Other**.
3. Use **Root Directory `./`**, Build Command **leave blank**, Output Directory **leave blank**, and Install Command default. This is a static website plus a Node.js serverless function at `/api/product-issuance`.
4. In Vercel Project Settings > Environment Variables add:
   - `SUPABASE_URL` = the URL for the same Supabase project as `js/config.js`
   - `SUPABASE_SERVICE_ROLE_KEY` = Supabase secret service-role key (server-side ONLY).
5. Deploy or redeploy after saving variables. Do not set the secret with a `VITE_`, `NEXT_PUBLIC_`, or other browser-exposed prefix.
6. Open the production URL and verify Login > Dashboard > Inventory > History.
7. For an **ACTIVE** loan with an existing `product_issuances` row, use History > View Details > **Download & Print Product Issuance**. The browser downloads the company DOCX; open in Word to print.

## 5. Important checks

- The previous `localhost:5500` QR labels will NOT work on the public site. Reprint QR labels after deployment, using the Vercel HTTPS URL.
- Confirm the Supabase project is the same between the public JS config and private environment variables.
- Ensure `product_issuances` has an issuance number for the loan. Older loans may have no number. Do not regenerate / duplicate numbers when printing.
- A GitHub **private repo hides the Git repository**, but visitors can still inspect browser-delivered HTML/CSS/JS. Keep authorization, database checks and private document creation on the server.
- Before production, test an unauthorized login, a Warehouse user, a returned loan, and a loan without an issuance number.
- If any secret was ever committed publicly, rotate the key in Supabase, update Vercel, and clean Git history; adding `.gitignore` alone does not fix it.
