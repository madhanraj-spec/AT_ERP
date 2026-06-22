async function dumpNetRequests() {
  const url = 'https://fxoxaovxilwhzlefautn.supabase.co/functions/v1/receive-whatsapp?action=dump_net_requests';
  
  console.log('Fetching net.http_request records from:', url);
  const response = await fetch(url);
  const data = await response.json();
  
  if (data.error) {
    console.error('Error from server:', data.error);
    return;
  }
  
  const requests = data.requests || [];
  console.log(`Successfully fetched ${requests.length} database HTTP requests:`);
  
  requests.forEach((req, i) => {
    console.log(`\n--- Request #${i + 1} (ID: ${req.id}) ---`);
    console.log(`Created: ${req.created}`);
    console.log(`URL: ${req.url}`);
    console.log(`Method: ${req.method}`);
    console.log(`Headers:`, JSON.stringify(req.headers, null, 2));
    console.log(`Status: ${req.status}`);
    console.log(`Response Body: ${req.response_body}`);
  });
}

dumpNetRequests();
