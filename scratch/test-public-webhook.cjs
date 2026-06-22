async function testPublicPost() {
  const url = 'https://fxoxaovxilwhzlefautn.supabase.co/functions/v1/receive-whatsapp';
  
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
                  from: "919159109074",
                  id: "wamid.HBgMOTE5MTU5MTA5MDc0FQIAERgSRTFCQUUyNDdFRDUyMENFMzk4AA==",
                  timestamp: "1645480000",
                  type: "interactive",
                  interactive: {
                    type: "button_reply",
                    button_reply: {
                      id: "APPROVE AT/2026/DOF/00009",
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

  console.log('Sending public HTTP POST to', url);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(mockWebhookPayload)
  });

  const text = await response.text();
  console.log('Response Status:', response.status);
  console.log('Response Body:', text);
}

testPublicPost();
