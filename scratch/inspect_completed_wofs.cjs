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
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectWofs() {
  const { data: allWofs, error: wofErr } = await supabase
    .from('warping_order_forms')
    .select(`*`);

  if (wofErr) {
    console.error('WOF error:', wofErr);
    return;
  }

  console.log(`Found ${allWofs.length} total WOFs in database`);

  const statusCount = {};
  const typeCount = {};
  allWofs.forEach(w => {
    statusCount[w.status] = (statusCount[w.status] || 0) + 1;
    typeCount[w.wof_type] = (typeCount[w.wof_type] || 0) + 1;
  });

  console.log('Statuses count:', statusCount);
  console.log('Types count:', typeCount);

  if (allWofs.length > 0) {
    console.log('Sample WOFs:');
    allWofs.slice(0, 5).forEach(w => {
      console.log(`- WOF#: ${w.wof_number}, Type: ${w.wof_type}, Status: ${w.status}, Partner Name: ${w.partner_name}`);
    });
  }
}

inspectWofs();
