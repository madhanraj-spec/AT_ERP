import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: 'tharun@at.com',
    password: 'admin123'
  });

  if (authErr) {
    console.error('Auth error:', authErr);
    return;
  }

  const { data: deliveries, error: dErr } = await supabase
    .from('dyed_yarn_deliveries')
    .select('*')
    .order('created_at', { ascending: false });

  if (dErr) {
    console.error('Error fetching deliveries:', dErr);
    return;
  }

  console.log('DELIVERIES:');
  console.log(JSON.stringify(deliveries, null, 2));

  const { data: items, error: iErr } = await supabase
    .from('dyed_yarn_delivery_items')
    .select('*, yarn_count:master_yarn_counts(count_value, material)')
    .order('created_at', { ascending: false });

  if (iErr) {
    console.error('Error fetching items:', iErr);
    return;
  }

  console.log('\nITEMS:');
  console.log(JSON.stringify(items, null, 2));
}

inspect();
