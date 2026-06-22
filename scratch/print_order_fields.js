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
  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: 'tharun@at.com',
    password: 'admin123'
  });

  const { data: orders, error: orderErr } = await supabase
    .from('weaving_orders')
    .select('*')
    .eq('weaving_number', 'AT/2026/WVOF/S/00001/AWEAINGUNIT/AW1/001');

  if (orders && orders[0]) {
    const o = orders[0];
    console.log("Weaving Order Fields:");
    for (const key of Object.keys(o)) {
      if (key !== 'fabric_rolls' && key !== 'yarn_returns') {
        console.log(`${key}:`, o[key]);
      }
    }
  }
}

run();
