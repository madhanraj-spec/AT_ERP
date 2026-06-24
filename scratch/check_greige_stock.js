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
  // Sign in
  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: 'tharun@at.com',
    password: 'admin123'
  });
  if (authErr) {
    console.error("Auth error:", authErr);
    return;
  }

  // Get yarn counts
  const { data: counts } = await supabase.from('master_yarn_counts').select('*');
  const count40s = counts.find(c => c.count_value.toString() === '40s');
  console.log("40s count id:", count40s ? count40s.id : "Not found", count40s);

  if (count40s) {
    // Get receipts for 40s
    const { data: receipts } = await supabase
      .from('greige_yarn_receipts')
      .select('*, master_partners(partner_name), master_locations(location_name)')
      .eq('yarn_count_id', count40s.id);
    
    console.log("\n--- RECEIPTS FOR 40s YARN ---");
    receipts.forEach(r => {
      console.log(`ID: ${r.id}, Receipt Type: ${r.receipt_type}, Receipt No: ${r.receipt_no}, Total Weight: ${r.total_weight}, Mill ID: ${r.spinning_mill_id} (${r.master_partners?.partner_name || 'Production Returns'}), Location: ${r.master_locations?.location_name || r.location_id}, Created At: ${r.created_at}`);
    });

    // Get deliveries for 40s
    const { data: deliveries } = await supabase
      .from('greige_yarn_delivery_items')
      .select('*, master_partners(partner_name), master_locations(location_name)')
      .eq('yarn_count_id', count40s.id);

    console.log("\n--- DELIVERIES FOR 40s YARN ---");
    deliveries.forEach(d => {
      console.log(`ID: ${d.id}, Quantity: ${d.quantity_kg}, Mill ID: ${d.spinning_mill_id} (${d.master_partners?.partner_name || 'Production Returns'}), Location: ${d.master_locations?.location_name || d.location_id}`);
    });
  }
}

run();
