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

async function inspectQuery() {
  // Login first
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

  // Get order ID for AT/2026/S/00001
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select('id')
    .eq('order_number', 'AT/2026/S/00001')
    .single();

  if (orderErr) {
    console.error("Error finding order:", orderErr);
    return;
  }
  console.log("Found order ID:", order.id);

  // Try the query from OrderWeavingTab.jsx
  console.log("Executing query from OrderWeavingTab.jsx...");
  const { data: weavingData, error: wvError } = await supabase
    .from('weaving_orders')
    .select(`
      *,
      order:orders(id, order_number, design_no, design_name, total_quantity, yarn_requirements, technical_specs),
      machine:master_machines(machine_name),
      partner:master_partners(partner_name),
      fabric_rolls(*)
    `)
    .eq('order_id', order.id);

  if (wvError) {
    console.error("wvError returned:", wvError);
  } else {
    console.log("Query succeeded! Found rows count:", weavingData?.length);
    console.log("Rows:", JSON.stringify(weavingData, null, 2));
  }
}

inspectQuery();
