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

  const duplicateReceiptNo = 'AT/2026/DYRR/00008';
  console.log(`Checking if receipt ${duplicateReceiptNo} exists...`);
  
  const { data: receipts, error: findErr } = await supabase
    .from('dyed_yarn_receipts')
    .select('*')
    .eq('dyrr_number', duplicateReceiptNo);

  if (findErr) {
    console.error("Error finding receipt:", findErr);
    return;
  }

  console.log("Found receipts count:", receipts.length);
  if (receipts.length > 0) {
    console.log("Receipt details:", receipts[0]);
  } else {
    console.log("Receipt does not exist anymore.");
  }
}

run();
