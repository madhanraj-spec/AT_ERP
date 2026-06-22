const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://fxoxaovxilwhzlefautn.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.error('Missing VITE_SUPABASE_ANON_KEY env variable.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const tables = [
  'dyed_yarn_receipts',
  'dyed_yarn_receipt_items',
  'dyed_yarn_deliveries',
  'dyed_yarn_delivery_items',
  'greige_yarn_delivery_receipts',
  'greige_yarn_delivery_items',
  'weaving_orders',
  'warping_order_forms',
  'sizing_order_forms',
  'orders'
];

async function count() {
  for (const t of tables) {
    try {
      const { count, error } = await supabase
        .from(t)
        .select('*', { count: 'exact', head: true });
      if (error) throw error;
      console.log(`${t}: ${count} rows`);
    } catch (err) {
      console.error(`Error counting ${t}:`, err.message);
    }
  }
}

count();
