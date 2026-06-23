const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function testColumns() {
  const possibleColumns = ['original_qty', 'original_quantity', 'qty', 'quantity', 'sizing_qty', 'sizing_quantity', 'parent_qty'];
  for (const col of possibleColumns) {
    const { error } = await supabase
      .from('sizing_order_forms')
      .select(col)
      .limit(1);
    if (error) {
      console.log(`Column '${col}': failed - ${error.message}`);
    } else {
      console.log(`Column '${col}': VALID!`);
    }
  }
}

testColumns();
