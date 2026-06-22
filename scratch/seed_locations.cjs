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

async function seed() {
  await supabase.auth.signInWithPassword({
    email: 'tharun@at.com',
    password: 'admin123'
  });

  // Delete test location
  await supabase.from('master_locations').delete().eq('location_name', 'Test');

  // Check if Factory exists
  const { data: factData } = await supabase.from('master_locations').select('*').ilike('location_name', 'Factory');
  if (!factData || factData.length === 0) {
    const { error: err1 } = await supabase.from('master_locations').insert({
      warehouse_type: 'Fabric Warehouse',
      location_name: 'Factory'
    });
    if (err1) console.error("Error inserting Factory:", err1);
    else console.log("Seeded Factory location.");
  } else {
    console.log("Factory location already exists.");
  }

  // Check if Office exists
  const { data: offData } = await supabase.from('master_locations').select('*').ilike('location_name', 'Office');
  if (!offData || offData.length === 0) {
    const { error: err2 } = await supabase.from('master_locations').insert({
      warehouse_type: 'Fabric Warehouse',
      location_name: 'Office'
    });
    if (err2) console.error("Error inserting Office:", err2);
    else console.log("Seeded Office location.");
  } else {
    console.log("Office location already exists.");
  }
}

seed();
