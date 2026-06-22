import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function printRolls() {
  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: 'tharun@at.com',
    password: 'admin123'
  });
  if (authErr) {
    console.error("Auth error:", authErr.message);
    return;
  }

  // 1. Get POF 00003
  const { data: pofs } = await supabase
    .from('processing_orders')
    .select('*')
    .eq('pof_number', 'AT/2026/POF/00003');

  if (pofs && pofs.length > 0) {
    console.log('POF 00003 received_rolls:');
    console.log(JSON.stringify(pofs[0].received_rolls, null, 2));
    
    // 2. Fetch all weaving orders
    const { data: weavingOrders } = await supabase
      .from('weaving_orders')
      .select('id, weaving_number, order_id, fabric_rolls, order:orders(id, order_number, design_no, design_name)');

    // 3. For each roll in received_rolls, find match in weaving orders
    const rolls = pofs[0].received_rolls || [];
    rolls.forEach(rx => {
      console.log(`\nChecking roll: id=${rx.id}, greige_roll_id=${rx.greige_roll_id}`);
      let foundMatch = false;
      weavingOrders.forEach(wo => {
        const woRolls = wo.fabric_rolls || [];
        const match = woRolls.find(r => 
          (r.id === rx.greige_roll_id) || 
          (r.processed_roll_id && rx.id && r.processed_roll_id.toLowerCase() === rx.id.toLowerCase())
        );
        if (match) {
          foundMatch = true;
          console.log(`  MATCH FOUND in Weaving Order: ${wo.weaving_number}`);
          console.log(`  Parent Roll in WO:`, JSON.stringify(match, null, 2));
          console.log(`  WO Order details:`, JSON.stringify(wo.order, null, 2));
        }
      });
      if (!foundMatch) {
        console.log(`  NO MATCH FOUND in any weaving_orders!`);
      }
    });

  } else {
    console.log('POF AT/2026/POF/00003 not found');
  }
}

printRolls();
