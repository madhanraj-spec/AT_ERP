const fs = require('fs');
const dotenv = require('dotenv');

if (fs.existsSync('.env')) {
  const envConfig = dotenv.parse(fs.readFileSync('.env'));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  const tables = [
    'master_machines',
    'master_partners',
    'master_workers',
    'sizing_order_forms',
    'warping_order_forms',
    'orders'
  ];

  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.log(`Table ${table}: Error - ${error.message}`);
    } else {
      console.log(`Table ${table}: ${count} rows`);
    }
  }

  // Also query one row from master_machines if any exist
  const { data: oneMachine } = await supabase.from('master_machines').select('*').limit(1);
  console.log("One machine:", oneMachine);
}

check();
