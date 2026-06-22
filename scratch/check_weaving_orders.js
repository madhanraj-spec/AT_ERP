import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Read .env file manually
const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length === 2) {
    env[parts[0].trim()] = parts[1].trim();
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function checkWeaving() {
  // Login first
  console.log("Logging in as tharun@at.com...");
  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: 'tharun@at.com',
    password: 'admin123'
  });
  if (authErr) {
    console.error("Auth error:", authErr.message);
    return;
  }
  console.log("Logged in successfully.");

  // Fetch weaving orders
  console.log("Fetching weaving orders...");
  const { data: weavingOrders, error } = await supabase
    .from('weaving_orders')
    .select('id, weaving_number, weaving_type, status, partner_name, machine_name, production_logs')
    .limit(10);

  if (error) {
    console.error("Error fetching weaving orders:", error);
    return;
  }

  console.log(`Found ${weavingOrders.length} weaving orders:`);
  console.table(weavingOrders);

  // Group by partner name to see if there are any job work orders
  const jobWorkOrders = weavingOrders.filter(w => w.weaving_type === 'job_work');
  console.log(`\nFound ${jobWorkOrders.length} Job Work orders:`);
  console.table(jobWorkOrders);
}

checkWeaving();
