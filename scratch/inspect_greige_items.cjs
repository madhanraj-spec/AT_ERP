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

async function inspect() {
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email: 'tharun@at.com',
    password: 'admin123'
  });

  if (signInErr) {
    console.error('Sign in failed:', signInErr.message);
    return;
  }

  // Fetch all greige yarn delivery items linked to DOF/00001's GYDRs, with order numbers
  const { data: dofs } = await supabase
    .from('dyeing_order_forms')
    .select('id')
    .eq('dof_number', 'AT/2026/DOF/00001');
  
  const dofId = dofs[0].id;

  const { data: items, error: err } = await supabase
    .from('greige_yarn_delivery_items')
    .select(`
      id,
      colour,
      quantity_kg,
      receipt:greige_yarn_delivery_receipts(gydr_number),
      order:orders(order_number)
    `)
    .in('receipt_id', (
      await supabase
        .from('greige_yarn_delivery_receipts')
        .select('id')
        .eq('dof_id', dofId)
    ).data.map(g => g.id));

  if (err) {
    console.error('Error:', err.message);
    return;
  }

  console.log('Greige items details with orders:');
  items.forEach(i => {
    console.log(`- Receipt: ${i.receipt?.gydr_number}, Colour: ${i.colour}, Qty: ${i.quantity_kg} kg, Order: ${i.order?.order_number}`);
  });
}

inspect();
