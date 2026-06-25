import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

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

  console.log("=== Debugging Available Lots Logic ===");

  const groups = {};

  dyri.forEach(item => {
    const isExcess = item.is_excess || item.receipt?.source_type === 'production';
    if (isExcess) return;

    const countId = item.yarn_count_id;
    const colour = item.colour || '—';
    const lot = item.lot_number || '—';
    const loc = item.location?.location_name || '—';
    const type = item.yarn_type || 'warp';

    const key = `${countId}||${colour}||${lot}||${loc}||${type}`;
    if (!groups[key]) {
      groups[key] = { countId, colour, lotNumber: lot, locationName: loc, type, received: 0, delivered: 0 };
    }
    groups[key].received += parseFloat(item.quantity_kg || 0);
  });

  console.log("\nGroups after dyri receipts processing:");
  Object.keys(groups).forEach(k => {
    console.log(`Key: ${k}, Received: ${groups[k].received}`);
  });

  dydi.forEach(item => {
    const isRedyeing = item.process_type === 'redyeing' || item.delivery?.delivery_type === 'redyeing';
    const countId = item.yarn_count_id;
    const colour = item.colour || '—';
    const lot = item.lot_number || '—';
    let loc = item.location?.location_name || '—';
    const type = item.yarn_type || (item.process_type === 'warping' ? 'warp' : 'weft');

    if (loc === '—' && lot !== '—') {
      const matchingReceipt = dyri.find(r => r.yarn_count_id === countId && r.colour === colour && (r.lot_number || '—') === lot);
      if (matchingReceipt && matchingReceipt.location?.location_name) {
        loc = matchingReceipt.location.location_name;
      }
    }

    const key = `${countId}||${colour}||${lot}||${loc}||${type}`;
    console.log(`Processing Delivery Item: Lot: ${lot}, Qty: ${item.quantity_kg}, Colour: ${colour}, YarnType: ${item.yarn_type}, Process: ${item.process_type}, Resolved Type: ${type}, Resolved Loc: ${loc}, Generated Key: ${key}`);
    
    if (!groups[key]) {
      console.log(`  -> Key not found in groups. Creating dummy group for key: ${key}`);
      groups[key] = { countId, colour, lotNumber: lot, locationName: loc, type, received: 0, delivered: 0 };
    }
    
    if (isRedyeing) {
      const oldRec = groups[key].received;
      groups[key].received = Math.max(0, groups[key].received - parseFloat(item.quantity_kg || 0));
      console.log(`  -> Redyeing: received changed from ${oldRec} to ${groups[key].received}`);
    } else {
      groups[key].delivered += parseFloat(item.quantity_kg || 0);
      console.log(`  -> Non-redyeing: delivered increased to ${groups[key].delivered}`);
    }
  });

  const returnsMap = {};
  dyri.forEach(item => {
    const isExcess = item.is_excess || item.receipt?.source_type === 'production';
    if (!isExcess) return;

    const countId = item.yarn_count_id;
    const colour = item.colour || '—';
    const lot = item.lot_number || '—';
    const loc = item.location?.location_name || '—';
    const type = item.yarn_type || 'warp';

    const key = `${countId}||${colour}||${lot}||${loc}||${type}`;
    returnsMap[key] = (returnsMap[key] || 0) + parseFloat(item.quantity_kg || 0);
  });

  console.log("\nReturns Map:");
  console.log(returnsMap);

  console.log("\nFinal Calculated Available Lots:");
  Object.values(groups).forEach(g => {
    const key = `${g.countId}||${g.colour}||${g.lotNumber}||${g.locationName}||${g.type}`;
    const returnedQty = returnsMap[key] || 0;
    const balance = g.received - g.delivered + returnedQty;
    console.log(`Key: ${key}, Received: ${g.received}, Delivered: ${g.delivered}, Returned: ${returnedQty}, Balance: ${balance}`);
  });
}

main().catch(console.error);
