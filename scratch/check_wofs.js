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
  console.log("Signed in successfully.");

  // Fetch warping order forms
  const { data: wofs, error: wofErr } = await supabase
    .from('warping_order_forms')
    .select('*')
    .order('wof_number', { ascending: false });

  if (wofErr) {
    console.error("Error fetching WOFs:", wofErr);
    return;
  }

  console.log(`\n=== WARPING ORDER FORMS (${wofs.length}) ===`);
  wofs.forEach(wof => {
    console.log(`WOF: ${wof.wof_number}
  Status: ${wof.status}
  WOFDC Number: ${wof.wofdc_number}
  Planned End Date: ${wof.end_date}
  Completed At: ${wof.process_completed_at}
  Updated At: ${wof.updated_at}`);
  });
}

run();
