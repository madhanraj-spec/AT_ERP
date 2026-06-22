import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load env variables
const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length === 2) {
    env[parts[0].trim()] = parts[1].trim();
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function run() {
  console.log("Signing in...");
  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: 'tharun@at.com',
    password: 'admin123'
  });

  if (authErr) {
    console.error("Auth error:", authErr);
    return;
  }
  console.log("Signed in successfully.");

  // 1. Get Order
  const { data: orders, error: findErr } = await supabase
    .from('orders')
    .select('*')
    .eq('order_number', 'AT/2026/B/00001');

  if (findErr || orders.length === 0) {
    console.error("Error or no order found:", findErr);
    return;
  }
  const order = orders[0];
  console.log(`\n=== ORDER DETAILS ===`);
  console.log(`ID: ${order.id}`);
  console.log(`Order Number: ${order.order_number}`);
  console.log(`Design: ${order.design_name} / ${order.design_no}`);

  // 2. Get Weaving Orders
  const { data: weavingOrders, error: woErr } = await supabase
    .from('weaving_orders')
    .select('*')
    .eq('order_id', order.id);

  if (woErr) {
    console.error("Error fetching weaving orders:", woErr);
  } else {
    console.log(`\n=== WEAVING ORDERS (${weavingOrders.length}) ===`);
    weavingOrders.forEach(wo => {
      console.log(`\nWeaving Order: ${wo.weaving_number}`);
      console.log(`ID: ${wo.id}`);
      console.log(`Status: ${wo.status}`);
      const rolls = Array.isArray(wo.fabric_rolls) ? wo.fabric_rolls : [];
      console.log(`Fabric Rolls count: ${rolls.length}`);
      console.log(JSON.stringify(rolls, null, 2));
    });
  }

  // 3. Get Processing Orders
  const { data: processingOrders, error: poErr } = await supabase
    .from('processing_orders')
    .select('*');

  if (poErr) {
    console.error("Error fetching processing orders:", poErr);
  } else {
    console.log(`\n=== PROCESSING ORDERS (${processingOrders.length}) ===`);
    processingOrders.forEach(po => {
      // Check if any roll in po.fabric_rolls has the order number
      const rolls = Array.isArray(po.fabric_rolls) ? po.fabric_rolls : [];
      const hasOrder = rolls.some(r => r.order_number === order.order_number || r.order_id === order.id);
      if (hasOrder) {
        console.log(`\nPOF Number: ${po.pof_number}`);
        console.log(`ID: ${po.id}`);
        console.log(`Status: ${po.status}`);
        console.log(`Fabric Rolls:`, JSON.stringify(po.fabric_rolls, null, 2));
        console.log(`Received Rolls:`, JSON.stringify(po.received_rolls, null, 2));
      }
    });
  }

  // 4. Get Fabric Movements
  const { data: movements, error: mvErr } = await supabase
    .from('fabric_movements')
    .select('*');

  if (mvErr) {
    console.log("No fabric_movements table or error fetching:", mvErr.message);
  } else {
    console.log(`\n=== FABRIC MOVEMENTS (${movements.length}) ===`);
    const relevantMovements = movements.filter(m => m.order_number === order.order_number || m.order_id === order.id);
    console.log(JSON.stringify(relevantMovements, null, 2));
  }
}

run();
