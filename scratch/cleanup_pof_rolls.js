import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase URL or Key not found in environment.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false
  }
});

async function runCleanup() {
  console.log('Logging in as tharun@at.com...');
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'tharun@at.com',
    password: 'admin123'
  });

  if (authErr) {
    console.error('Auth error:', authErr.message);
    process.exit(1);
  }
  console.log('Logged in successfully.');

  console.log('Fetching processing orders...');
  const { data: pofs, error: fetchErr } = await supabase
    .from('processing_orders')
    .select('*');

  if (fetchErr) {
    console.error('Error fetching processing orders:', fetchErr);
    process.exit(1);
  }

  console.log(`Found ${pofs.length} processing orders. Processing...`);

  for (const pof of pofs) {
    const receivedRolls = Array.isArray(pof.received_rolls) ? pof.received_rolls : [];
    let hasCutRolls = false;
    const parentRollsMap = {};

    receivedRolls.forEach(rx => {
      // Regex matches suffix like "/01", "/02", "/03", etc. at the end
      if (rx.id && rx.id.match(/\/\d{2,3}$/)) {
        hasCutRolls = true;
        const parentId = rx.id.replace(/\/\d{2,3}$/, '');
        const parentGreigeId = rx.greige_roll_id ? rx.greige_roll_id.replace(/\/\d{2,3}$/, '') : null;

        if (!parentRollsMap[parentId]) {
          parentRollsMap[parentId] = {
            ...rx,
            id: parentId,
            qty: 0,
            greige_roll_id: parentGreigeId
          };
        }
        parentRollsMap[parentId].qty += parseFloat(rx.qty || 0);
      } else {
        // Keep non-cut rolls as is
        if (!parentRollsMap[rx.id]) {
          parentRollsMap[rx.id] = { ...rx };
        } else {
          // If we somehow have both parent and child, sum them
          parentRollsMap[rx.id].qty += parseFloat(rx.qty || 0);
        }
      }
    });

    if (hasCutRolls) {
      const cleanedReceivedRolls = Object.values(parentRollsMap).map(r => ({
        ...r,
        qty: parseFloat(r.qty.toFixed(2))
      }));

      console.log(`POF ${pof.pof_number} has cut rolls in received_rolls. Reverting...`);
      console.log('Original rolls count:', receivedRolls.length);
      console.log('Cleaned rolls count:', cleanedReceivedRolls.length);

      const { data, error: updateErr } = await supabase
        .from('processing_orders')
        .update({
          received_rolls: cleanedReceivedRolls,
          updated_at: new Date().toISOString()
        })
        .eq('id', pof.id);

      if (updateErr) {
        console.error(`Error updating POF ${pof.pof_number}:`, updateErr);
      } else {
        console.log(`POF ${pof.pof_number} updated successfully!`);
      }
    }
  }

  console.log('Cleanup completed!');
}

runCleanup();
