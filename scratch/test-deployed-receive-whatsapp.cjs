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

async function test() {
  const mockWebhookPayload = {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "1105111506027210",
        changes: [
          {
            value: {
              messaging_product: "whatsapp",
              metadata: {
                display_phone_number: "15556695768",
                phone_number_id: "1105111506027210"
              },
              contacts: [
                {
                  profile: {
                    name: "Madhanraj"
                  },
                  wa_id: "919159109074"
                }
              ],
              messages: [
                {
                  from: "919159109074", // sender
                  id: "wamid.HBgMOTE5MTU5MTA5MDc0FQIAERgSRTFCQUUyNDdFRDUyMENFMzk4AA==",
                  timestamp: "1645480000",
                  type: "interactive",
                  interactive: {
                    type: "button_reply",
                    button_reply: {
                      id: "APPROVE AT/2026/DOF/00009", // button payload
                      title: "Approve"
                    }
                  }
                }
              ]
            },
            field: "messages"
          }
        ]
      }
    ]
  };

  console.log('Invoking receive-whatsapp webhook on server to simulate button click...');
  
  // Call receive-whatsapp function
  const { data, error } = await supabase.functions.invoke('receive-whatsapp', {
    body: mockWebhookPayload
  });

  if (error) {
    console.error('Function execution error:', error.message);
  } else {
    console.log('Success response:', data);
  }
}

test();
