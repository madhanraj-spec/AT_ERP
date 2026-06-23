const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectOrder() {
  console.log("Signing in...");
  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: 'tharun@at.com',
    password: 'admin123'
  });

  if (authErr) {
    console.error("Auth error:", authErr.message);
    return;
  }
  console.log("Signed in successfully!");

  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, order_number, yarn_requirements')
    .eq('order_number', 'AT/2026/B/00002');

  if (error) {
    console.error('Error fetching order:', error);
    return;
  }

  console.log('Order:');
  console.log(JSON.stringify(orders, null, 2));

  if (orders && orders.length > 0) {
    const { data: wofs, error: wErr } = await supabase
      .from('warping_order_forms')
      .select('id, wof_number, status, colour_allotments, yarn_returns')
      .eq('order_id', orders[0].id);
    if (!wErr) {
      console.log('WOFs:');
      console.log(JSON.stringify(wofs, null, 2));
    } else {
      console.error('WOF fetch error:', wErr);
    }
  }
}

inspectOrder();
