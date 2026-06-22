import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function check() {
  console.log("Signing in tharun@at.com...");
  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: 'tharun@at.com',
    password: 'admin123'
  });
  if (authErr) {
    console.error("Auth error:", authErr.message);
    return;
  }
  console.log("Signed in successfully.");

  const orderNumber = 'AT/2026/B/00002';
  console.log(`Checking references for order: ${orderNumber}`);

  // 1. Fetch Order ID
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select('id, order_number')
    .eq('order_number', orderNumber)
    .single();

  if (orderErr || !order) {
    console.error('Order not found or error:', orderErr?.message);
    return;
  }

  const orderId = order.id;
  console.log(`Order ID is: ${orderId}`);

  // 2. Check Dyeing Order Forms (dofs)
  const { data: dofs } = await supabase
    .from('dyeing_order_forms')
    .select('id, dof_number, order_ids');
  const linkedDofs = (dofs || []).filter(dof => {
    return Array.isArray(dof.order_ids) && dof.order_ids.includes(orderId);
  });
  console.log(`Linked Dyeing Order Forms (${linkedDofs.length}):`, linkedDofs.map(d => d.dof_number));

  // 3. Check Warping Order Forms
  const { data: wofs } = await supabase
    .from('warping_order_forms')
    .select('id, wof_number')
    .eq('order_id', orderId);
  console.log(`Linked Warping Order Forms (${wofs?.length || 0}):`, wofs?.map(w => w.wof_number) || []);

  // 4. Check Sizing Order Forms
  const { data: sofs } = await supabase
    .from('sizing_order_forms')
    .select('id, sof_number')
    .eq('order_id', orderId);
  console.log(`Linked Sizing Order Forms (${sofs?.length || 0}):`, sofs?.map(s => s.sof_number) || []);

  // 5. Check Weaving Orders
  const { data: weaving } = await supabase
    .from('weaving_orders')
    .select('id, weaving_number')
    .eq('order_id', orderId);
  console.log(`Linked Weaving Orders (${weaving?.length || 0}):`, weaving?.map(w => w.weaving_number) || []);
}

check();
