import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load env variables
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
  console.log("Signing in...");
  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: 'tharun@at.com',
    password: 'admin123'
  });

  if (authErr) {
    console.error("Auth error:", authErr);
    return;
  }
  console.log("Signed in successfully.");

  console.log("Checking order AT/2026/B/00001...");
  
  const { data: orders, error: findErr } = await supabase
    .from('orders')
    .select('*')
    .eq('order_number', 'AT/2026/B/00001');

  if (findErr) {
    console.error("Error finding order:", findErr);
    return;
  }

  console.log("Found orders count:", orders.length);
  if (orders.length > 0) {
    console.log("Order keys:", Object.keys(orders[0]));
    console.log("Order structure:", JSON.stringify(orders[0], null, 2));
  } else {
    console.log("Order does not exist.");
  }
}

run();
