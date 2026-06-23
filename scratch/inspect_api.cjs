const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

async function run() {
  const url = `${process.env.VITE_SUPABASE_URL}/rest/v1/`;
  const headers = {
    'apikey': process.env.VITE_SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${process.env.VITE_SUPABASE_ANON_KEY}`
  };

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: headers
    });
    console.log('Status:', response.status);
    const schema = await response.json();
    const tableDef = schema.definitions.sizing_order_forms;
    if (tableDef) {
      console.log('Columns in sizing_order_forms:');
      const properties = tableDef.properties;
      for (const key of Object.keys(properties)) {
        console.log(`- ${key}: ${properties[key].type} (format: ${properties[key].format || 'none'})`);
      }
    } else {
      console.log('sizing_order_forms definition not found in OpenAPI schema');
    }
  } catch (err) {
    console.error('Error fetching API schema:', err);
  }
}

run();
