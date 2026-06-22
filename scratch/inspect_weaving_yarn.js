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

async function inspectWeavingYarn() {
  console.log("Logging in as tharun@at.com...");
  await supabase.auth.signInWithPassword({
    email: 'tharun@at.com',
    password: 'admin123'
  });

  const { data: order } = await supabase
    .from('orders')
    .select('id')
    .eq('order_number', 'AT/2026/S/00003')
    .single();

  console.log("Order ID:", order.id);

  // Fetch weaving orders
  const { data: weavingOrders } = await supabase
    .from('weaving_orders')
    .select('*')
    .eq('order_id', order.id);

  console.log("\nWeaving Orders:");
  console.log(JSON.stringify(weavingOrders, null, 2));

  // Fetch delivery items
  const { data: deliveries } = await supabase
    .from('dyed_yarn_delivery_items')
    .select('*')
    .eq('order_id', order.id);

  console.log("\nDYDR Deliveries for Weaving/Warping:");
  console.log(JSON.stringify(deliveries, null, 2));
}

inspectWeavingYarn();
