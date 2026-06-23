const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkStopped() {
  const { data, error } = await supabase
    .from('warping_order_forms')
    .select('id, wof_number, status, warp_splits, warp_splits_count, wofdc_number')
    .eq('status', 'stopped');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Stopped WOFs:');
  console.log(JSON.stringify(data, null, 2));
}

checkStopped();
