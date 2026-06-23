const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: 'tharun@at.com',
    password: 'admin123'
  });

  if (authErr) {
    console.error("Auth error:", authErr);
    return;
  }
  console.log("Signed in successfully.");

  // 1. Fetch yarn counts
  const { data: yarnCounts, error: ycErr } = await supabase.from('master_yarn_counts').select('*');
  if (ycErr) throw ycErr;

  // 2. Find order
  const { data: selectedOrder, error: orderErr } = await supabase
    .from('orders')
    .select('*')
    .eq('order_number', 'AT/2026/B/00002')
    .single();

  if (orderErr) throw orderErr;
  console.log("Loaded Order:", selectedOrder.order_number);

  // 3. Load WOFs
  const { data: existingWofs, error: wofErr } = await supabase
    .from('warping_order_forms')
    .select('*, machine:master_machines(machine_name), partner:master_partners(partner_name)')
    .eq('order_id', selectedOrder.id);

  if (wofErr) throw wofErr;
  console.log(`Loaded ${existingWofs.length} existing WOFs.`);

  // 4. Run the mapping logic we implemented
  const warpYarns = (selectedOrder.yarn_requirements || []).filter(y => y.type === 'warp');
  const allotments = warpYarns.map(y => {
    const countId = y.countId || y.count_id || '';
    const colour = y.color || y.colour || '';

    let totalAllotted = 0;
    let totalReturned = 0;

    existingWofs.forEach(w => {
      const match = (w.colour_allotments || []).find(
        a => (a.countId === countId || a.countValue === y.countValue) && a.colour === colour
      );
      const allottedForThisWof = parseFloat(match?.allotted_qty || 0);

      let returnedQty = 0;
      if (w.yarn_returns && w.yarn_returns.length > 0) {
        const yc = yarnCounts.find(c => c.id === countId);
        const returnMatch = w.yarn_returns.find(r => {
          const isCountMatch = (r.yarn_count_id && r.yarn_count_id === countId) ||
            (!r.yarn_count_id && yc && (
              (r.count_display || '').toLowerCase().replace(/\s+/g, '') === `${yc.count_value} ${yc.material} ${yc.product_type}`.toLowerCase().replace(/\s+/g, '') ||
              (r.count_display || '').toLowerCase().replace(/\s+/g, '') === `${yc.count_value} ${yc.material}`.toLowerCase().replace(/\s+/g, '')
            ));
          const isColourMatch = (r.colour || '').toLowerCase() === (colour || '').toLowerCase();
          return isCountMatch && isColourMatch;
        });
        returnedQty = parseFloat(returnMatch?.quantity_returned || 0);
        totalReturned += returnedQty;
      }

      totalAllotted += Math.max(0, allottedForThisWof - returnedQty);
    });

    const remaining = Math.max(0, parseFloat(y.kg || 0) - totalAllotted);

    return {
      colour,
      required_qty: parseFloat(y.kg || 0),
      already_allotted: totalAllotted,
      returned_qty: totalReturned,
      remaining
    };
  });

  console.log("\nComputed Allotments Result:");
  console.log(JSON.stringify(allotments, null, 2));

  // Assertions
  const redWarp = allotments.find(a => a.colour === 'RED');
  if (!redWarp) {
    console.error("FAIL: RED warp requirements not found!");
    process.exit(1);
  }

  console.log("\nAssertion Checks:");
  console.log(`- Required: Expected 55.00, Got: ${redWarp.required_qty}`);
  console.log(`- Already Allotted: Expected 50.00, Got: ${redWarp.already_allotted}`);
  console.log(`- Returned: Expected 100.00, Got: ${redWarp.returned_qty}`);
  console.log(`- Remaining: Expected 5.00, Got: ${redWarp.remaining}`);

  if (redWarp.already_allotted === 50 && redWarp.returned_qty === 100 && redWarp.remaining === 5) {
    console.log("\n✅ ALL ASSERTIONS PASSED!");
  } else {
    console.error("\n❌ ASSERTION FAILED!");
    process.exit(1);
  }
}

main();
