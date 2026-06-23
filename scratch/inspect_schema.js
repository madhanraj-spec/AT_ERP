import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const { data, error } = await supabase
    .from('weaving_orders')
    .select()
    .limit(1);

  if (error) {
    console.error('Error fetching table:', error);
  } else {
    // If we can get table columns by checking table structure or using RPC if any exists
    console.log('Success connecting to weaving_orders, data:', data);
  }

  // Let's also check if we can call a query on information_schema.columns
  const { data: cols, error: colsErr } = await supabase
    .from('columns')
    .select('*')
    .eq('table_name', 'weaving_orders');
    
  if (colsErr) {
    console.log('Cannot query columns table directly:', colsErr.message);
  } else {
    console.log('Columns metadata:', cols);
  }
}

run();
