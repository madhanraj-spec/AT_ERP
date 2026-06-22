const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

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

async function run() {
  console.log("Signing in...");
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'tharun@at.com',
    password: 'admin123'
  });

  if (authErr) {
    console.error("Auth error:", authErr.message);
    return;
  }
  console.log("Signed in successfully as tharun@at.com.");

  console.log("Checking sizing_order_forms table columns...");
  const { data, error } = await supabase
    .from('sizing_order_forms')
    .select('id, forwarded_to, weaving_type')
    .limit(1);

  if (error) {
    console.error("Error fetching sizing_order_forms:", error.message);
  } else {
    console.log("Successfully fetched! Sizing order forms have forwarded_to and weaving_type columns. Rows fetched:", data.length);
  }
}

run();
