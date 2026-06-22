const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://fxoxaovxilwhzlefautn.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.error('Missing VITE_SUPABASE_ANON_KEY env variable.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  try {
    console.log("Signing in...");
    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
      email: 'tharun@at.com',
      password: 'admin123'
    });

    if (authErr) {
      console.error("Auth error:", authErr.message);
      return;
    }
    console.log("Signed in successfully.");

    const { data, error } = await supabase
      .from('weaving_orders')
      .select(`
        *,
        order:orders(*)
      `)
      .limit(5);

    if (error) throw error;

    console.log('Weaving Orders and linked Orders data:');
    data?.forEach(w => {
      console.log(`Weaving Number: ${w.weaving_number}`);
      console.log(`Order Number: ${w.order?.order_number}`);
      console.log(`Order Total Qty: ${w.order?.total_quantity}`);
      console.log(`Order Technical Specs:`, JSON.stringify(w.order?.technical_specs, null, 2));
      console.log('-------------------------------------------');
    });
  } catch (err) {
    console.error(err);
  }
}

check();
