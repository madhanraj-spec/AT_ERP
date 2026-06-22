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
      if (value.length > 0 && value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
        value = value.substring(1, value.length - 1);
      }
      process.env[key] = value;
    }
  });
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://fxoxaovxilwhzlefautn.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
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
      .select('*')
      .limit(1);

    if (error) throw error;
    console.log("Complete Weaving Order record keys:", Object.keys(data[0] || {}));
    console.log("Complete Weaving Order record:", JSON.stringify(data[0], null, 2));
  } catch (err) {
    console.error(err);
  }
}

inspect();
