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
  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: 'tharun@at.com',
    password: 'admin123'
  });

  if (authErr) {
    console.error("Auth error:", authErr);
    return;
  }

  // Fetch all dyeing order forms
  const { data: dofs } = await supabase.from('dyeing_order_forms').select('*');
  console.log("--- dyeing_order_forms ---");
  console.log(JSON.stringify(dofs, null, 2));

  // Fetch all dyed yarn receipts
  const { data: receipts } = await supabase.from('dyed_yarn_receipts').select('*');
  console.log("--- dyed_yarn_receipts ---");
  console.log(JSON.stringify(receipts, null, 2));

  // Fetch all dyed yarn delivery items
  const { data: deliveryItems } = await supabase.from('dyed_yarn_delivery_items').select('*, delivery:dyed_yarn_deliveries(*)');
  console.log("--- dyed_yarn_delivery_items ---");
  console.log(JSON.stringify(deliveryItems, null, 2));
}

run();
