const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load env
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspect() {
  // Sign in
  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: 'tharun@at.com',
    password: 'admin123'
  });

  if (authErr) {
    console.error("Auth error:", authErr);
    return;
  }

  // Find order
  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_number, yarn_requirements')
    .eq('order_number', 'AT/2026/B/00001');
  
  if (!orders || orders.length === 0) {
    console.log('Order not found');
    return;
  }
  const order = orders[0];
  console.log('Order:', order);

  // Warping Order Forms
  const { data: wofs } = await supabase
    .from('warping_order_forms')
    .select('id, wof_number, status, colour_allotments, yarn_returns')
    .eq('order_id', order.id);
  console.log('\nWarping Order Forms:');
  console.dir(wofs, { depth: null });

  // Weaving Order Forms (if any)
  const { data: weavings } = await supabase
    .from('weaving_orders')
    .select('id, weaving_number, status, weft_allotments, yarn_returns')
    .eq('order_id', order.id);
  console.log('\nWeaving Orders:');
  console.dir(weavings, { depth: null });

  // Dyed Yarn Receipts (from dyeing)
  const { data: dyri } = await supabase
    .from('dyed_yarn_receipt_items')
    .select('*, receipt:dyed_yarn_receipts(*), location:master_locations(location_name)')
    .eq('order_id', order.id);
  console.log('\nDyed Yarn Receipt Items (from dyeing or returns):');
  console.dir(dyri.map(i => ({
    id: i.id,
    colour: i.colour,
    yarn_count_id: i.yarn_count_id,
    quantity_kg: i.quantity_kg,
    is_excess: i.is_excess,
    lot_number: i.lot_number,
    location_name: i.location?.location_name,
    receipt_source_type: i.receipt?.source_type,
    dyrr_number: i.receipt?.dyrr_number
  })), { depth: null });

  // Dyed Yarn Deliveries (to warping/weaving)
  const { data: dydi } = await supabase
    .from('dyed_yarn_delivery_items')
    .select('*, delivery:dyed_yarn_deliveries(*), location:master_locations(location_name)')
    .eq('order_id', order.id);
  console.log('\nDyed Yarn Delivery Items (to warping/weaving):');
  console.dir(dydi.map(d => ({
    id: d.id,
    colour: d.colour,
    yarn_count_id: d.yarn_count_id,
    quantity_kg: d.quantity_kg,
    process_type: d.process_type,
    lot_number: d.lot_number,
    location_name: d.location?.location_name,
    dydr_number: d.delivery?.dydr_number
  })), { depth: null });
}

inspect();
