const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

// Since env files might be in the root or elsewhere, let's read the env variables
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase credentials not found in env variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
  // Find order
  const { data: orders, error: oErr } = await supabase
    .from('orders')
    .select('*')
    .eq('order_number', 'AT/2026/S/00001');

  if (oErr || !orders || orders.length === 0) {
    console.error('Order not found', oErr);
    return;
  }

  const order = orders[0];
  console.log('--- Order Info ---');
  console.log('ID:', order.id);
  console.log('Order Number:', order.order_number);
  console.log('Yarn Requirements:', JSON.stringify(order.yarn_requirements, null, 2));

  // Find WOFs
  const { data: wofs, error: wErr } = await supabase
    .from('warping_order_forms')
    .select('*')
    .eq('order_id', order.id);

  if (wErr) {
    console.error('Error fetching WOFs', wErr);
    return;
  }

  console.log('\n--- Warping Order Forms ---');
  wofs.forEach(w => {
    console.log('WOF ID:', w.id);
    console.log('WOF Number:', w.wof_number);
    console.log('Qty:', w.qty);
    console.log('Colour Allotments:', JSON.stringify(w.colour_allotments, null, 2));
  });

  // Find DYDR items for this order/WOF
  const { data: dydrItems, error: dErr } = await supabase
    .from('dyed_yarn_delivery_items')
    .select(`
      *,
      delivery:dyed_yarn_deliveries(*)
    `)
    .in('production_form_id', wofs.map(w => w.id));

  if (dErr) {
    console.error('Error fetching DYDR items', dErr);
    return;
  }

  console.log('\n--- Associated DYDR Items ---');
  dydrItems.forEach(d => {
    console.log('DYDR No:', d.delivery?.dydr_number);
    console.log('Yarn Count ID:', d.yarn_count_id);
    console.log('Colour:', d.colour);
    console.log('Qty kg:', d.quantity_kg);
    console.log('Production Form ID:', d.production_form_id);
  });
}

inspect();
