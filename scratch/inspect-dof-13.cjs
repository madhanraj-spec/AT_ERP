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

  const { data: dof, error: dofErr } = await supabase
    .from('dyeing_order_forms')
    .select('*')
    .eq('dof_number', 'AT/2026/DOF/00013')
    .single();

  if (dofErr || !dof) {
    console.error('Error fetching DOF 00013:', dofErr ? dofErr.message : 'Not found');
    return;
  }

  console.log('DOF 00013 details:');
  console.dir(dof, { depth: null });
}

inspect();
