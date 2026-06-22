import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function findRoll() {
  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: 'tharun@at.com',
    password: 'admin123'
  });
  if (authErr) {
    console.error("Auth error:", authErr.message);
    return;
  }

  // Find all weaving orders
  const { data: weavingOrders } = await supabase
    .from('weaving_orders')
    .select('id, weaving_number, order_id, fabric_rolls');

  console.log("Searching in weaving_orders...");
  weavingOrders.forEach(wo => {
    const rolls = wo.fabric_rolls || [];
    rolls.forEach(r => {
      if (r.id && (r.id.includes('P1/00008') || r.id.includes('P1/0000') || r.id.includes('00008') || r.id.includes('P1/'))) {
        console.log(`WO: ${wo.weaving_number}, Roll:`, r);
      }
    });
  });

  // Let's also check all orders to see what orders we have in the database
  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_number, design_no, design_name');
  
  console.log("\nOrders in DB:");
  console.table(orders);
}

findRoll();
