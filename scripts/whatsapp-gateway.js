import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: Missing VITE_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

// 1. Initialize Supabase Admin client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// 2. Initialize WhatsApp Client with Local Session Caching
const client = new Client({
  authStrategy: new LocalAuth({
    dataPath: path.join(process.cwd(), '.wwebjs_auth') // Saves login session locally
  }),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
});

// ── WhatsApp Connection Event Handlers ──

// Generate QR Code in terminal for first-time login
client.on('qr', (qr) => {
  console.log('\n📱 Scan this QR code with WhatsApp to connect your gateway:');
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  console.log('\n✅ WhatsApp Gateway is connected and running!');
  startSupabaseListener();
});

client.on('auth_failure', (msg) => {
  console.error('❌ Authentication failure:', msg);
});

// ── Supabase Database Real-time Listener ──

function startSupabaseListener() {
  console.log('📡 Subscribed to public.dyeing_order_forms changes...');

  supabase
    .channel('dof-approvals-channel')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'dyeing_order_forms' },
      async (payload) => {
        const record = payload.new;
        if (record.status !== 'pending') return;

        console.log(`🔔 New pending DOF detected: ${record.dof_number}`);
        await sendApprovalAlert(record);
      }
    )
    .subscribe();
}

// ── Send Alert Function ──

async function sendApprovalAlert(record) {
  try {
    // 1. Fetch Admin Details
    const { data: approver, error: appErr } = await supabase
      .from('profiles')
      .select('whatsapp_phone, full_name')
      .eq('role', 'admin')
      .not('whatsapp_phone', 'is', null)
      .limit(1)
      .single();

    if (appErr || !approver || !approver.whatsapp_phone) {
      console.warn('⚠️ No administrator found with a registered WhatsApp phone number.');
      return;
    }

    // 2. Fetch Dyeing Unit
    const { data: dyeingUnit } = await supabase
      .from('master_partners')
      .select('partner_name')
      .eq('id', record.dyeing_unit_id)
      .single();

    // 3. Calculate total weight
    const totalWeight = (record.summary || []).reduce(
      (sum, item) => sum + parseFloat(item.total_kg || 0), 
      0
    );

    // 4. Construct message
    const message = `*Ashok Textiles ERP - Approval Request*\n\n` +
      `*Form:* Dyeing Order Form (${record.dof_number})\n` +
      `*Dyeing Unit:* ${dyeingUnit?.partner_name || 'N/A'}\n` +
      `*Total Weight:* ${totalWeight.toFixed(2)} kg\n\n` +
      `To approve this form, reply:\n` +
      `*APPROVE ${record.dof_number}*\n\n` +
      `To reject this form, reply:\n` +
      `*REJECT ${record.dof_number}*`;

    // 5. Send message
    // WhatsApp format expects numbers as: [countrycode][number]@c.us (e.g. 919876543210@c.us)
    const recipientId = `${approver.whatsapp_phone}@c.us`;
    await client.sendMessage(recipientId, message);
    console.log(`✉️ Approval request sent to ${approver.full_name} (${approver.whatsapp_phone})`);

  } catch (err) {
    console.error('❌ Failed to send approval alert:', err);
  }
}

// ── Receive Message & Process Approval ──

client.on('message', async (msg) => {
  const messageBody = msg.body?.trim();
  const senderId = msg.from; // e.g. "919876543210@c.us"
  const cleanPhone = senderId.split('@')[0]; // extracts "919876543210"

  // Check if message is a command
  if (!messageBody) return;

  const words = messageBody.split(/\s+/);
  if (words.length < 2) return;

  const action = words[0].toUpperCase(); // APPROVE or REJECT
  const dofNumber = words.slice(1).join(' '); // e.g. "AT/2026/DOF/00001"

  if (action !== 'APPROVE' && action !== 'REJECT') return;

  console.log(`📩 Received response from ${cleanPhone}: "${messageBody}"`);

  try {
    // 1. Verify if the sender is an Admin
    const { data: userProfile, error: profileErr } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('whatsapp_phone', cleanPhone)
      .single();

    if (profileErr || !userProfile || userProfile.role !== 'admin') {
      console.warn(`⛔ Unauthorized number attempt from: ${cleanPhone}`);
      return;
    }

    // 2. Fetch the DOF record matching the form number
    const { data: dofRecord, error: dofErr } = await supabase
      .from('dyeing_order_forms')
      .select('id, status')
      .eq('dof_number', dofNumber)
      .single();

    if (dofErr || !dofRecord) {
      await msg.reply(`❌ ERP System: Form *${dofNumber}* was not found.`);
      return;
    }

    if (dofRecord.status !== 'pending') {
      await msg.reply(`⚠️ ERP System: Form *${dofNumber}* is already *${dofRecord.status}*.`);
      return;
    }

    const newStatus = action === 'APPROVE' ? 'approved' : 'rejected';

    // 3. Update status in Database
    const { error: updateErr } = await supabase
      .from('dyeing_order_forms')
      .update({
        status: newStatus,
        approved_by: userProfile.id,
        approval_notes: `Approved via personal WhatsApp Gateway by user (${cleanPhone})`
      })
      .eq('id', dofRecord.id);

    if (updateErr) {
      console.error('❌ Database update error:', updateErr);
      await msg.reply('❌ ERP System: Failed to update database. Please try again.');
      return;
    }

    // 4. Send Confirmation reply
    await msg.reply(`✅ ERP System: Form *${dofNumber}* has been successfully *${newStatus}*!`);
    console.log(`🚀 Form ${dofNumber} status updated in DB to ${newStatus}`);

  } catch (err) {
    console.error('❌ Error processing message:', err);
  }
});

// Start the client
console.log('🔄 Initializing WhatsApp Web Client...');
client.initialize();

process.on('SIGINT', async () => {
  console.log('\nShutting down gateway...');
  await client.destroy();
  process.exit();
});
