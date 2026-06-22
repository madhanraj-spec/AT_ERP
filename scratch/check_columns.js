const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase
    .from('warping_order_forms')
    .select('id, wofdc_number, yarn_returns')
    .limit(1);

  if (error) {
    console.error('Error querying columns:', error.message);
  } else {
    console.log('Columns exist! Data:', data);
  }
}

check();
