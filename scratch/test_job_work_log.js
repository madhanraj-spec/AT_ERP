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

async function checkLogInsertion() {
  // Login
  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: 'tharun@at.com',
    password: 'admin123'
  });
  if (authErr) {
    console.error("Auth error:", authErr.message);
    return;
  }
  console.log("Logged in successfully.");

  const jobWorkOrderId = '04a2f8df-ccd4-4640-a965-f04f36455c29';
  
  // Fetch original logs
  const { data: wo, error: fetchError } = await supabase
    .from('weaving_orders')
    .select('production_logs')
    .eq('id', jobWorkOrderId)
    .single();

  if (fetchError) {
    console.error("Error fetching order:", fetchError);
    return;
  }

  console.log("Current logs:", wo.production_logs);

  // Append a log entry
  const newLog = {
    id: 'test-log-' + Date.now(),
    timestamp: new Date().toISOString(),
    weaver: 'Job Work',
    qty: 75
  };

  const updatedLogs = [...(wo.production_logs || []), newLog];

  console.log("Updating order production_logs with:", newLog);

  const { data: updatedWo, error: updateError } = await supabase
    .from('weaving_orders')
    .update({ production_logs: updatedLogs })
    .eq('id', jobWorkOrderId)
    .select();

  if (updateError) {
    console.error("Error updating logs:", updateError);
  } else {
    console.log("Successfully updated logs. New records count:", updatedWo[0].production_logs.length);
    console.log("New logs list:", updatedWo[0].production_logs);
  }
}

checkLogInsertion();
