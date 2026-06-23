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

  // Get weaving order
  const { data: doc, error: docErr } = await supabase
    .from('weaving_orders')
    .select(`
      *,
      order:orders(id, order_number, design_no, design_name, yarn_requirements)
    `)
    .eq('weaving_number', 'AT/2026/WVOF/JB/ANITHA/00001')
    .single();

  if (docErr) {
    console.error("Error finding weaving order:", docErr);
    return;
  }
  console.log("Found weaving order:", doc.weaving_number, "order_id:", doc.order_id);
  console.log("weft_allotments:", JSON.stringify(doc.weft_allotments, null, 2));

  // Query 1: dyed_yarn_receipt_items
  console.log("Executing query 1: dyed_yarn_receipt_items...");
  const { data: receipts, error: recErr } = await supabase
    .from('dyed_yarn_receipt_items')
    .select(`
      *,
      receipt:dyed_yarn_receipts(dof_id, dof_number),
      location:master_locations(location_name)
    `)
    .eq('order_id', doc.order_id);

  if (recErr) {
    console.error("receipts query error:", recErr);
  } else {
    console.log("receipts count:", receipts?.length);
    console.log("receipts:", JSON.stringify(receipts, null, 2));
  }

  // Query 2: dyed_yarn_delivery_items
  console.log("Executing query 2: dyed_yarn_delivery_items...");
  const { data: deliveries, error: delErr } = await supabase
    .from('dyed_yarn_delivery_items')
    .select(`
      *,
      source_receipt:dyed_yarn_receipts(dof_id)
    `)
    .eq('order_id', doc.order_id);

  if (delErr) {
    console.error("deliveries query error:", delErr);
  } else {
    console.log("deliveries count:", deliveries?.length);
  }

  // Build stockMap exactly like DeliverYarn.jsx does
  const stockMap = {};
  receipts?.forEach(r => {
    const key = `${r.yarn_count_id}-${r.colour}-${r.lot_number || ''}-${r.location_id || ''}-${r.receipt?.dof_id || ''}`;
    if (!stockMap[key]) {
      stockMap[key] = {
        yarn_count_id: r.yarn_count_id,
        colour: r.colour,
        lot_number: r.lot_number || '—',
        location_id: r.location_id,
        location_name: r.location?.location_name || '—',
        dof_id: r.receipt?.dof_id || null,
        dof_number: r.receipt?.dof_number || '—',
        receipt_id: r.receipt_id,
        available: 0
      };
    }
    stockMap[key].available += parseFloat(r.quantity_kg || 0);
  });

  deliveries?.forEach(d => {
    const dofId = d.source_receipt?.dof_id || '';
    const key = `${d.yarn_count_id}-${d.colour}-${d.lot_number || ''}-${d.location_id || ''}-${dofId}`;
    if (stockMap[key]) {
      stockMap[key].available -= parseFloat(d.quantity_kg || 0);
    } else {
      const fallbackKey = Object.keys(stockMap).find(k => k.startsWith(`${d.yarn_count_id}-${d.colour}-${d.lot_number || ''}-${d.location_id || ''}-`));
      if (fallbackKey) {
        stockMap[fallbackKey].available -= parseFloat(d.quantity_kg || 0);
      }
    }
  });

  console.log("STOCK MAP:");
  console.log(JSON.stringify(stockMap, null, 2));

  // Now, try matching for Weaving Order requirements
  const requirements = doc.weft_allotments || [];
  requirements.forEach((req, idx) => {
    const countId = req.yarn_count_id || req.countId || req.count_id;
    const colour = req.colour;
    const lotNum = req.lot_number;
    const locId = req.location_id;

    const matchingStocks = Object.values(stockMap).filter(s => 
      s.yarn_count_id === countId && 
      s.colour === colour &&
      (s.lot_number === lotNum || (!s.lot_number && !lotNum) || (s.lot_number === '—' && !lotNum) || (lotNum === '—' && !s.lot_number)) &&
      s.location_id === locId
    );

    console.log(`Requirement ${idx} (${colour}, count: ${countId}, lot: ${lotNum}, loc: ${locId}):`);
    console.log("Matching Stocks:", JSON.stringify(matchingStocks, null, 2));
  });
}

inspectQuery();
