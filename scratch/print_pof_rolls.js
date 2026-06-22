import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function printRolls() {
  await supabase.auth.signInWithPassword({
    email: 'tharun@at.com',
    password: 'admin123'
  });

  const { data: pofs } = await supabase
    .from('processing_orders')
    .select('*')
    .eq('pof_number', 'AT/2026/POF/00001');

  if (pofs && pofs.length > 0) {
    console.log('POF 00001 received_rolls:');
    console.log(JSON.stringify(pofs[0].received_rolls, null, 2));
  } else {
    console.log('POF not found');
  }
}

printRolls();
