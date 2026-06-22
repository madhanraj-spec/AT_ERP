import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load env variables
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

async function run() {
  console.log("Signing in...");
  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: 'tharun@at.com',
    password: 'admin123'
  });

  if (authErr) {
    console.error("Auth error:", authErr);
    return;
  }
  console.log("Signed in successfully.");

  // Let's get the receipt items for DOF/0003
  // Receipts are stored in dyed_yarn_receipt_items or dyed_yarn_receipts.
  // Let's check the tables. We'll search for dyrr_number or dof_number or dof_id.
  console.log("Fetching dyed yarn receipts related to DOF/0003...");
  const { data: receipts, error: recErr } = await supabase
    .from('dyed_yarn_receipts')
    .select('*, items:dyed_yarn_receipt_items(*)')
    .eq('dof_number', 'AT/2026/DOF/00003');

  if (recErr) {
    console.error("Receipts error:", recErr);
  } else {
    console.log("Receipts count:", receipts.length);
    receipts.forEach(r => {
      console.log(`Receipt: ${r.dyrr_number}, Status: ${r.status}`);
      r.items.forEach(item => {
        console.log(`  - Item ID: ${item.id}, Colour: ${item.colour}, Count ID: ${item.yarn_count_id}, Lot: ${item.lot_number}, Qty: ${item.received_qty_kg} kg`);
      });
    });
  }

  console.log("\nFetching dyed yarn deliveries related to DOF/0003...");
  // Let's fetch all dyed_yarn_delivery_items for dof_number 'AT/2026/DOF/00003' or similar.
  const { data: deliveries, error: delErr } = await supabase
    .from('dyed_yarn_delivery_items')
    .select('*, delivery:dyed_yarn_deliveries(*)')
    .eq('dof_number', 'AT/2026/DOF/00003');

  if (delErr) {
    console.error("Deliveries error:", delErr);
  } else {
    console.log("Deliveries count:", deliveries.length);
    deliveries.forEach(item => {
      console.log(`  - Delivery Item ID: ${item.id}, Production Form ID: ${item.production_form_id}, Process Type: ${item.process_type}`);
      console.log(`    Colour: ${item.colour}, Count ID: ${item.yarn_count_id}, Lot: ${item.lot_number}, Qty: ${item.quantity_kg} kg, Location: ${item.location_id}`);
      console.log(`    Parent Delivery ID: ${item.delivery_id}, Status: ${item.delivery?.status}`);
    });
  }
}

run();
