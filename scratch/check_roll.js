import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

console.log("Connecting to:", supabaseUrl);

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing supabase env vars");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase
    .from('weaving_orders')
    .select('*');

  if (error) {
    console.error("DB Error:", error);
    return;
  }

  console.log("Total Weaving Orders:", data.length);
  for (const wo of data) {
    const rolls = wo.fabric_rolls || [];
    const match = rolls.find(r => r.id.toLowerCase().includes('001/03'));
    if (match) {
      console.log(`WO: ${wo.weaving_number}`);
      console.log("Matching Roll:", JSON.stringify(match, null, 2));
    }
  }
}

check();
