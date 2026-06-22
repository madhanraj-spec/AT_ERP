async function summarize() {
  const url = 'https://fxoxaovxilwhzlefautn.supabase.co/functions/v1/receive-whatsapp?action=dump_logs';
  
  console.log('Fetching logs from:', url);
  const response = await fetch(url);
  const data = await response.json();

  if (data.error) {
    console.error("Error from server:", data.error);
    return;
  }

  const logs = data.logs || [];
  console.log(`Total logs found in DB: ${logs.length}`);

  const countsByMessageId = {};
  const statusCounts = {};
  const buttonClicks = {};

  logs.forEach(log => {
    const entry = log.payload?.entry?.[0];
    const change = entry?.changes?.[0];
    const val = change?.value;
    
    // Check if it has a message click
    const message = val?.messages?.[0];
    if (message) {
      const msgId = message.id;
      countsByMessageId[msgId] = (countsByMessageId[msgId] || 0) + 1;
      
      if (message.type === 'interactive') {
        const reply = message.interactive?.button_reply;
        if (reply) {
          const action = reply.id;
          if (!buttonClicks[action]) {
            buttonClicks[action] = { count: 0, timestamps: [] };
          }
          buttonClicks[action].count++;
          buttonClicks[action].timestamps.push(log.created_at);
        }
      }
    }
    
    // Check if status update
    const statuses = val?.statuses;
    if (statuses && statuses.length > 0) {
      statuses.forEach(status => {
        const statusType = status.status;
        statusCounts[statusType] = (statusCounts[statusType] || 0) + 1;
      });
    }
  });

  console.log("\n--- Message ID Webhook Counts (Retries from Meta) ---");
  Object.entries(countsByMessageId).forEach(([msgId, count]) => {
    console.log(`Msg ID: ${msgId} -> Received ${count} times`);
  });

  console.log("\n--- Button Click Action Details ---");
  Object.entries(buttonClicks).forEach(([action, info]) => {
    console.log(`Action: "${action}" -> Click webhook received ${info.count} times`);
    console.log(`  Timestamps:`, info.timestamps.slice(0, 5));
  });

  console.log("\n--- Status Message Counts ---");
  console.log(statusCounts);
}

summarize();
