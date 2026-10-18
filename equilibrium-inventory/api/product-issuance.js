
import { createClient } from '@supabase/supabase-js';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

// EQUILIBRIUM INTERTRADE
// PRODUCT ISSUANCE FORM GENERATOR

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Resolve template relative to this API file.
// This avoids depending on Vercel's working directory.
const templatePath = fileURLToPath(
  new URL(
    './_templates/PRODUCT-ISSUANCE-FORM-406-TEMPLATE.docx',
    import.meta.url
  )
);

export default async function handler(req, res) {

  // 1. ONLY ALLOW GET
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');

    return res.status(405).json({
      error: 'Method not allowed'
    });
  }

  try {

    // 2. CHECK SERVER ENVIRONMENT
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      console.error(
        'Missing required Supabase server configuration'
      );

      return res.status(500).json({
        error: 'Server is not configured'
      });
    }

    // 3. VERIFY LOGIN TOKEN
    const authHeader =
      req.headers.authorization || '';

    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : '';

    if (!token) {
      return res.status(401).json({
        error: 'Sign in required'
      });
    }

    // 4. VALIDATE LOAN ID
    const loanId = String(req.query.loan_id || '');

    if (!uuidPattern.test(loanId)) {
      return res.status(400).json({
        error: 'Invalid loan ID'
      });
    }

    // 5. CONNECT TO SUPABASE SERVER-SIDE
    const db = createClient(
      supabaseUrl,
      serviceKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      }
    );

    // 6. VERIFY AUTHENTICATED USER
    const {
      data: { user },
      error: userError
    } = await db.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({
        error: 'Invalid login session'
      });
    }

    // 7. VERIFY ADMIN / WAREHOUSE STAFF
    const {
      data: staff,
      error: staffError
    } = await db
      .from('staff_profiles')
      .select('id,role,is_active')
      .eq('id', user.id)
      .maybeSingle();

    if (staffError) throw staffError;

    if (
      !staff?.is_active ||
      !['ADMIN', 'WAREHOUSE', 'TECHNICAL'].includes(staff.role)
    ) {
      return res.status(403).json({
        error: 'Only authorized staff may download forms'
      });
    }

    // 8. GET LOAN TRANSACTION
    const {
      data: loan,
      error: loanError
    } = await db
      .from('machine_loans')
      .select(`
        id,
        machine_id,
        borrower_id,
        purpose,
        borrowed_at,
        status,
        released_by
      `)
      .eq('id', loanId)
      .maybeSingle();

    if (loanError) throw loanError;

    if (!loan) {
      return res.status(404).json({
        error: 'Loan not found'
      });
    }

    // Only active loans can print issuance forms.
    if (loan.status !== 'ACTIVE') {
      return res.status(409).json({
        error:
          'Issuance printing is enabled for active loans only'
      });
    }

    // 9. RETRIEVE ISSUANCE AND MACHINE DETAILS
    const [
      issuanceResult,
      machineResult,
      borrowerResult,
      releasingResult
    ] = await Promise.all([

      db
        .from('product_issuances')
        .select(`
          issuance_number,
          created_at,
          approved_by_name
        `)
        .eq('loan_id', loanId)
        .maybeSingle(),

      db
        .from('machines')
        .select('machine_name,serial_number')
        .eq('id', loan.machine_id)
        .single(),

      db
        .from('borrowers')
        .select('borrower_name,organization')
        .eq('id', loan.borrower_id)
        .single(),

      db
        .from('staff_profiles')
        .select('full_name')
        .eq('id', loan.released_by)
        .single()

    ]);

    // 10. CHECK DATABASE ERRORS
    for (const result of [
      issuanceResult,
      machineResult,
      borrowerResult,
      releasingResult
    ]) {
      if (result.error) {
        throw result.error;
      }
    }

    const issuance = issuanceResult.data;

    if (!issuance) {
      return res.status(409).json({
        error:
          'No issuance number assigned to this loan'
      });
    }

    const machine = machineResult.data;
    const borrower = borrowerResult.data;
    const releaser = releasingResult.data;

    // 11. CHECK WORD TEMPLATE FILE
    if (!fs.existsSync(templatePath)) {
      console.error(
        'Product Issuance template missing:',
        templatePath
      );

      return res.status(500).json({
        error: 'Product Issuance template is missing'
      });
    }

    // 12. LOAD ORIGINAL WORD TEMPLATE
    const source = fs.readFileSync(templatePath);

    const zip = new PizZip(source);

    const doc = new Docxtemplater(zip, {
      paragraphLoop: false,
      linebreaks: false,
      delimiters: {
        start: '{{',
        end: '}}'
      }
    });

    // 13. FORMAT DATE (PHILIPPINE TIME)
    const formatDate = new Intl.DateTimeFormat(
      'en-US',
      {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'Asia/Manila'
      }
    );

    // 14. AUTOMATICALLY FILL THE ORIGINAL FORM
    doc.render({

      NO: issuance.issuance_number,

      ISSUE_DATE: formatDate.format(
        new Date(issuance.created_at)
      ),

      RECIPIENT:
        borrower.organization ||
        borrower.borrower_name,

      MACHINE_NAME: machine.machine_name,

      SERIAL_NUMBER: machine.serial_number,

      PURPOSE:
        loan.purpose ||
        'FOR LOANER',

      RELEASED_BY:
        releaser.full_name,

      APPROVED_BY: 'Ferdinand Coderias',

      RECEIVED_BY:
        borrower.borrower_name

    });

    // 15. GENERATE WORD DOCUMENT
    const output = doc.getZip().generate({
      type: 'nodebuffer',
      compression: 'DEFLATE'
    });

    // 16. DOWNLOAD THE COMPLETED ORIGINAL FORM
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );

    res.setHeader(
      'Cache-Control',
      'no-store, private'
    );

    res.setHeader(
      'X-Content-Type-Options',
      'nosniff'
    );

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="Product_Issuance_${issuance.issuance_number}.docx"`
    );

    return res.status(200).send(output);

  } catch (error) {

    console.error(
      'Issuance form generation error:',
      error
    );

    return res.status(500).json({
      error: 'Could not generate the issuance document'
    });

  }
}
