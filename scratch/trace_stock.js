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

  // Inspect dyed_yarn_receipts table
  const { data: recs, error: recsErr } = await supabase
    .from('dyed_yarn_receipts')
    .select('*')
    .limit(1);

  if (recsErr) {
    console.error("dyed_yarn_receipts error:", recsErr);
  } else {
    console.log("dyed_yarn_receipts columns:", recs[0] ? Object.keys(recs[0]) : "No receipts", recs[0]);
  }

  // Find dyed_yarn_receipts matching dyrr_number 'AT/2026/DYRR/00003' or similar
  const { data: dofRecs, error: dofRecsErr } = await supabase
    .from('dyed_yarn_receipts')
    .select('*, items:dyed_yarn_receipt_items(*)')
    .eq('dyrr_number', 'AT/2026/DYRR/00003');

  if (dofRecsErr) {
    console.error("dofRecsErr:", dofRecsErr);
  } else {
    console.log("Found receipts:", dofRecs);
  }

  // Let's trace all deliveries matching the order_id or source_receipt_id of the receipt items.
  if (dofRecs && dofRecs.length > 0) {
    const receiptIds = dofRecs.map(r => r.id);
    const itemIds = [];
    dofRecs.forEach(r => r.items.forEach(it => itemIds.push(it.id)));

    console.log("Receipt Item IDs to trace:", itemIds);

    const { data: deliveriesByReceipt, error: delByRecErr } = await supabase
      .from('dyed_yarn_delivery_items')
      .select('*, delivery:dyed_yarn_deliveries(*)')
      .in('source_receipt_id', itemIds);

    if (delByRecErr) {
      console.error("delByRecErr:", delByRecErr);
    } else {
      console.log("Deliveries by source_receipt_id:", deliveriesByReceipt);
    }
    
    // Also query deliveries by order_id or yarn_count_id + colour
    const firstItem = dofRecs[0].items[0];
    if (firstItem) {
      const { data: deliveriesByYarn, error: delByYarnErr } = await supabase
        .from('dyed_yarn_delivery_items')
        .select('*, delivery:dyed_yarn_deliveries(*)')
        .eq('yarn_count_id', firstItem.yarn_count_id)
        .eq('colour', firstItem.colour);

      if (delByYarnErr) {
        console.error("delByYarnErr:", delByYarnErr);
      } else {
        console.log(`Deliveries for count ${firstItem.yarn_count_id} and colour ${firstItem.colour}:`, deliveriesByYarn.length);
        deliveriesByYarn.forEach(d => {
          console.log(`  - Delivery Item: ID: ${d.id}, Qty: ${d.quantity_kg} kg, source_receipt_id: ${d.source_receipt_id}, production_form_id: ${d.production_form_id}, process_type: ${d.process_type}`);
        });
      }
    }
  }
}

run();
