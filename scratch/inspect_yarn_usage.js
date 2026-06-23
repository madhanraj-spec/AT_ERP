const { createClient } = require('@supabase/supabase-base-js');
const dotenv = require('dotenv');
const path = require('path');

// Load env
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
  // Find order
  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_number')
    .eq('order_number', 'AT/2026/B/00002');
  
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

  // Dyed Yarn Receipts (from dyeing)
  const { data: dyri } = await supabase
    .from('dyed_yarn_receipt_items')
    .select('*, receipt:dyed_yarn_receipts(*)')
    .eq('order_id', order.id);
  console.log('\nDyed Yarn Receipt Items (from dyeing or returns):');
  console.dir(dyri, { depth: null });

  // Dyed Yarn Deliveries (to warping/weaving)
  const { data: dydi } = await supabase
    .from('dyed_yarn_delivery_items')
    .select('*, delivery:dyed_yarn_deliveries(*)')
    .eq('order_id', order.id);
  console.log('\nDyed Yarn Delivery Items (to warping/weaving):');
  console.dir(dydi, { depth: null });
}

inspect();
