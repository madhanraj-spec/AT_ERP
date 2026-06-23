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

async function checkColumn(colName) {
  const { data, error } = await supabase
    .from('weaving_orders')
    .select(colName)
    .limit(1);

  if (error) {
    console.log(`Column '${colName}' does NOT exist or error:`, error.message);
    return false;
  } else {
    console.log(`Column '${colName}' exists!`);
    return true;
  }
}

async function run() {
  await checkColumn('completed_qty');
  await checkColumn('actual_qty');
  await checkColumn('balance_qty');
  await checkColumn('yarn_returns');
  await checkColumn('wvofdc_number');
}

run();
