import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

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
  await supabase.auth.signInWithPassword({ email: 'tharun@at.com', password: 'admin123' });
  const { data: doc } = await supabase.from('weaving_orders').select('*').eq('weaving_number', 'AT/2026/WVOF/JB/ANITHA/00001').single();
  console.log("ALLOTMENTS FOR WEAVING ORDER:");
  console.log(JSON.stringify(doc.weft_allotments, null, 2));
}

run();
