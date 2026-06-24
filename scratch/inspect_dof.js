import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: 'tharun@at.com',
    password: 'admin123'
  });

  if (authErr) {
    console.error('Auth error:', authErr);
    return;
  }

  const dofId = "5a70758b-0b3d-410e-8814-32811d908834";

  // Fetch receipts for the DOF
  const { data: receipts } = await supabase
    .from('dyed_yarn_receipts')
    .select('id, dyrr_number')
    .eq('dof_id', dofId);

  const dyrrIds = receipts?.map(r => r.id) || [];
  console.log('Receipt IDs:', dyrrIds);

  if (dyrrIds.length > 0) {
    const { data: recItems } = await supabase
      .from('dyed_yarn_receipt_items')
      .select('order_id, yarn_count_id, colour, quantity_kg, yarn_type');
    
    console.log('RECEIPT ITEMS:');
    console.log(recItems);
  }

  const { data: redyeItems } = await supabase
    .from('dyed_yarn_delivery_items')
    .select('order_id, yarn_count_id, colour, quantity_kg, yarn_type, delivery:dyed_yarn_deliveries!inner(dof_id, delivery_type)')
    .eq('delivery.dof_id', dofId)
    .eq('delivery.delivery_type', 'redyeing');

  console.log('REDYEING ITEMS:');
  console.log(redyeItems);
}

inspect();
