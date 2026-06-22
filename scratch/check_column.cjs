const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manually parse .env file
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      // Remove surrounding quotes if any
      if (value.length > 0 && value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
        value = value.substring(1, value.length - 1);
      }
      process.env[key] = value;
    }
  });
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://fxoxaovxilwhzlefautn.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.error('Missing VITE_SUPABASE_ANON_KEY env variable.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  try {
    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
      email: 'tharun@at.com',
      password: 'admin123'
    });

    if (authErr) {
      console.error("Auth error:", authErr.message);
      return;
    }

    const { data, error } = await supabase
      .from('weaving_orders')
      .select('id, planned_daily_production')
      .limit(1);

    if (error) {
      console.error("Column check failed:", error.message);
      console.log("Status: Column does NOT exist.");
    } else {
      console.log("Column check succeeded! Column EXISTS.");
      console.log("Data sample:", data);
    }
  } catch (err) {
    console.error(err);
  }
}

check();
