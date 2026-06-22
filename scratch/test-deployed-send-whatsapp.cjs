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
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data: authData, error: signInErr } = await supabase.auth.signInWithPassword({
    email: 'tharun@at.com',
    password: 'admin123'
  });

  if (signInErr) {
    console.error('Sign in failed:', signInErr.message);
    return;
  }

  // Use a valid dyeing unit ID from Annamalai or another partner
  const { data: partner } = await supabase
    .from('master_partners')
    .select('id, partner_name')
    .eq('partner_type', 'Dyeing Unit')
    .limit(1)
    .single();

  // Fetch some active order IDs to link
  const { data: orders } = await supabase
    .from('orders')
    .select('id')
    .limit(2);

  const orderIds = orders ? orders.map(o => o.id) : [];

  const mockRecord = {
    id: 'e312f2c9-6fb4-4cd7-959c-7c08798bb2ef',
    dof_number: 'AT/2026/DOF/00009',
    created_by: 'a8c5ba81-b565-43d1-83be-bb9a871c2585', // Madhanraj's profile ID
    dyeing_unit_id: partner ? partner.id : '0dcf1a23-4554-469b-8e10-44be258c7075',
    expected_delivery_date: '2026-06-30',
    order_ids: orderIds,
    summary: [
      { colour: 'Red', yarnLabel: '40s CC - Cotton - Combed', total_kg: 25.0 },
      { colour: 'Blue', yarnLabel: '30s CC - Cotton - Combed', total_kg: 35.0 }
    ],
    status: 'pending',
    origin: 'https://at-erp.vercel.app'
  };

  console.log('Invoking send-whatsapp with realistic mock record for DOF (with URL, Orders & Creator):', mockRecord.dof_number);
  const { data, error } = await supabase.functions.invoke('send-whatsapp', {
    body: { record: mockRecord }
  });

  if (error) {
    console.error('Function execution error:', error.message);
  } else {
    console.log('Success response:');
    console.dir(data, { depth: null });
  }
}

test();
