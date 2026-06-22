const { createClient } = require('@supabase/supabase-client');

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://kbobayuhqigjpxxsnexn.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.error('Missing VITE_SUPABASE_ANON_KEY env variable.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  try {
    const { data, error } = await supabase
      .from('dyed_yarn_receipt_items')
      .select('*, location:master_locations(location_name)')
      .ilike('colour', 'beige');

    if (error) throw error;

    console.log('Beige Receipt Items:');
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(err);
  }
}

check();
