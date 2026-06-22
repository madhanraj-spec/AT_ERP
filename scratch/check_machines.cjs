const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load env variables
const envPath = path.resolve(__dirname, '../.env');
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
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'tharun@at.com',
    password: 'admin123'
  });

  if (authErr) {
    console.error("Auth error:", authErr.message);
    return;
  }

  const { data: machines, error } = await supabase
    .from('master_machines')
    .select('*, master_departments(department_name)');

  if (error) {
    console.error("Error fetching machines:", error);
    return;
  }

  console.log("Machines in DB count:", machines.length);
  machines.forEach(m => {
    console.log(`ID: ${m.id}, Name: ${m.machine_name}, Scope: ${m.scope}, Dept: ${m.master_departments?.department_name}`);
  });
}

run();
