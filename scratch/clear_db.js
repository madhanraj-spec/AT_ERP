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
  console.log("Signed in successfully as tharun@at.com.");

  // Correct order of tables to delete to avoid foreign key constraint violations
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
    'master_machines',
    'master_partners',
    'master_departments',
    'master_yarn_counts',
    'master_brands',
    'master_locations',
    'master_beams',
    'master_workers'
  ];

  console.log("Starting data clearance...");

  for (const table of tables) {
    console.log(`Clearing table: ${table}...`);
    // Delete all records (using neq id to some random uuid or gte id to empty or just filter everything)
    // In Supabase client, to delete all rows we can use .neq('id', '00000000-0000-0000-0000-000000000000') 
    // or since some IDs are serial / UUID / text / whatever, we can filter using .neq('id', '00000000-0000-0000-0000-000000000000') or checking table metadata.
    // Let's use a universal delete match if possible. E.g., we can do .neq('created_at', '1970-01-01T00:00:00Z') or check if table has id.
    // Every table in our list has either an 'id' column or another primary key.
    // Let's see: all tables have 'id' as primary key.
    const { data, error } = await supabase
      .from(table)
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
      .select();

    if (error) {
      console.error(`❌ Error clearing ${table}:`, error.message);
    } else {
      console.log(`✅ Cleared ${table}: ${data?.length || 0} rows deleted.`);
    }
  }

  console.log("Database clearance finished.");
}

run();
