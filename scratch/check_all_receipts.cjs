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
      .from('dyed_yarn_receipt_items')
      .select('*, location:master_locations(location_name)')
      .order('created_at', { ascending: false })
      .limit(15);

    if (error) throw error;

    console.log('Recent Receipt Items:');
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(err);
  }
}

check();
