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
  console.log("Fetching Dyeing Order Forms...");
  const { data: dofs, error: dofsErr } = await supabase
    .from('dyeing_order_forms')
    .select('*');
  
  if (dofsErr) {
    console.error("Error fetching DOFs:", dofsErr);
    return;
  }
  
  console.log("Fetched DOFs:", dofs.map(d => ({ id: d.id, dof_number: d.dof_number, order_ids: d.order_ids })));

  console.log("\nFetching Dyed Yarn Receipts for RED LOT A:");
  const { data: receipts, error: recErr } = await supabase
    .from('dyed_yarn_receipt_items')
    .select(`
      id,
      colour,
      lot_number,
      quantity_kg,
      order_id,
      receipt:dyed_yarn_receipts(dof_id, dof_number, dyrr_number)
    `)
    .eq('colour', 'RED')
    .eq('lot_number', 'LOT A');

  if (recErr) console.error(recErr);
  else console.log(JSON.stringify(receipts, null, 2));

  console.log("\nFetching Dyed Yarn Deliveries for RED LOT A:");
  const { data: deliveries, error: delErr } = await supabase
    .from('dyed_yarn_delivery_items')
    .select(`
      id,
      colour,
      lot_number,
      quantity_kg,
      order_id,
      production_form_id,
      process_type,
      delivery:dyed_yarn_deliveries(dydr_number)
    `)
    .eq('colour', 'RED')
    .eq('lot_number', 'LOT A');

  if (delErr) console.error(delErr);
  else console.log(JSON.stringify(deliveries, null, 2));
}

run();
