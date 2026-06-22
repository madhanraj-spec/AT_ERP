import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Read .env file manually
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

async function check() {
  console.log("Signing in...");
  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: 'tharun@at.com',
    password: 'admin123'
  });
  if (authErr) {
    console.error("Auth error:", authErr.message);
    return;
  }
  console.log("Signed in successfully.");

  // Fetch orders
  const { data: orders, error: ordersErr } = await supabase
    .from('orders')
    .select('id, order_number');
  if (ordersErr) {
    console.error("Orders fetch err:", ordersErr);
    return;
  }

  // Fetch weaving orders
  const { data: weavingOrders, error: wvErr } = await supabase
    .from('weaving_orders')
    .select('id, weaving_number, order_id, status, start_date, end_date, process_started_at, process_completed_at, updated_at, weft_allotments, fabric_rolls');
  if (wvErr) {
    console.error("Weaving fetch err:", wvErr);
    return;
  }

  console.log(`Loaded ${orders.length} orders and ${weavingOrders.length} weaving orders.`);

  orders.forEach(order => {
    const orderWvofs = weavingOrders.filter(wv => wv.order_id === order.id);
    
    // Simulate totalGreigeInputQty calculation
    let sum = 0;
    orderWvofs.forEach(wv => {
      const rolls = Array.isArray(wv.fabric_rolls) ? wv.fabric_rolls : [];
      const greigeRolls = rolls.filter(r => r.status === 'greige received' || r.status === '4_point_inspected');
      sum += greigeRolls.reduce((acc, r) => acc + parseFloat(r.qty || 0), 0);
    });

    console.log(`Order: ${order.order_number} (ID: ${order.id})`);
    console.log(`- Matched weaving order forms: ${orderWvofs.map(w => w.weaving_number).join(', ') || 'None'}`);
    console.log(`- Simulated Greige Input Qty: ${sum}`);
    
    orderWvofs.forEach(wv => {
      const rolls = Array.isArray(wv.fabric_rolls) ? wv.fabric_rolls : [];
      console.log(`  Weaving Order ${wv.weaving_number} rolls:`);
      rolls.forEach(r => {
        console.log(`    Roll ID: ${r.id}, Qty: ${r.qty}, Status: ${r.status}`);
      });
    });
  });
}

check();
