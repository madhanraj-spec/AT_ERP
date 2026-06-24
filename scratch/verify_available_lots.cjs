const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load env
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspect() {
  // Sign in
  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: 'tharun@at.com',
    password: 'admin123'
  });

  if (authErr) {
    console.error("Auth error:", authErr);
    return;
  }

  // Find order
  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_number, yarn_requirements')
    .eq('order_number', 'AT/2026/B/00001');
  
  const order = orders[0];

  // Dyed Yarn Receipts (from dyeing)
  const { data: dyri } = await supabase
    .from('dyed_yarn_receipt_items')
    .select('*, receipt:dyed_yarn_receipts(*), location:master_locations(location_name)')
    .eq('order_id', order.id);

  // Dyed Yarn Deliveries (to warping/weaving)
  const { data: dydi } = await supabase
    .from('dyed_yarn_delivery_items')
    .select('*, delivery:dyed_yarn_deliveries(*), location:master_locations(location_name)')
    .eq('order_id', order.id);

  // RUN getAvailableLots logic (without yarn_returns subtraction)
  const groups = {};

  dyri.forEach(item => {
    const countId = item.yarn_count_id;
    const colour = item.colour || '—';
    const lot = item.lot_number || '—';
    const loc = item.location?.location_name || '—';
    const key = `${countId}||${colour}||${lot}||${loc}`;
    if (!groups[key]) {
      groups[key] = { countId, colour, lotNumber: lot, locationName: loc, received: 0, delivered: 0 };
    }
    groups[key].received += parseFloat(item.quantity_kg || 0);
  });

  dydi.forEach(item => {
    const countId = item.yarn_count_id;
    const colour = item.colour || '—';
    const lot = item.lot_number || '—';
    let loc = item.location?.location_name || '—';

    if (loc === '—' && lot !== '—') {
      const matchingReceipt = dyri.find(r => r.yarn_count_id === countId && r.colour === colour && (r.lot_number || '—') === lot);
      if (matchingReceipt && matchingReceipt.location?.location_name) {
        loc = matchingReceipt.location.location_name;
      }
    }

    const key = `${countId}||${colour}||${lot}||${loc}`;
    if (!groups[key]) {
      groups[key] = { countId, colour, lotNumber: lot, locationName: loc, received: 0, delivered: 0 };
    }
    groups[key].delivered += parseFloat(item.quantity_kg || 0);
  });

  const availableLots = Object.values(groups)
    .map(g => ({
      ...g,
      balance: g.received - g.delivered
    }))
    .filter(g => g.balance > 0.001);

  console.log("Calculated Available Lots:");
  console.dir(availableLots, { depth: null });
}

inspect();
