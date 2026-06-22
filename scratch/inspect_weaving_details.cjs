const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load env variables
const envPath = path.resolve(__dirname, '../.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length === 2) {
    env[parts[0].trim()] = parts[1].trim();
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: 'tharun@at.com',
    password: 'admin123'
  });

  if (authErr) {
    console.error("Auth error:", authErr.message);
    return;
  }

  const { data: orders, error } = await supabase
    .from('weaving_orders')
    .select(`*`)
    .limit(1);

  if (error) {
    console.error("Error fetching weaving orders:", error);
    return;
  }

  console.log("Weaving Order Keys:", orders.length > 0 ? Object.keys(orders[0]) : "No rows");
}

run();
