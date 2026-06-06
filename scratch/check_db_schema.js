const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase credentials not found in env variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  console.log('Querying dyed_yarn_delivery_items...');
  const { data, error } = await supabase
    .from('dyed_yarn_delivery_items')
    .select('id, lot_number, location_id')
    .limit(1);

  if (error) {
    console.error('Error querying columns:', error.message);
    if (error.message.includes('column') || error.message.includes('does not exist')) {
      console.log('Verification: Columns lot_number and/or location_id DO NOT exist.');
    }
  } else {
    console.log('Successfully queried table! Columns lot_number and location_id exist.');
    console.log('Data returned (up to 1 row):', data);
  }
}

checkSchema();
