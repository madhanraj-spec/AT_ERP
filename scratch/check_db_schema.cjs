const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read .env file manually
const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] ? match[2].trim() : '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.substring(1, value.length - 1);
    }
    env[match[1]] = value;
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase credentials not found in env variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  console.log('Querying dyed_yarn_delivery_items...');
  const { data: dydiData, error: dydiErr } = await supabase
    .from('dyed_yarn_delivery_items')
    .select('id, lot_number, location_id')
    .limit(1);

  if (dydiErr) {
    console.error('Error querying delivery items columns:', dydiErr.message);
  } else {
    console.log('Successfully queried delivery items! Columns lot_number and location_id exist.');
  }

  console.log('Querying dyed_yarn_receipt_items...');
  const { data: dyriData, error: dyriErr } = await supabase
    .from('dyed_yarn_receipt_items')
    .select('id, lot_number')
    .limit(1);

  if (dyriErr) {
    console.error('Error querying receipt items columns:', dyriErr.message);
  } else {
    console.log('Successfully queried receipt items! Column lot_number exists.');
  }
}

checkSchema();
