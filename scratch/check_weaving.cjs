const fs = require('fs');
const dotenv = require('dotenv');

if (fs.existsSync('.env')) {
  const envConfig = dotenv.parse(fs.readFileSync('.env'));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
}

const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

(async () => {
  // Try to query with ilike to see what we get back
  const prefix = 'AT/2026/WVOF/';
  const { data: inHouseData, error: inErr } = await supabase
    .from('weaving_orders')
    .select('weaving_number')
    .eq('weaving_type', 'in_house')
    .ilike('weaving_number', `${prefix}%`);

  console.log('=== In-house WVOF query ===');
  console.log('Error:', inErr?.message || 'none');
  console.log('Data count:', inHouseData?.length || 0);
  if (inHouseData) inHouseData.forEach(r => console.log(' ', r.weaving_number));

  // Try without filters
  const { data: allData, error: allErr } = await supabase
    .from('weaving_orders')
    .select('weaving_number, weaving_type, status');

  console.log('\n=== All weaving_orders (no filter) ===');
  console.log('Error:', allErr?.message || 'none');
  console.log('Data count:', allData?.length || 0);
  if (allData) allData.forEach(r => console.log(`  "${r.weaving_number}"  type=${r.weaving_type}  status=${r.status}`));

  // Try insert with a test number then delete it
  console.log('\n=== Testing insert/select visibility ===');
  const testNum = 'AT/2026/WVOF/TEST99999';
  const { data: insData, error: insErr } = await supabase
    .from('weaving_orders')
    .insert({ weaving_number: testNum, weaving_type: 'in_house', status: 'pending', qty: 0 })
    .select();
  
  console.log('Insert error:', insErr?.message || 'none');
  console.log('Insert returned:', insData?.length || 0, 'rows');

  // Now try to select it back
  const { data: selData, error: selErr } = await supabase
    .from('weaving_orders')
    .select('weaving_number')
    .eq('weaving_number', testNum);
  
  console.log('Select back error:', selErr?.message || 'none');
  console.log('Select returned:', selData?.length || 0, 'rows');

  // Clean up test row
  if (selData && selData.length > 0) {
    await supabase.from('weaving_orders').delete().eq('weaving_number', testNum);
    console.log('Cleaned up test row');
  }
})();
