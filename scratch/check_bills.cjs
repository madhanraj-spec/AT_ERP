const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

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

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  await supabase.auth.signInWithPassword({
    email: 'tharun@at.com',
    password: 'admin123'
  });

  const { data, error } = await supabase.from('processing_finance_bills').select('*').limit(1);
  if (error) {
    console.log("processing_finance_bills table does NOT exist or has error:", error.message);
  } else {
    console.log("processing_finance_bills table EXISTS!");
  }
  
  const { data: data2, error: error2 } = await supabase.from('processing_orders').select('*').limit(1);
  if (data2 && data2[0]) {
    console.log("processing_orders columns:", Object.keys(data2[0]));
  }
}

check();
