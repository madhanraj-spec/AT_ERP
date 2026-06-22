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

const serviceRoleKey = process.argv[2];

if (!serviceRoleKey) {
  console.error("❌ Error: Please provide the SUPABASE_SERVICE_ROLE_KEY as a command-line argument.");
  console.error("Usage: node scratch/clear_with_key.js <your_service_role_key>");
  process.exit(1);
}

const supabase = createClient(env.VITE_SUPABASE_URL, serviceRoleKey, {
  auth: { persistSession: false }
});

async function run() {
  console.log("Supabase Admin Client initialized (bypassing RLS)...");

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

  console.log("\n--- Starting admin transaction data clearance ---");

  for (const table of tables) {
    console.log(`Clearing table: ${table}...`);
    
    // Check row count before delete
    const { count: beforeCount, error: countErr } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });

    if (countErr) {
      console.warn(`  Warning: Could not get row count for ${table}:`, countErr.message);
    }

    if (beforeCount === 0) {
      console.log(`  ✅ Table ${table} is already empty.`);
      continue;
    }

    // Try deleting all rows using .neq('id', ...) or matching all ids
    // Since some tables might not have 'id' or might have composite keys, we can match on another universal pattern,
    // or just match id. Every transaction table in this DB has 'id' as primary key.
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
