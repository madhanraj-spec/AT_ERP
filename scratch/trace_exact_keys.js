import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function main() {
  await supabase.auth.signInWithPassword({
    email: 'tharun@at.com',
    password: 'admin123'
  });

  const { data: order } = await supabase
    .from('orders')
    .select('id')
    .eq('order_number', 'AT/2026/B/00001')
    .single();

  const { data: dyri } = await supabase
    .from('dyed_yarn_receipt_items')
    .select('*, receipt:dyed_yarn_receipts(*), location:master_locations(location_name)')
    .eq('order_id', order.id);

  const { data: dydi } = await supabase
    .from('dyed_yarn_delivery_items')
    .select('*, delivery:dyed_yarn_deliveries(*), location:master_locations(location_name)')
    .eq('order_id', order.id);

  console.log("=== Matching Keys Test ===");

  const receiptKeys = new Set();
  dyri.forEach(item => {
    const isExcess = item.is_excess || item.receipt?.source_type === 'production';
    if (isExcess) return;

    const countId = item.yarn_count_id;
    const colour = item.colour || '—';
    const lot = item.lot_number || '—';
    const loc = item.location?.location_name || '—';
    const type = item.yarn_type || 'warp';

    const key = `${countId}||${colour}||${lot}||${loc}||${type}`;
    receiptKeys.add(key);
    console.log(`Receipt Key: ${key} (lot_number type: ${typeof item.lot_number})`);
  });

  console.log("\n=== Checking Deliveries ===");
  dydi.forEach(item => {
    const isRedyeing = item.process_type === 'redyeing' || item.delivery?.delivery_type === 'redyeing';
    const countId = item.yarn_count_id;
    const colour = item.colour || '—';
    const lot = item.lot_number || '—';
    let loc = item.location?.location_name || '—';
    const type = item.yarn_type || (item.process_type === 'warping' ? 'warp' : 'weft');

    if (loc === '—' && lot !== '—') {
      const matchingReceipt = dyri.find(r => r.yarn_count_id === countId && r.colour === colour && String(r.lot_number || '—') === String(lot));
      if (matchingReceipt && matchingReceipt.location?.location_name) {
        loc = matchingReceipt.location.location_name;
      }
    }

    const key = `${countId}||${colour}||${lot}||${loc}||${type}`;
    const matches = receiptKeys.has(key);
    console.log(`Delivery Key: ${key} (isRedyeing: ${isRedyeing}, lot type: ${typeof item.lot_number}) -> Matches Receipt: ${matches}`);
  });
}

main().catch(console.error);
