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

  // Fetch all GYDRs with their dof_id and dof_number
  const { data: gydrs, error: gydrErr } = await supabase
    .from('greige_yarn_delivery_receipts')
    .select(`
      id,
      gydr_number,
      dof_id,
      dof_number,
      dyeing_order_forms(dof_number)
    `)
    .order('gydr_number');

  if (gydrErr) {
    console.error('Error fetching GYDRs:', gydrErr.message);
    return;
  }

  console.log('All GYDRs in the database:');
  gydrs.forEach(g => {
    console.log(`- Receipt: ${g.gydr_number}, dof_id field in GYDR: ${g.dof_id}, dof_number field in GYDR: ${g.dof_number}, Actual Linked DOF: ${g.dyeing_order_forms?.dof_number}`);
  });
}

inspect();
