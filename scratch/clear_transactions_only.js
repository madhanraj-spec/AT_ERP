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
  console.log("Signed in successfully as tharun@at.com.");

  // Tables to clear in order of dependency to avoid foreign key errors
  const tables = [
    'inspections',
    'fabric_movements',
    'processing_orders',
    'processing_finance_bills',
    'production_finance_bills',
    'greige_yarn_delivery_items',
    'greige_yarn_delivery_receipts',
    'dyed_yarn_receipt_items',
    'dyed_yarn_receipts',
    'dyed_yarn_delivery_items',
    'dyed_yarn_deliveries',
    'greige_yarn_receipts',
    'weaving_orders',
    'sizing_order_forms',
    'warping_order_forms',
    'warping_orders',
    'dyeing_order_forms',
    'production_jobs',
    'production_forms',
    'orders',
    'inventory_items'
  ];

  console.log("\n--- Starting transaction data clearance ---");

  for (const table of tables) {
    console.log(`Clearing table: ${table}...`);
    
    // First, let's check count before delete
    const { count: beforeCount, error: countErr } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });

    if (countErr) {
      console.error(`  Warning: Count failed for ${table}:`, countErr.message);
    }

    // Try deleting all rows
    const { data, error } = await supabase
      .from(table)
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
      .select();

    if (error) {
      console.error(`  ❌ Error clearing ${table}:`, error.message);
    } else {
      console.log(`  ✅ Cleared ${table}: ${data?.length || 0} rows deleted (had ${beforeCount || 0} rows).`);
    }
  }

  console.log("\n--- Database transaction clearance finished ---");
}

run();
