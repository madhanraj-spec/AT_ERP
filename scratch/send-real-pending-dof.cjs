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

  // Find the latest pending dyeing order form
  const { data: dof, error: dofErr } = await supabase
    .from('dyeing_order_forms')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (dofErr || !dof) {
    console.log('No pending Dyeing Order Form found in the database.');
    return;
  }

  console.log(`Found pending DOF: ${dof.dof_number}`);
  
  // Inject origin for PDF generation
  dof.origin = 'https://at-erp.vercel.app';

  console.log('Invoking send-whatsapp for real pending DOF:', dof.dof_number);
  const { data, error } = await supabase.functions.invoke('send-whatsapp', {
    body: { record: dof }
  });

  if (error) {
    console.error('Function execution error:', error.message);
  } else {
    console.log('Success response:');
    console.dir(data, { depth: null });
  }
}

test();
