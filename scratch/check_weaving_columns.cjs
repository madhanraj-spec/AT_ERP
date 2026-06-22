const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

let supabaseUrl, supabaseKey;
try {
  const envContent = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
  const lines = envContent.split('\n');
  lines.forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) value = value.substring(1, value.length - 1);
      else if (value.startsWith("'") && value.endsWith("'")) value = value.substring(1, value.length - 1);
      if (key === 'VITE_SUPABASE_URL') supabaseUrl = value;
      if (key === 'VITE_SUPABASE_ANON_KEY') supabaseKey = value;
    }
  });
} catch (e) {
  console.error('Failed to read .env file', e);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase
    .from('warping_order_forms')
    .select('id, wof_number, forwarded_to, status');

  if (error) {
    console.log('Error details:', error);
  } else {
    console.log('Warping forms:', data);
  }
}

check();
