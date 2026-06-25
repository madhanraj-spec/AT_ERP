import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function main() {
  await supabase.auth.signInWithPassword({
    email: 'tharun@at.com',
    password: 'admin123'
  });

  const { data: order } = await supabase
    .from('orders')
    .select('id')
    .eq('order_number', 'AT/2026/B/00001')
    .single();

  const { data: receipts } = await supabase
    .from('dyed_yarn_receipt_items')
    .select('*, location:master_locations(location_name)')
    .eq('order_id', order.id);

  console.log("=== RAW RECEIPT ITEMS ===");
  console.log(JSON.stringify(receipts, null, 2));
}

main().catch(console.error);
