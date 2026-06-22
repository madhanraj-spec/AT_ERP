import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load .env
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in environment');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('Searching for orders...');
  const { data: orders, error: orderError } = await supabase
    .from('orders')
    .select('*')
    .or('order_number.eq.AT/2026/S/00001,order_number.eq.AT/2025/S/00001');
  
  if (orderError) {
    console.error('Error fetching order:', orderError);
    return;
  }

  if (!orders || orders.length === 0) {
    console.log('No orders found for AT/2026/S/00001 or AT/2025/S/00001');
    const { data: recentOrders } = await supabase.from('orders').select('*').limit(5);
    console.log('Recent orders in DB:', recentOrders);
    return;
  }

  for (const order of orders) {
    console.log(`\n===================================`);
    console.log(`ORDER ID: ${order.id} | Order Number: ${order.order_number}`);
    console.log(`Yarn Requirements:`, JSON.stringify(order.yarn_requirements, null, 2));

    // Greige yarn deliveries (Sent to Dyeing)
    const { data: gydi } = await supabase
      .from('greige_yarn_delivery_items')
      .select('*, receipt:greige_yarn_delivery_receipts(*)')
      .eq('order_id', order.id);
    
    console.log(`\n--- Greige Yarn Delivery Items (Sent to Dyeing) ---`);
    gydi?.forEach(item => {
      console.log(`ID: ${item.id} | CountID: ${item.yarn_count_id} | Colour: ${item.colour} | Type: ${item.yarn_type} | Qty: ${item.quantity_kg} | Receipt: ${item.receipt?.gydr_number}`);
    });

    // Greige returns
    const { data: gr } = await supabase
      .from('greige_yarn_receipts')
      .select('*')
      .eq('receipt_type', 'production')
      .eq('order_id', order.id);
    console.log(`\n--- Greige Returns ---`);
    gr?.forEach(item => {
      console.log(`ID: ${item.id} | CountID: ${item.yarn_count_id} | Colour: ${item.colour} | Type: ${item.yarn_type} | Qty: ${item.total_weight}`);
    });

    // Dyed Receipts (Received from Dyeing / Returns)
    const { data: dyri } = await supabase
      .from('dyed_yarn_receipt_items')
      .select('*, receipt:dyed_yarn_receipts(*)')
      .eq('order_id', order.id);

    console.log(`\n--- Dyed Yarn Receipt Items (Rec from Dyeing / Returns) ---`);
    dyri?.forEach(item => {
      console.log(`ID: ${item.id} | CountID: ${item.yarn_count_id} | Colour: ${item.colour} | Type: ${item.yarn_type} | Qty: ${item.quantity_kg} | Source: ${item.receipt?.source_type} | Receipt: ${item.receipt?.dyrr_number}`);
    });

    // Dyed Deliveries (Sent to Warp/Weaving)
    const { data: dydi } = await supabase
      .from('dyed_yarn_delivery_items')
      .select('*, delivery:dyed_yarn_deliveries(*)')
      .eq('order_id', order.id);

    console.log(`\n--- Dyed Yarn Delivery Items (Sent to Warp / Weaving) ---`);
    dydi?.forEach(item => {
      console.log(`ID: ${item.id} | CountID: ${item.yarn_count_id} | Colour: ${item.colour} | Type: ${item.yarn_type} | Qty: ${item.quantity_kg} | Process: ${item.process_type} | Delivery: ${item.delivery?.dydr_number}`);
    });
  }
}

main().catch(console.error);
