import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Read .env file manually
const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length === 2) {
    env[parts[0].trim()] = parts[1].trim();
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function checkReceipts() {
  console.log("Logging in as tharun@at.com...");
  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: 'tharun@at.com',
    password: 'admin123'
  });
  if (authErr) {
    console.error("Auth error:", authErr.message);
    return;
  }
  console.log("Logged in successfully.");

  // Fetch dyeing order form
  const { data: dofData, error: dofError } = await supabase
    .from('dyeing_order_forms')
    .select('id, dof_number, expected_delivery_date')
    .eq('dof_number', 'AT/2026/DOF/00007');

  if (dofError) {
    console.error("Error fetching DOF:", dofError);
    return;
  }
  console.log("Dyeing Order Form:", dofData);

  if (dofData && dofData.length > 0) {
    const dof = dofData[0];
    
    // Fetch receipts by dof_id
    const { data: receiptsById, error: err1 } = await supabase
      .from('dyed_yarn_receipts')
      .select('*')
      .eq('dof_id', dof.id);

    console.log(`\nReceipts matching by dof_id (${dof.id}):`, receiptsById);

    // Fetch receipts by dof_number
    const { data: receiptsByNum, error: err2 } = await supabase
      .from('dyed_yarn_receipts')
      .select('*')
      .eq('dof_number', dof.dof_number);

    console.log(`\nReceipts matching by dof_number (${dof.dof_number}):`, receiptsByNum);
    
    // Fetch all receipts to see if there are any
    const { data: allReceipts, error: err3 } = await supabase
      .from('dyed_yarn_receipts')
      .select('*');

    console.log("\nAll Dyed Yarn Receipts:", allReceipts);
  }
}

checkReceipts();
