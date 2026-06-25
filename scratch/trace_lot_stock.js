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

  const { data: deliveries } = await supabase
    .from('dyed_yarn_delivery_items')
    .select('*, location:master_locations(location_name)')
    .eq('order_id', order.id);

  console.log("=== RAW DELIVERY ITEMS ===");
  console.log(JSON.stringify(deliveries, null, 2));
}

main().catch(console.error);
