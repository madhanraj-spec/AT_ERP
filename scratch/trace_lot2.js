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
  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: 'tharun@at.com',
    password: 'admin123'
  });

  if (authErr) {
    console.error("Auth error:", authErr);
    return;
  }

  // Find dyed yarn receipt items for Lot 2
  const { data: receipts, error: recErr } = await supabase
    .from('dyed_yarn_receipt_items')
    .select('id, quantity_kg, colour, lot_number, location_id, receipt:dyed_yarn_receipts(dof_id, dof_number, source_type)')
    .eq('lot_number', '2');

  if (recErr) {
    console.error("Receipts error:", recErr);
  } else {
    console.log("--- dyed_yarn_receipt_items for Lot 2 ---");
    console.log(JSON.stringify(receipts, null, 2));
  }

  // Find dyed yarn delivery items for Lot 2
  const { data: deliveries, error: delErr } = await supabase
    .from('dyed_yarn_delivery_items')
    .select('id, quantity_kg, colour, lot_number, location_id, process_type, delivery:dyed_yarn_deliveries(delivery_type, dof_number)')
    .eq('lot_number', '2');

  if (delErr) {
    console.error("Deliveries error:", delErr);
  } else {
    console.log("--- dyed_yarn_delivery_items for Lot 2 ---");
    console.log(JSON.stringify(deliveries, null, 2));
  }
}

run();
