import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  const { data, error } = await supabase
    .from('weaving_orders')
    .select('*');
  
  if (error) {
    console.error('Error fetching weaving orders:', error);
    return;
  }
  
  console.log('Weaving orders length:', data.length);
  for (const row of data) {
    console.log({
      id: row.id,
      weaving_number: row.weaving_number,
      status: row.status,
      start_date: row.start_date,
      end_date: row.end_date,
      process_started_at: row.process_started_at,
      process_completed_at: row.process_completed_at,
      updated_at: row.updated_at
    });
  }
}

check();
