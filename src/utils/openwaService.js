import { supabase } from '../lib/supabase';

const DEFAULT_BOT_URL = 'https://openwa-attendance-bot.onrender.com';
const DEFAULT_API_KEY = 'FacPassAttendanceOpenWaMasterKey2026';
const DEFAULT_SESSION_ID = '55581c43-9848-48ed-884d-bce4dac1a28b';

// In-memory cache for the active session ID
let cachedSessionId = DEFAULT_SESSION_ID;
let lastSessionFetch = 0;

/**
 * Fetch WhatsApp / OpenWA Bot configuration from Supabase
 */
export async function getWhatsAppConfig() {
  try {
    const { data, error } = await supabase.from('whatsapp_settings').select('*');
    if (error || !data || data.length === 0) {
      return {
        botUrl: DEFAULT_BOT_URL,
        apiKey: DEFAULT_API_KEY,
        endpoint: '/api/sessions',
        isEnabled: true,
      };
    }

    const settingsMap = {};
    data.forEach(row => {
      settingsMap[row.key] = row.value;
    });

    return {
      botUrl: (settingsMap.openwa_bot_url || DEFAULT_BOT_URL).trim().replace(/\/+$/, ''),
      apiKey: (settingsMap.openwa_api_key ?? DEFAULT_API_KEY).trim(),
      endpoint: (settingsMap.openwa_endpoint || '/api/sessions').trim(),
      isEnabled: settingsMap.is_enabled !== 'false',
    };
  } catch (err) {
    console.warn('⚠️ Error fetching whatsapp_settings, using defaults:', err);
    return {
      botUrl: DEFAULT_BOT_URL,
      apiKey: DEFAULT_API_KEY,
      endpoint: '/api/sessions',
      isEnabled: true,
    };
  }
}

/**
 * Clean and format phone number for OpenWA (WhatsApp Web)
 * Example: "9876543210" -> { clean: "919876543210", chatId: "919876543210@c.us" }
 */
export function formatPhoneNumber(phone) {
  if (!phone) return null;
  let clean = phone.toString().replace(/\D/g, '');

  // If 10 digits (Standard India Mobile Number), prefix with 91
  if (clean.length === 10) {
    clean = `91${clean}`;
  }

  // If starts with 0 and 11 digits (e.g. 09876543210), replace leading 0 with 91
  if (clean.length === 11 && clean.startsWith('0')) {
    clean = `91${clean.substring(1)}`;
  }

  return {
    clean,
    chatId: clean.includes('@') ? clean : `${clean}@c.us`,
  };
}

/**
 * Discovers the active ready session UUID from OpenWA bot
 */
export async function getActiveSessionId(baseUrl, apiKey, isDev = false) {
  const now = Date.now();
  if (cachedSessionId && now - lastSessionFetch < 300000) {
    return cachedSessionId;
  }

  const devEnv = isDev || (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'));
  const targetUrl = devEnv 
    ? '/openwa-proxy/api/sessions' 
    : '/api/openwa/api/sessions';

  try {
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const sessions = await response.json();
      if (Array.isArray(sessions) && sessions.length > 0) {
        // Find ready session, or first session
        const readySession = sessions.find(s => s.status === 'ready' || s.engineLoaded) || sessions[0];
        if (readySession?.id) {
          cachedSessionId = readySession.id;
          lastSessionFetch = now;
          return readySession.id;
        }
      }
    }
  } catch (err) {
    console.warn('⚠️ Could not fetch active OpenWA sessions, using default ID:', err.message);
  }

  return DEFAULT_SESSION_ID;
}

/**
 * Send an individual message via the OpenWA bot on Render
 * Tries:
 * 1. Supabase Edge Function relay (for production without CORS limitations)
 * 2. Local Vite Proxy (for development)
 * 3. Direct Fetch
 */
export async function sendOpenWaMessage({ phone, message, botUrl, apiKey }) {
  const formatted = formatPhoneNumber(phone);
  if (!formatted || !formatted.clean) {
    throw new Error(`Invalid phone number: ${phone}`);
  }

  const config = await getWhatsAppConfig();
  const targetBotUrl = (botUrl || config.botUrl).replace(/\/+$/, '');
  const targetApiKey = apiKey !== undefined ? apiKey : config.apiKey;

  // Try 1: Call Supabase Edge Function (Bypasses browser CORS natively)
  try {
    const { data: edgeData, error: edgeErr } = await supabase.functions.invoke('send-whatsapp', {
      body: {
        phone: formatted.clean,
        message,
        botUrl: targetBotUrl,
        apiKey: targetApiKey,
      },
    });

    if (!edgeErr && edgeData && (edgeData.success || edgeData.messageId)) {
      return {
        success: true,
        data: edgeData,
        phone: formatted.clean,
      };
    }
  } catch (edgeInvocationErr) {
    console.log('ℹ️ Edge function invoke skipped or unavailable, trying direct/proxy...');
  }

  // Try 2: Local Vite Proxy (avoids CORS in browser dev environment)
  const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (isDev) {
    try {
      const sessionId = await getActiveSessionId(targetBotUrl, targetApiKey, true);
      const proxyUrl = `/openwa-proxy/api/sessions/${sessionId}/messages/send-text`;

      const proxyRes = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': targetApiKey,
        },
        body: JSON.stringify({
          chatId: formatted.chatId,
          text: message,
        }),
      });

      const proxyData = await proxyRes.json().catch(() => ({}));
      if (proxyRes.ok) {
        return {
          success: true,
          data: proxyData,
          phone: formatted.clean,
        };
      } else {
        // If the bot returned a business error (like session not ready/connected), return it immediately
        return {
          success: false,
          error: proxyData?.message || `OpenWA Bot returned HTTP ${proxyRes.status}`,
          phone: formatted.clean,
        };
      }
    } catch (proxyErr) {
      console.warn('⚠️ Vite proxy attempt failed:', proxyErr.message);
    }
  }

  // Try 3: Direct API Request to Render Bot
  try {
    const sessionId = await getActiveSessionId(targetBotUrl, targetApiKey, false);
    const directUrl = `${targetBotUrl}/api/sessions/${sessionId}/messages/send-text`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    const directRes = await fetch(directUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': targetApiKey,
      },
      body: JSON.stringify({
        chatId: formatted.chatId,
        text: message,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const directData = await directRes.json().catch(() => ({}));

    if (directRes.ok) {
      return {
        success: true,
        data: directData,
        phone: formatted.clean,
      };
    } else {
      throw new Error(directData?.message || `HTTP ${directRes.status}`);
    }
  } catch (directErr) {
    console.error(`❌ Direct OpenWA message delivery failed to ${phone}:`, directErr);
    return {
      success: false,
      error: directErr.message || 'Failed to send WhatsApp message. Please check bot URL & session.',
      phone: formatted.clean,
    };
  }
}

import { generateDofPdfBytes } from './dofPdfGenerator';

/**
 * Fetch all active recipient phone numbers marked for DOF notifications (falls back to Admin profiles if empty)
 */
export async function getDofRecipients() {
  try {
    const { data: contacts, error: contactsErr } = await supabase
      .from('whatsapp_contacts')
      .select('*')
      .eq('is_active', true)
      .eq('notify_dof', true)
      .order('created_at', { ascending: true });

    if (!contactsErr && contacts && contacts.length > 0) {
      return contacts;
    }

    // Fallback: Query administrator profiles with a registered WhatsApp phone
    const { data: admins } = await supabase
      .from('profiles')
      .select('id, full_name, whatsapp_phone')
      .eq('role', 'admin')
      .not('whatsapp_phone', 'is', null);

    if (admins && admins.length > 0) {
      return admins.map(a => ({
        id: a.id,
        name: a.full_name || 'Admin',
        phone: a.whatsapp_phone,
        designation: 'Admin',
        notify_dof: true,
        is_active: true,
      }));
    }

    return [];
  } catch (err) {
    console.warn('⚠️ Error fetching DOF WhatsApp recipients:', err);
    return [];
  }
}

/**
 * Formats and sends a rich WhatsApp notification with PDF document (Base64) and 1/2 reply instructions when a new DOF is created
 */
export async function sendDofCreationNotification({ 
  dofRecord,
  dofNumber, 
  dyeingUnitName, 
  expectedDeliveryDate, 
  summary = [], 
  allocations = [], 
  createdByName = 'Merchandiser' 
}) {
  try {
    const config = await getWhatsAppConfig();
    if (!config.isEnabled) {
      console.log('ℹ️ WhatsApp notifications are disabled in settings.');
      return { skipped: true, reason: 'WhatsApp disabled' };
    }

    const recipients = await getDofRecipients();
    if (!recipients || recipients.length === 0) {
      console.warn('⚠️ No active WhatsApp recipients configured for DOF notifications.');
      return { skipped: true, reason: 'No recipients configured' };
    }

    const effectiveDofNumber = dofNumber || dofRecord?.dof_number || 'DOF';
    const fullRecord = dofRecord || {
      dof_number: effectiveDofNumber,
      expected_delivery_date: expectedDeliveryDate,
      summary,
      yarn_allocations: allocations,
      status: 'pending',
      created_at: new Date().toISOString(),
    };

    // 1. Fetch Linked Orders and Master Yarn Counts for full rich PDF details
    let ordersData = [];
    const countsMap = new Map();
    try {
      const orderIds = fullRecord.order_ids || (fullRecord.yarn_allocations || []).map(a => a.orderId).filter(Boolean);
      const uniqueOrderIds = [...new Set(orderIds)];

      const [ordersRes, countsRes] = await Promise.all([
        uniqueOrderIds.length > 0
          ? supabase.from('orders').select('id, order_number, design_no, design_name, master_brands(brand_name)').in('id', uniqueOrderIds)
          : Promise.resolve({ data: [] }),
        supabase.from('master_yarn_counts').select('*'),
      ]);

      if (ordersRes.data) ordersData = ordersRes.data;
      if (countsRes.data) {
        countsRes.data.forEach(y => {
          countsMap.set(y.id, [y.count_value, y.spec, y.spec1, y.product_type].filter(Boolean).join(' '));
        });
      }
    } catch (fetchErr) {
      console.warn('⚠️ Error fetching orders/yarn count details for PDF:', fetchErr);
    }

    const totalKg = (fullRecord.summary || summary || []).reduce((sum, item) => sum + (parseFloat(item.total_kg) || 0), 0);
    const uniqueColours = [...new Set((fullRecord.summary || summary || []).map(s => s.colour).filter(Boolean))];

    const summaryLines = (fullRecord.summary || summary || []).slice(0, 10).map(s => {
      const label = countsMap.get(s.countId) || s.yarnLabel || 'Yarn';
      const kg = (parseFloat(s.total_kg) || 0).toFixed(2);
      return `• *${s.colour}* (${label}): ${kg} kg`;
    });

    if ((fullRecord.summary || summary || []).length > 10) {
      summaryLines.push(`• ...and ${(fullRecord.summary || summary || []).length - 10} more colour item(s)`);
    }

    const formattedDate = expectedDeliveryDate || fullRecord.expected_delivery_date
      ? new Date(expectedDeliveryDate || fullRecord.expected_delivery_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      : 'Not Specified';

    const captionText = [
      `🏭 *ASHOK TEXTILES ERP*`,
      `📋 *DYEING ORDER FORM: ${effectiveDofNumber}*`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `🔹 *Dyeing Unit:* ${dyeingUnitName || 'N/A'}`,
      `🔹 *Expected Delivery:* ${formattedDate}`,
      `🔹 *Prepared By:* ${createdByName}`,
      `🔹 *Colour Count:* ${uniqueColours.length}`,
      `🔹 *Total Qty:* ${totalKg.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `📦 *Allocation Details:*`,
      summaryLines.join('\n') || '• No items listed',
      `━━━━━━━━━━━━━━━━━━━━`,
      `📲 *REPLY TO TAKE ACTION:*`,
      `✅ Reply *A* to *APPROVE*`,
      `❌ Reply *R* to *REJECT*`,
      `_(Or reply APPROVE ${effectiveDofNumber} / REJECT ${effectiveDofNumber})_`
    ].join('\n');

    // 2. Generate PDF into Base64
    let pdfBase64 = null;
    try {
      console.log('📄 Generating detailed DOF PDF in browser memory with orders & counts...');
      const pdfBytes = await generateDofPdfBytes(fullRecord, dyeingUnitName, createdByName, ordersData, countsMap);
      
      // Convert Uint8Array to base64 string
      let binary = '';
      const len = pdfBytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(pdfBytes[i]);
      }
      pdfBase64 = btoa(binary);
      console.log('✅ Detailed DOF PDF generated to Base64 successfully, size:', pdfBase64.length);
    } catch (pdfErr) {
      console.warn('⚠️ PDF generation failed, sending text notification:', pdfErr);
    }

    // 2. Discover OpenWA Session
    const isDev = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const baseEndpoint = isDev ? '/openwa-proxy' : '/api/openwa';
    const sessionId = await getActiveSessionId(config.botUrl, config.apiKey, isDev);

    // 3. Dispatch Document with Base64 & Caption to all recipients
    const sendPromises = recipients.map(async recipient => {
      const formatted = formatPhoneNumber(recipient.phone);
      if (!formatted) {
        return { recipient: recipient.name, phone: recipient.phone, success: false, error: 'Invalid phone' };
      }

      let docResult = null;

      // A. Send Base64 PDF Document with Caption
      if (pdfBase64) {
        try {
          const docRes = await fetch(`${baseEndpoint}/api/sessions/${sessionId}/messages/send-document`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': config.apiKey,
            },
            body: JSON.stringify({
              chatId: formatted.chatId,
              base64: pdfBase64,
              filename: `${effectiveDofNumber.replace(/\//g, '_')}.pdf`,
              mimetype: 'application/pdf',
              caption: captionText,
            }),
          });
          docResult = await docRes.json().catch(() => ({}));
          console.log(`📤 Dispatched Base64 PDF Document to ${formatted.chatId}:`, docResult);
        } catch (docErr) {
          console.warn(`⚠️ Base64 PDF dispatch failed to ${formatted.chatId}:`, docErr.message);
        }
      }

      // If document delivery was not successful, fallback to sendText
      if (!docResult?.messageId) {
        const textRes = await sendOpenWaMessage({
          phone: recipient.phone,
          message: captionText,
          botUrl: config.botUrl,
          apiKey: config.apiKey,
        });
        return {
          recipient: recipient.name,
          phone: recipient.phone,
          success: textRes.success,
          textResult: textRes,
        };
      }

      return {
        recipient: recipient.name,
        phone: recipient.phone,
        success: true,
        docResult,
      };
    });

    const results = await Promise.all(sendPromises);
    const sentCount = results.filter(r => r.success).length;

    console.log(`✅ Dispatched DOF WhatsApp notification with PDF & 1/2 Approval instructions to ${sentCount} recipient(s).`);
    return {
      success: sentCount > 0,
      sentCount,
      results,
    };
  } catch (err) {
    console.error('❌ Error executing DOF creation notification:', err);
    return {
      success: false,
      error: err.message,
    };
  }
}
