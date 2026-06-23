const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: 'tharun@at.com',
    password: 'admin123'
  });

  if (authErr) {
    console.error("Auth error:", authErr);
    return;
  }
  console.log("Signed in successfully.");

  // 1. Find the order ID for AT/2026/B/00002
  const { data: orderData, error: orderErr } = await supabase
    .from('orders')
    .select('id, order_number, yarn_requirements')
    .eq('order_number', 'AT/2026/B/00002')
    .single();

  if (orderErr) {
    console.error("Error finding order:", orderErr);
    return;
  }
  console.log("Order found:", orderData);
  const orderId = orderData.id;

  // 2. Fetch dyed yarn receipts for this order
  const { data: receipts, error: recErr } = await supabase
    .from('dyed_yarn_receipt_items')
    .select('*, receipt:dyed_yarn_receipts(*)')
    .eq('order_id', orderId);
  console.log("\n--- Dyed Yarn Receipt Items ---");
  console.log(receipts?.map(r => ({
    id: r.id,
    colour: r.colour,
    quantity_kg: r.quantity_kg,
    is_excess: r.is_excess,
    source_type: r.receipt?.source_type,
    dyrr_number: r.receipt?.dyrr_number,
    dof_number: r.receipt?.dof_number
  })));

  // 3. Fetch dyed yarn deliveries for this order
  const { data: deliveries, error: delErr } = await supabase
    .from('dyed_yarn_delivery_items')
    .select('*, delivery:dyed_yarn_deliveries(*)')
    .eq('order_id', orderId);
  console.log("\n--- Dyed Yarn Delivery Items ---");
  console.log(deliveries?.map(d => ({
    id: d.id,
    colour: d.colour,
    quantity_kg: d.quantity_kg,
    process_type: d.process_type,
    production_form_id: d.production_form_id,
    dydr_number: d.delivery?.dydr_number
  })));

  // 4. Fetch Warping Order Forms
  const { data: wofs, error: wofErr } = await supabase
    .from('warping_order_forms')
    .select('id, wof_number, status, colour_allotments, yarn_returns')
    .eq('order_id', orderId);
  console.log("\n--- Warping Order Forms ---");
  console.log(JSON.stringify(wofs, null, 2));
}

main();
