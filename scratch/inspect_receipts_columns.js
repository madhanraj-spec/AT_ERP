import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function check() {
  console.log("Signing in...");
  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: 'tharun@at.com',
    password: 'admin123'
  });

  if (authErr) {
    console.error("Auth error:", authErr.message);
    return;
  }
  console.log("Signed in.");

  const { data, error } = await supabase
    .from('greige_yarn_receipts')
    .select('*')
    .limit(1);

  if (error) {
    console.error("Error fetching receipts:", error.message);
  } else {
    console.log("Columns of greige_yarn_receipts:", data.length > 0 ? Object.keys(data[0]) : "No rows found in table");
    
    // Also check if we can insert a column or if it's there
    console.log("Full data row (if any):", data);
  }
}

check();
