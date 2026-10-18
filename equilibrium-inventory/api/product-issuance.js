import { createClient } from '@supabase/supabase-js';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import fs from 'node:fs';
import path from 'node:path';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) throw new Error('Server is not configured');
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token) return res.status(401).json({ error: 'Sign in required' });
    const loanId = String(req.query.loan_id || '');
    if (!uuidPattern.test(loanId)) return res.status(400).json({ error: 'Invalid loan ID' });

    const db = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const { data: { user }, error: userError } = await db.auth.getUser(token);
    if (userError || !user) return res.status(401).json({ error: 'Invalid login session' });
    const { data: staff, error: staffError } = await db.from('staff_profiles')
      .select('id,role,is_active').eq('id',user.id).maybeSingle();
    if (staffError) throw staffError;
    if (!staff?.is_active || !['ADMIN','WAREHOUSE'].includes(staff.role)) {
      return res.status(403).json({ error: 'Only authorized staff may download forms' });
    }
    const { data: loan, error: loanError } = await db.from('machine_loans')
      .select('id, machine_id, borrower_id, purpose, borrowed_at, status, released_by')
      .eq('id', loanId).maybeSingle();
    if (loanError) throw loanError;
    if (!loan) return res.status(404).json({ error: 'Loan not found' });
    if (loan.status !== 'ACTIVE') return res.status(409).json({ error: 'Issuance printing is enabled for active loans only' });

    const [issuanceResult, machineResult, borrowerResult, releasingResult] = await Promise.all([
      db.from('product_issuances').select('issuance_number,created_at,approved_by_name').eq('loan_id', loanId).maybeSingle(),
      db.from('machines').select('machine_name,serial_number').eq('id',loan.machine_id).single(),
      db.from('borrowers').select('borrower_name,organization').eq('id',loan.borrower_id).single(),
      db.from('staff_profiles').select('full_name').eq('id',loan.released_by).single(),
    ]);
    for (const r of [issuanceResult, machineResult, borrowerResult, releasingResult]) {
      if (r.error) throw r.error;
    }
    const issuance = issuanceResult.data;
    if (!issuance) return res.status(409).json({ error: 'No issuance number assigned to this loan. Do not generate one on print.' });
    const machine = machineResult.data;
    const borrower = borrowerResult.data;
    const releaser = releasingResult.data;

    const templatePath = path.join(process.cwd(), 'api', '_templates', 'PRODUCT-ISSUANCE-FORM-406-TEMPLATE.docx');
    const source = fs.readFileSync(templatePath);
    const zip = new PizZip(source);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: false,
      linebreaks: false,
      delimiters: { start: '{{', end: '}}' },
    });
    const formatDate = new Intl.DateTimeFormat('en-US', {
      month:'short',day:'numeric',year:'numeric',timeZone:'Asia/Manila'
    });
    doc.render({
      NO: issuance.issuance_number,
      ISSUE_DATE: formatDate.format(new Date(issuance.created_at)),
      RECIPIENT: borrower.organization || borrower.borrower_name,
      MACHINE_NAME: machine.machine_name,
      SERIAL_NUMBER: machine.serial_number,
      PURPOSE: loan.purpose || 'FOR LOANER',
      RELEASED_BY: releaser.full_name,
    });
    const output = doc.getZip().generate({ type:'nodebuffer', compression:'DEFLATE' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Cache-Control', 'no-store, private');
    res.setHeader('Content-Disposition', `attachment; filename="Product_Issuance_${issuance.issuance_number}.docx"`);
    return res.status(200).send(output);
  } catch (e) {
    console.error('Issuance form generation error',e);
    return res.status(500).json({ error: 'Could not generate the issuance document' });
  }
}
