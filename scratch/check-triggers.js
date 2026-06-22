import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

const supabase = createClient(url, key);

async function check() {
  console.log('Checking triggers on dyeing_order_forms...');
  
  // Query the system catalogs for triggers on the dyeing_order_forms table
  const { data, error } = await supabase.rpc('check_table_triggers');
  
  if (error) {
    // If check_table_triggers RPC doesn't exist, we can try running raw SQL by creating a temp function
    // But since we can't run raw SQL from client unless we have an RPC, let's look for triggers by running a query if possible
    // Wait, the client can execute an RPC. Since we don't have check_table_triggers RPC, we can fetch all tables or check if we can run query
    console.error('Error fetching triggers via RPC:', error);
    
    console.log('Attempting to check via query if RLS allows or we can create RPC...');
  } else {
    console.log('Triggers found:');
    console.table(data);
  }
}

// Alternatively, let's just run an RPC using postgres directly or inspect table info
// Let's create the script to attempt to query pg_trigger if public has access, otherwise we can inspect other tables
async function queryTriggers() {
  const supabaseAdmin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY || key);
  
  const { data, error } = await supabaseAdmin.from('pg_trigger').select('*');
  console.log('Querying pg_trigger directly:', error ? error.message : `${data.length} triggers found`);
}

check();
