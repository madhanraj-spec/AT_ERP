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

  const billNo = 'WV-A W-MQEXSMJF';
  console.log(`Checking if bill ${billNo} exists...`);
  
  const { data: bills, error: findErr } = await supabase
    .from('production_finance_bills')
    .select('*')
    .eq('bill_number', billNo);

  if (findErr) {
    console.error("Error finding bill:", findErr);
    return;
  }

  console.log("Found bills count:", bills.length);
  if (bills.length > 0) {
    console.log("Bill details:", JSON.stringify(bills[0], null, 2));
  } else {
    console.log("Bill does not exist.");
  }
}

run();
