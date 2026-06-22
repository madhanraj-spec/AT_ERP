const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  // Let's find the DOF first
  const { data: dofs, error: dofErr } = await supabase
    .from('dyeing_order_forms')
    .select('id, dof_number, expected_delivery_date')
    .eq('dof_number', 'AT/2026/DOF/00007');

  if (dofErr) {
    console.error('Error fetching DOF:', dofErr);
    return;
  }

  console.log('DOF info:', dofs);

  if (dofs.length > 0) {
    const dofId = dofs[0].id;
    // Let's check receipts
    const { data: receipts, error: recErr } = await supabase
      .from('dyed_yarn_receipts')
      .select('*')
      .eq('dof_id', dofId);

    if (recErr) {
      console.error('Error fetching receipts:', recErr);
      return;
    }

    console.log('Receipts for DOF:', receipts);
  }
}

run();
