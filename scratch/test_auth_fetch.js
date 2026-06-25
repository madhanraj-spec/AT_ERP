import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const email = 'test_agent_' + Math.random().toString(36).substring(7) + '@atfabrics.com';
  const password = 'Password123!';

  console.log(`Signing up as: ${email}...`);
  const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
    email,
    password
  });

  if (signUpErr) {
    console.error("Sign up error:", signUpErr.message);
    return;
  }

  console.log("Successfully authenticated!");
  const session = signUpData.session;
  console.log("Session User ID:", session?.user?.id);

  // Set the session
  await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token
  });

  console.log("Fetching SOFs...");
  const { data: sofs, error: sofErr } = await supabase
    .from('sizing_order_forms')
    .select('id, sof_number, status, qty, original_qty, forwarded_to');
  
  if (sofErr) {
    console.error("SOFs error:", sofErr.message);
  } else {
    console.log("SOFs count:", sofs?.length);
    console.log("SOFs:", sofs);
  }

  console.log("Fetching Weaving Orders...");
  const { data: wvs, error: wvsErr } = await supabase
    .from('weaving_orders')
    .select('id, weaving_number, qty, status, sof_id, sof_number');
  
  if (wvsErr) {
    console.error("Weaving Orders error:", wvsErr.message);
  } else {
    console.log("Weaving Orders count:", wvs?.length);
    console.log("Weaving Orders:", wvs);
  }
}

run();
