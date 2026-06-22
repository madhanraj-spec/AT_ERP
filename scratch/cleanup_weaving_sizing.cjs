const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

let supabaseUrl, supabaseKey;
try {
  const envContent = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
  const lines = envContent.split('\n');
  lines.forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) value = value.substring(1, value.length - 1);
      else if (value.startsWith("'") && value.endsWith("'")) value = value.substring(1, value.length - 1);
      if (key === 'VITE_SUPABASE_URL') supabaseUrl = value;
      if (key === 'VITE_SUPABASE_ANON_KEY') supabaseKey = value;
    }
  });
} catch (e) {
  console.error('Failed to read .env file', e);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanup() {
  console.log('Signing in...');
  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: 'tharun@at.com',
    password: 'admin123'
  });

  if (authErr) {
    console.error('Auth error:', authErr);
    return;
  }
  console.log('Signed in successfully.');

  console.log('1. Checking sizing order forms forwarded to weaving...');
  const { data: sofs, error: fetchErr } = await supabase
    .from('sizing_order_forms')
    .select('id, sof_number')
    .eq('forwarded_to', 'weaving');

  if (fetchErr) {
    console.error('Error fetching sizing order forms:', fetchErr);
    return;
  }

  console.log(`Found ${sofs.length} sizing forms to reset:`, sofs.map(s => s.sof_number));

  if (sofs.length > 0) {
    const sofIds = sofs.map(s => s.id);
    const { error: updateSizingErr } = await supabase
      .from('sizing_order_forms')
      .update({
        forwarded_to: null,
        weaving_type: null,
        weaving_machine_id: null,
        weaving_machine_name: null,
        weaving_partner_id: null,
        weaving_partner_name: null,
        weaving_start_date: null,
        weaving_end_date: null,
        weaving_splits_count: 0,
        weaving_splits: [],
        updated_at: new Date().toISOString()
      })
      .in('id', sofIds);

    if (updateSizingErr) {
      console.error('Error resetting sizing forms:', updateSizingErr);
      return;
    }
    console.log('Successfully reset sizing forms.');
  }

  console.log('Cleanup completed successfully!');
}

cleanup();
