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
  console.log(`Deleting bill ${billNo}...`);
  
  const { data, error: delErr } = await supabase
    .from('production_finance_bills')
    .delete()
    .eq('bill_number', billNo)
    .select();

  if (delErr) {
    console.error("Error deleting bill:", delErr);
    return;
  }

  console.log("Deleted bills count:", data?.length || 0);
  if (data && data.length > 0) {
    console.log("Deleted bill details:", JSON.stringify(data[0], null, 2));
  } else {
    console.log("No bill was deleted (it may not exist or policy blocked it).");
  }
}

run();
