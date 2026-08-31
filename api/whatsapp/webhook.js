import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://fxoxaovxilwhzlefautn.supabase.co';
// Use anon key or service role key if available
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4b3hhb3Z4aWx3aHpsZWZhdXRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MDgyMDYsImV4cCI6MjA5MTI4NDIwNn0.5HvOYyAKg79BR1MaZkX-obpwCT4PJbKVOW0vChAOMLE';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const OPENWA_URL = 'https://openwa-attendance-bot.onrender.com';
const OPENWA_KEY = 'FacPassAttendanceOpenWaMasterKey2026';
const OPENWA_SESSION = '55581c43-9848-48ed-884d-bce4dac1a28b';

export default async function handler(req, res) {
  // Allow GET for healthcheck / verification
  if (req.method === 'GET') {
    return res.status(200).json({ status: 'ok', service: 'AT-ERP WhatsApp Webhook' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body || {};
    console.log('📥 Received WhatsApp Webhook Event:', JSON.stringify(body));

    let senderPhone = '';
    let rawText = '';
    let dofNumberFromContext = '';

    // 1. OpenWA Event format
    if (body.event === 'message.received' && body.data) {
      const d = body.data;
      senderPhone = (d.from || '').toString().replace(/\D/g, '');
      rawText = (d.body || d.text || '').trim();

      // Check if user replied to / quoted a previous message with DOF number
      if (d.quotedMsg) {
        const qText = d.quotedMsg.body || d.quotedMsg.caption || d.quotedMsg.text || '';
        const match = qText.match(/DOF\s*(?:Number:)?\s*([A-Z0-9_\-\/]+)/i);
        if (match && match[1]) {
          dofNumberFromContext = match[1].trim();
        }
      }
    } else if (body.chatId || body.from) {
      // Direct message object
      senderPhone = (body.chatId || body.from || '').toString().replace(/\D/g, '');
      rawText = (body.text || body.body || '').trim();
    }

    if (!senderPhone || !rawText) {
      return res.status(200).json({ status: 'ignored', reason: 'no_message_or_sender' });
    }

    const upperText = rawText.toUpperCase();

    // Determine Action (Supports "A", "R", "APPROVE", "REJECT", "D1", "D2", etc.)
    let action = null;
    let dofNumber = dofNumberFromContext;

    if (
      upperText === 'A' ||
      upperText.startsWith('A ') ||
      /^D\s*1\b/i.test(upperText) ||
      /^DOF\s*(APPROVE|1)\b/i.test(upperText) ||
      /^APPROVE\s+DOF/i.test(upperText) ||
      /^APPROVE\s+AT.*DOF/i.test(upperText)
    ) {
      action = 'APPROVE';
      const matched = upperText.match(/(\bAT[\w\/-]*DOF[\w\/-]*|\b\d{4,5}\b)/i);
      if (matched) dofNumber = matched[1];
    } else if (
      upperText === 'R' ||
      upperText.startsWith('R ') ||
      /^D\s*2\b/i.test(upperText) ||
      /^DOF\s*(REJECT|2)\b/i.test(upperText) ||
      /^REJECT\s+DOF/i.test(upperText) ||
      /^REJECT\s+AT.*DOF/i.test(upperText)
    ) {
      action = 'REJECT';
      const matched = upperText.match(/(\bAT[\w\/-]*DOF[\w\/-]*|\b\d{4,5}\b)/i);
      if (matched) dofNumber = matched[1];
    } else if (upperText.startsWith('APPROVE')) {
      action = 'APPROVE';
      const rest = upperText.replace(/^APPROVE\s*/i, '').trim();
      if (rest) dofNumber = rest;
    } else if (upperText.startsWith('REJECT')) {
      action = 'REJECT';
      const rest = upperText.replace(/^REJECT\s*/i, '').trim();
      if (rest) dofNumber = rest;
    }

    if (!action) {
      console.log(`ℹ️ Ignored non-approval message from ${senderPhone}: ${rawText}`);
      return res.status(200).json({ status: 'ignored', reason: 'not_an_action' });
    }

    // Verify authorized user
    let approverName = 'Admin';
    let approverId = null;

    // Check whatsapp_contacts
    const { data: contact } = await supabase
      .from('whatsapp_contacts')
      .select('id, name, is_active')
      .eq('phone', senderPhone)
      .eq('is_active', true)
      .maybeSingle();

    if (contact) {
      approverName = contact.name || 'Admin';
    } else {
      // Check admin profiles
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, role, full_name')
        .eq('whatsapp_phone', senderPhone)
        .maybeSingle();

      if (profile && profile.role === 'admin') {
        approverName = profile.full_name || 'Admin';
        approverId = profile.id;
      } else {
        console.warn(`⛔ Unauthorized WhatsApp reply from: ${senderPhone}`);
        await sendOpenWaReply(senderPhone, `⛔ Unauthorized. Your number (${senderPhone}) is not registered for approvals.`);
        return res.status(200).json({ status: 'unauthorized' });
      }
    }

    // Find the matching DOF
    let dofQuery = supabase.from('dyeing_order_forms').select('id, status, dof_number');
    if (dofNumber) {
      dofQuery = dofQuery.ilike('dof_number', `%${dofNumber}%`);
    } else {
      // Fallback to latest pending DOF
      dofQuery = dofQuery.eq('status', 'pending').order('created_at', { ascending: false }).limit(1);
    }

    const { data: dofData, error: dofErr } = await dofQuery;
    const dof = Array.isArray(dofData) ? dofData[0] : dofData;

    if (dofErr || !dof) {
      console.warn(`❌ Pending DOF not found for reference: ${dofNumber || 'latest'}`);
      await sendOpenWaReply(senderPhone, `❌ Pending DOF not found. Please check the DOF number and try again.`);
      return res.status(200).json({ status: 'dof_not_found' });
    }

    if (dof.status !== 'pending') {
      await sendOpenWaReply(senderPhone, `ℹ️ DOF *${dof.dof_number}* is already *${dof.status.toUpperCase()}*. No changes made.`);
      return res.status(200).json({ status: 'already_processed' });
    }

    const newStatus = action === 'APPROVE' ? 'approved' : 'rejected';

    // Update DOF in Supabase
    const { error: updateErr } = await supabase
      .from('dyeing_order_forms')
      .update({
        status: newStatus,
        approved_by: approverId,
        approval_notes: `${action === 'APPROVE' ? 'Approved' : 'Rejected'} via WhatsApp by ${approverName} (${senderPhone})`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', dof.id);

    if (updateErr) {
      console.error('❌ DB update error:', updateErr);
      await sendOpenWaReply(senderPhone, `❌ Error updating DOF status in ERP. Please try again.`);
      return res.status(200).json({ status: 'db_update_error', error: updateErr });
    }

    // Send confirmation message to sender
    const statusEmoji = action === 'APPROVE' ? '✅' : '❌';
    const replyMessage = [
      `${statusEmoji} *Dyeing Order Form ${action === 'APPROVE' ? 'APPROVED' : 'REJECTED'}*`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `📋 *DOF Number:* ${dof.dof_number}`,
      `👤 *Action By:* ${approverName}`,
      `⏰ *Time:* ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`,
      `━━━━━━━━━━━━━━━━━━━━`,
      action === 'APPROVE'
        ? `🚀 The DOF is now approved and greige yarn dispatch can be processed.`
        : `🛑 The DOF has been marked as rejected.`,
    ].join('\n');

    await sendOpenWaReply(senderPhone, replyMessage);
    console.log(`🎉 DOF ${dof.dof_number} successfully marked as ${newStatus} by ${approverName}`);

    return res.status(200).json({ success: true, dof_number: dof.dof_number, status: newStatus });
  } catch (error) {
    console.error('❌ Webhook error:', error);
    return res.status(500).json({ error: error.message });
  }
}

async function sendOpenWaReply(phone, text) {
  try {
    const cleanPhone = phone.toString().replace(/\D/g, '');
    const chatId = cleanPhone.includes('@') ? cleanPhone : `${cleanPhone}@c.us`;

    const res = await fetch(`${OPENWA_URL}/api/sessions/${OPENWA_SESSION}/messages/send-text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': OPENWA_KEY,
      },
      body: JSON.stringify({ chatId, text }),
    });

    const data = await res.json().catch(() => ({}));
    console.log(`📤 Sent confirmation reply to ${chatId}:`, data);
  } catch (e) {
    console.warn(`⚠️ Failed to send WhatsApp confirmation to ${phone}:`, e.message);
  }
}
