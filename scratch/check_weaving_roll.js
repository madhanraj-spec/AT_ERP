import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkWeavingRolls() {
  await supabase.auth.signInWithPassword({
    email: 'tharun@at.com',
    password: 'admin123'
  });

  const { data: wo } = await supabase
    .from('weaving_orders')
    .select('*')
    .eq('id', '5ce62d19-bcf3-4969-8ac3-becc292dff70')
    .single();

  if (wo) {
    console.log('Weaving Order rolls:');
    console.log(JSON.stringify(wo.fabric_rolls, null, 2));
  } else {
    console.log('Weaving Order not found');
  }
}

checkWeavingRolls();
