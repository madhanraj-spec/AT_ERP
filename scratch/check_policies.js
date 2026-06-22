import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Read .env file manually
const envPath = path.resolve(process.cwd(), '.env');
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
  console.log("Signing in as tharun@at.com...");
  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: 'tharun@at.com',
    password: 'admin123'
  });
  if (authErr) {
    console.error("Auth error:", authErr);
    return;
  }
  console.log("Signed in.");

  const { data, error } = await supabase.rpc('get_policies'); // may not exist, let's try direct query or list policies
  if (error) {
    // try to query pg_policies via custom SQL if allowed, or just print what we can see
    console.log("Could not call get_policies RPC, trying to inspect data directly...");
  }

  // Let's print out what tharun@at.com can see from weaving_orders
  const { data: wvofs, error: wvErr } = await supabase
    .from('weaving_orders')
    .select('id, weaving_number, order_id, fabric_rolls');
  
  if (wvErr) {
    console.error("Error fetching weaving orders:", wvErr);
    return;
  }

  console.log("weaving_orders count returned:", wvofs.length);
  wvofs.forEach(w => {
    console.log(`Weaving Order: ${w.weaving_number}, order_id: ${w.order_id}, rolls count: ${w.fabric_rolls?.length || 0}`);
  });
}

run();
