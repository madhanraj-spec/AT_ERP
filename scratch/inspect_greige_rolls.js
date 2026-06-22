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

async function checkRolls() {
  console.log("Logging in as tharun@at.com...");
  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: 'tharun@at.com',
    password: 'admin123'
  });
  if (authErr) {
    console.error("Auth error:", authErr.message);
    return;
  }
  console.log("Logged in successfully.");

  const { data: weavingOrders, error } = await supabase
    .from('weaving_orders')
    .select('id, weaving_number, order_id, status, fabric_rolls');

  if (error) {
    console.error("Error fetching weaving orders:", error);
    return;
  }

  weavingOrders.forEach(wo => {
    const rolls = Array.isArray(wo.fabric_rolls) ? wo.fabric_rolls : [];
    if (rolls.length > 0) {
      console.log(`\nWeaving Order: ${wo.weaving_number} (ID: ${wo.id}), Order ID: ${wo.order_id}, Weaving Status: ${wo.status}`);
      console.log(`Total rolls: ${rolls.length}`);
      console.table(rolls.map(r => ({
        id: r.id,
        roll_no: r.roll_no,
        qty: r.qty,
        status: r.status,
        gfrr_no: r.gfrr_no,
        received_at: r.received_at
      })));
    }
  });
}

checkRolls();
