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

  // Get receipt AT/2026/DYRR/00003
  const { data: recs, error: recErr } = await supabase
    .from('dyed_yarn_receipts')
    .select('*, items:dyed_yarn_receipt_items(*)')
    .eq('dyrr_number', 'AT/2026/DYRR/00003');

  if (recErr || !recs || recs.length === 0) {
    console.error("Error or no receipt:", recErr);
    return;
  }

  const receipt = recs[0];
  console.log(`\n--- Receipt: ${receipt.dyrr_number} (ID: ${receipt.id}) ---`);
  for (const item of receipt.items) {
    console.log(`Receipt Item: ID: ${item.id}`);
    console.log(`  Count ID: ${item.yarn_count_id}`);
    console.log(`  Colour: ${item.colour}`);
    console.log(`  Lot Number: ${item.lot_number}`);
    console.log(`  Quantity Received: ${item.quantity_kg} kg`);
    console.log(`  Location ID: ${item.location_id}`);
  }

  console.log("\n--- Checking Deliveries for these item parameters ---");
  // Let's find all delivery items referencing the order_id, yarn_count_id, colour, lot_number, and location_id
  const orderId = receipt.items[0]?.order_id;
  const { data: delItems, error: delErr } = await supabase
    .from('dyed_yarn_delivery_items')
    .select('*');

  if (delErr) {
    console.error("Error fetching delivery items:", delErr);
    return;
  }

  console.log(`Total delivery items in DB: ${delItems.length}`);
  
  // Filter for matching items
  const matches = delItems.filter(d => 
    receipt.items.some(item => 
      d.yarn_count_id === item.yarn_count_id &&
      d.colour === item.colour &&
      d.lot_number === item.lot_number &&
      d.location_id === item.location_id
    )
  );

  console.log(`Matching delivery items count: ${matches.length}`);
  for (const d of matches) {
    console.log(`Delivery Item ID: ${d.id}`);
    console.log(`  Quantity Delivered: ${d.quantity_kg} kg`);
    console.log(`  Production Form ID: ${d.production_form_id}`);
    console.log(`  Process Type: ${d.process_type}`);
    console.log(`  Source Receipt ID: ${d.source_receipt_id}`);
    
    // Check if the production form exists
    if (d.process_type === 'weaving') {
      const { data: wo, error: woErr } = await supabase
        .from('weaving_orders')
        .select('id, wof_number')
        .eq('id', d.production_form_id);
      if (woErr) console.error("    Error checking weaving order:", woErr);
      else console.log(`    Weaving Order exists:`, wo && wo.length > 0 ? `Yes (${wo[0].wof_number})` : `No (Deleted)`);
    } else {
      const { data: wof, error: wofErr } = await supabase
        .from('warping_order_forms')
        .select('id, wof_number')
        .eq('id', d.production_form_id);
      if (wofErr) console.error("    Error checking warping order:", wofErr);
      else console.log(`    Warping Order exists:`, wof && wof.length > 0 ? `Yes (${wof[0].wof_number})` : `No (Deleted)`);
    }
  }
}

run();
