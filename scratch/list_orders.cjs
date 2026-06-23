const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function listOrders() {
  const { data, error } = await supabase
    .from('orders')
    .select('id, order_number, yarn_requirements')
    .limit(10);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Orders:');
  console.log(JSON.stringify(data, null, 2));

  const { data: wofs, error: wErr } = await supabase
    .from('warping_order_forms')
    .select('id, wof_number, status, colour_allotments, yarn_returns')
    .limit(10);
  if (!wErr) {
    console.log('WOFs:');
    console.log(JSON.stringify(wofs, null, 2));
  }
}

listOrders();
