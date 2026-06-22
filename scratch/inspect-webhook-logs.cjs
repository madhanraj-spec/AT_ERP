const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read .env file manually
const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] ? match[2].trim() : '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.substring(1, value.length - 1);
    }
    env[match[1]] = value;
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectLogs() {
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email: 'tharun@at.com',
    password: 'admin123'
  });

  if (signInErr) {
    console.error('Sign in failed:', signInErr.message);
    return;
  }

  // Fetch recent logs
  const { data: logs, error: logsErr } = await supabase
    .from('webhook_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (logsErr) {
    console.error('Error fetching webhook_logs:', logsErr.message);
    return;
  }

  console.log(`Found ${logs.length} webhook logs:`);
  logs.forEach((log, index) => {
    console.log(`\n--- Log #${index + 1} (${log.created_at}) ---`);
    console.log(JSON.stringify(log.payload, null, 2));
  });
}

inspectLogs();
