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

  // Fetch weaving order
  const { data: orders, error: orderErr } = await supabase
    .from('weaving_orders')
    .select('*')
    .eq('weaving_number', 'AT/2026/WVOF/S/00001/AWEAINGUNIT/AW1/001');

  if (orderErr) {
    console.error("Error fetching weaving order:", orderErr);
  } else {
    console.log("Weaving Order:", JSON.stringify(orders, null, 2));
  }

  // Fetch current bills
  const { data: bills, error: billErr } = await supabase
    .from('production_finance_bills')
    .select('*')
    .eq('form_type', 'weaving');

  if (billErr) {
    console.error("Error fetching bills:", billErr);
  } else {
    console.log("Bills:", JSON.stringify(bills, null, 2));
  }
}

run();
