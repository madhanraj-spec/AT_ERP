const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
  const { data, error } = await supabase
    .from('sizing_order_forms')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error querying sizing_order_forms:', error.message);
  } else {
    console.log('Available columns in sizing_order_forms:', Object.keys(data[0] || {}));
    console.log('Sample record:', data[0]);
  }
}

inspect();
