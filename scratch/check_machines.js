const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables
if (fs.existsSync('.env')) {
  const envConfig = dotenv.parse(fs.readFileSync('.env'));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase env vars in .env file");
  process.exit(1);
}

const pkg = require('./package.json');
console.log("Dependencies:", pkg.dependencies);

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  const { data: machines, error: mErr } = await supabase
    .from('master_machines')
    .select('*');
  
  if (mErr) {
    console.error("Error fetching machines:", mErr);
  } else {
    console.log(`Fetched ${machines.length} machines:`);
    console.log(JSON.stringify(machines.map(m => ({
      id: m.id,
      machine_name: m.machine_name,
      scope: m.scope,
      partner_id: m.partner_id,
      department_id: m.department_id
    })), null, 2));
  }

  const { data: partners, error: pErr } = await supabase
    .from('master_partners')
    .select('*')
    .ilike('partner_type', '%sizing%');
  
  if (pErr) {
    console.error("Error fetching partners:", pErr);
  } else {
    console.log(`Fetched ${partners.length} sizing partners:`);
    console.log(JSON.stringify(partners.map(p => ({
      id: p.id,
      partner_name: p.partner_name,
      partner_type: p.partner_type
    })), null, 2));
  }
}

check();
