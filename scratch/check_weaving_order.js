import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

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
    email: 'madhanraj@ashoktextiles.com',
    password: 'admin123'
  });
  if (authErr) {
    console.error("Auth error:", authErr.message);
    return;
  }
  console.log("Logged in as Madhanraj.");

  const deliveryId = '438417b8-1931-48b1-94ef-72c1cd9a2b9e';
  const itemIds = [
    'b4139ead-d6a2-4e71-80f6-067185778d87',
    '3bdbb2d5-c573-4997-bdae-e02b3c3a352c'
  ];

  console.log("Deleting orphaned items...");
  const { data: delItems, error: delItemsErr } = await supabase
    .from('dyed_yarn_delivery_items')
    .delete()
    .in('id', itemIds)
    .select();

  if (delItemsErr) {
    console.error("Error deleting items:", delItemsErr.message);
  } else {
    console.log("Deleted items:", delItems);
  }

  console.log("Deleting delivery header...");
  const { data: delHeader, error: delHeaderErr } = await supabase
    .from('dyed_yarn_deliveries')
    .delete()
    .eq('id', deliveryId)
    .select();

  if (delHeaderErr) {
    console.error("Error deleting header:", delHeaderErr.message);
  } else {
    console.log("Deleted header:", delHeader);
  }
}

run();
