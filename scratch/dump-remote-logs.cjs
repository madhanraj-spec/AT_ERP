async function dumpLogs() {
  const url = 'https://fxoxaovxilwhzlefautn.supabase.co/functions/v1/receive-whatsapp?action=dump_logs';
  
  console.log('Fetching logs from:', url);
  const response = await fetch(url);
  const data = await response.json();
  
  if (data.error) {
    console.error('Error returned from server:', data.error);
    return;
  }
  
  console.log(`Successfully fetched ${data.logs ? data.logs.length : 0} logs from remote DB:`);
  
  if (data.logs && data.logs.length > 0) {
    data.logs.forEach((log, i) => {
      console.log(`\n--- Log #${i + 1} (Created: ${log.created_at}) ---`);
      console.log(JSON.stringify(log.payload, null, 2));
    });
  } else {
    console.log('No logs recorded yet.');
  }
}

dumpLogs();
