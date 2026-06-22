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
  console.log("Signed in.");

  // Query RPC routines in public schema
  const { data: routines, error } = await supabase
    .from('pg_proc')
    .select(`
      proname,
      prosrc
    `)
    .eq('pronamespace', '2200'); // 2200 is public schema namespace in pg_namespace

  if (error) {
    console.error("Error querying routines:", error.message);
  } else {
    console.log("Found routines in public schema:", routines?.length || 0);
    routines?.forEach(r => {
      if (r.proname.includes('sql') || r.proname.includes('exec') || r.proname.includes('query') || r.proname.includes('run')) {
        console.log(`Matching Routine: ${r.proname}`);
        console.log(`Source:\n${r.prosrc}\n----------------`);
      } else {
        console.log(`Routine: ${r.proname}`);
      }
    });
  }
}

run();
