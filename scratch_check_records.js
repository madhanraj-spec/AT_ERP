import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const { data: dofs } = await supabase.from('dyeing_order_forms').select('id, dof_number');
  console.log('DOFs count:', dofs?.length, dofs);

  const { data: orders } = await supabase.from('orders').select('id, order_number');
  console.log('Orders count:', orders?.length, orders);

  const { data: receipts } = await supabase.from('dyed_yarn_receipt_items').select('id, lot_number, quantity_kg');
  console.log('Receipts count:', receipts?.length, receipts);

  const { data: deliveries } = await supabase.from('dyed_yarn_delivery_items').select('id, lot_number, quantity_kg, process_type');
  console.log('Deliveries count:', deliveries?.length, deliveries);
}
run();
