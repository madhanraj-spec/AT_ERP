import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://fxoxaovxilwhzlefautn.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4b3hhb3Z4aWx3aHpsZWZhdXRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MDgyMDYsImV4cCI6MjA5MTI4NDIwNn0.5HvOYyAKg79BR1MaZkX-obpwCT4PJbKVOW0vChAOMLE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRolls() {
  const { data, error } = await supabase
    .from('weaving_orders')
    .select('id, weaving_number, fabric_rolls');

  if (error) {
    console.error('Error fetching weaving orders:', error);
    return;
  }

  console.log('Weaving orders list:');
  data.forEach(order => {
    console.log(`- ${order.weaving_number}: ${order.fabric_rolls?.length || 0} rolls`);
    if (order.fabric_rolls?.length > 0) {
      console.log('  Rolls:', order.fabric_rolls.map(r => `${r.id} (${r.status})`));
    }
  });
}

checkRolls();
