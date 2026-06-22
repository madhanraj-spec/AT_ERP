import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function printSentRolls() {
  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: 'tharun@at.com',
    password: 'admin123'
  });
  if (authErr) {
    console.error("Auth error:", authErr.message);
    return;
  }

  const { data: pofs } = await supabase
    .from('processing_orders')
    .select('*')
    .eq('pof_number', 'AT/2026/POF/00003');

  if (pofs && pofs.length > 0) {
    console.log('POF 00003 fabric_rolls (Sent):');
    console.log(JSON.stringify(pofs[0].fabric_rolls, null, 2));
  } else {
    console.log('POF not found');
  }
}

printSentRolls();
