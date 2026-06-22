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

  // Let's get one item from dyed_yarn_receipt_items
  const { data: recItems, error: recErr } = await supabase
    .from('dyed_yarn_receipt_items')
    .select('*')
    .limit(1);

  if (recErr) console.error("receipt items err:", recErr);
  else console.log("Receipt Item keys:", recItems[0] ? Object.keys(recItems[0]) : "No items", recItems[0]);

  // Let's get one item from dyed_yarn_delivery_items
  const { data: delItems, error: delErr } = await supabase
    .from('dyed_yarn_delivery_items')
    .select('*')
    .limit(1);

  if (delErr) console.error("delivery items err:", delErr);
  else console.log("Delivery Item keys:", delItems[0] ? Object.keys(delItems[0]) : "No items", delItems[0]);
}

run();
