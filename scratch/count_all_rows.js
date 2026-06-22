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
    console.error("Auth error:", authErr.message);
    return;
  }
  console.log("Signed in successfully.");

  const tables = [
    'inspections',
    'processing_finance_bills',
    'production_finance_bills',
    'greige_yarn_delivery_items',
    'greige_yarn_delivery_receipts',
    'dyed_yarn_receipt_items',
    'dyed_yarn_receipts',
    'dyed_yarn_delivery_items',
    'dyed_yarn_deliveries',
    'greige_yarn_receipts',
    'dyeing_order_forms',
    'warping_order_forms',
    'sizing_order_forms',
    'processing_orders',
    'warping_orders',
    'weaving_orders',
    'production_jobs',
    'production_forms',
    'orders',
    'inventory_items',
    'fabric_movements',
    'master_machines',
    'master_partners',
    'master_departments',
    'master_yarn_counts',
    'master_brands',
    'master_locations',
    'master_beams',
    'master_workers',
    'profiles'
  ];

  console.log("\n--- Table Row Counts ---");
  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error(`❌ Error counting ${table}:`, error.message);
    } else {
      console.log(`${table}: ${count} rows`);
    }
  }
}

run();
