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

  const { data: orders, error: orderErr } = await supabase
    .from('weaving_orders')
    .select('*')
    .eq('weaving_number', 'AT/2026/WVOF/S/00001/AWEAINGUNIT/AW1/001');

  if (orderErr) {
    console.error(orderErr);
    return;
  }

  const order = orders[0];
  if (!order) {
    console.log("Order not found!");
    return;
  }
  console.log("Planned Qty in WVOF (qty):", order.qty);
  console.log("Status:", order.status);
  console.log("All rolls in fabric_rolls:");
  order.fabric_rolls.forEach(r => {
    console.log({
      id: r.id,
      roll_no: r.roll_no,
      qty: r.qty,
      actual_qty: r.actual_qty,
      approved_qty: r.approved_qty,
      status: r.status,
      roll_ok: r.roll_ok,
      shortage: r.shortage,
      mistake: r.mistake
    });
  });
}

run();
