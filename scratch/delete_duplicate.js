import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load env variables
const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length === 2) {
    env[parts[0].trim()] = parts[1].trim();
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function run() {
  console.log("Signing in...");
  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: 'tharun@at.com',
    password: 'admin123'
  });

  if (authErr) {
    console.error("Auth error:", authErr);
    return;
  }
  console.log("Signed in successfully.");

  const duplicateReceiptNo = 'AT/2026/DYRR/00008';
  console.log(`Finding receipt ${duplicateReceiptNo}...`);
  
  const { data: receipts, error: findErr } = await supabase
    .from('dyed_yarn_receipts')
    .select('id, dyrr_number')
    .eq('dyrr_number', duplicateReceiptNo);

  if (findErr) {
    console.error("Error finding receipt:", findErr);
    return;
  }

  if (!receipts || receipts.length === 0) {
    console.error(`Receipt ${duplicateReceiptNo} not found.`);
    return;
  }

  const receiptId = receipts[0].id;
  console.log(`Found receipt ID: ${receiptId}. Deleting items first...`);

  const { data: deletedItems, error: delItemsErr } = await supabase
    .from('dyed_yarn_receipt_items')
    .delete()
    .eq('receipt_id', receiptId)
    .select();

  if (delItemsErr) {
    console.error("Error deleting receipt items:", delItemsErr);
    return;
  }

  console.log("Deleted items:", deletedItems);

  console.log(`Deleting receipt header ${duplicateReceiptNo}...`);
  const { data: deletedReceipt, error: delReceiptErr } = await supabase
    .from('dyed_yarn_receipts')
    .delete()
    .eq('id', receiptId)
    .select();

  if (delReceiptErr) {
    console.error("Error deleting receipt header:", delReceiptErr);
    return;
  }

  console.log("Deleted receipt header:", deletedReceipt);
  console.log("Operation completed successfully.");
}

run();
