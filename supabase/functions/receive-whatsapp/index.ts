import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const WEBHOOK_VERIFY_TOKEN = Deno.env.get("WEBHOOK_VERIFY_TOKEN");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const META_ACCESS_TOKEN = Deno.env.get("META_ACCESS_TOKEN");
const PHONE_NUMBER_ID = Deno.env.get("META_PHONE_NUMBER_ID");

serve(async (req) => {
  const url = new URL(req.url);

  // ── 1. Meta Webhook Verification (GET) ──────────────────────
  if (req.method === "GET") {
    const action = url.searchParams.get("action");
    if (action === "dump_net_requests") {
      const supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
        db: { schema: 'net' }
      });
      const { data: requests, error } = await supabaseAdmin
        .from("http_request")
        .select("*")
        .order("id", { ascending: false })
        .limit(20);
      return new Response(JSON.stringify({ requests, error }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    const mode      = url.searchParams.get("hub.mode");
    const token     = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === WEBHOOK_VERIFY_TOKEN) {
      console.log("✅ Webhook verified successfully");
      return new Response(challenge, { status: 200 });
    }
    return new Response("Verification failed", { status: 403 });
  }

  // ── 2. Incoming WhatsApp Message (POST) ─────────────────────
  if (req.method === "POST") {
    try {
      const body = await req.json();
      const supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

      // Log incoming webhook event for diagnostics
      try {
        await supabaseAdmin.from("webhook_logs").insert({ payload: body });
      } catch (err) {
        console.error("⚠️ Webhook log error:", err);
      }

      let senderPhone = "";
      let rawText = "";
      let dofNumberFromContext = "";

      // ── A. Check for OpenWA Payload Format ──
      const data = body.data || (body.event ? body : null);
      if (data) {
        const rawFrom = data.from || data.chatId || data.author || "";
        senderPhone = rawFrom.toString().replace(/@c\.us|@s\.whatsapp\.net|\D/g, "");

        // 1. Text or button body
        if (data.body) {
          rawText = data.body.toString().trim();
        }

        // 2. Poll vote
        if (data.pollVote?.selectedOptions?.length) {
          rawText = data.pollVote.selectedOptions[0];
        } else if (data.selectedOptions?.length) {
          rawText = data.selectedOptions[0];
        }

        // 3. Extract DOF Number from poll name or quoted message
        const contextStr = `${data.pollName || ''} ${data.poll?.name || ''} ${data.quotedMsg?.caption || ''} ${data.quotedMsg?.body || ''}`;
        const dofMatch = contextStr.match(/AT\/\d{4}\/DOF\/\d+/i);
        if (dofMatch) {
          dofNumberFromContext = dofMatch[0];
        }
      }

      // ── B. Check for Meta Payload Format (Fallback) ──
      const entry   = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value   = changes?.value;
      const message = value?.messages?.[0];

      if (message) {
        senderPhone = message.from?.toString().replace(/\D/g, "") || "";
        if (message.type === "text") {
          rawText = (message.text?.body || "").trim();
        } else if (message.type === "button") {
          rawText = (message.button?.payload || "").trim();
        } else if (message.type === "interactive") {
          const buttonReply = message.interactive?.button_reply;
          if (buttonReply) {
            rawText = (buttonReply.id || buttonReply.title || "").trim();
          }
        }
      }

      if (!senderPhone || !rawText) {
        return new Response(JSON.stringify({ status: "ignored", reason: "no_message_or_sender" }), {
          status: 200, headers: { "Content-Type": "application/json" }
        });
      }

      const upperText = rawText.toUpperCase();

      // Determine Action (Supports "A", "R", "APPROVE", "REJECT", "D1", "D2", etc.)
      let action: "APPROVE" | "REJECT" | null = null;
      let dofNumber = dofNumberFromContext;

      if (upperText === "A" || upperText.startsWith("A ") || /^D\s*1\b/i.test(upperText) || /^DOF\s*(APPROVE|1)\b/i.test(upperText) || /^APPROVE\s+DOF/i.test(upperText) || /^APPROVE\s+AT.*DOF/i.test(upperText)) {
        action = "APPROVE";
        const matched = upperText.match(/(\bAT[\w\/-]*DOF[\w\/-]*|\b\d{4,5}\b)/i);
        if (matched) dofNumber = matched[1];
      } else if (upperText === "R" || upperText.startsWith("R ") || /^D\s*2\b/i.test(upperText) || /^DOF\s*(REJECT|2)\b/i.test(upperText) || /^REJECT\s+DOF/i.test(upperText) || /^REJECT\s+AT.*DOF/i.test(upperText)) {
        action = "REJECT";
        const matched = upperText.match(/(\bAT[\w\/-]*DOF[\w\/-]*|\b\d{4,5}\b)/i);
        if (matched) dofNumber = matched[1];
      } else if (upperText.startsWith("APPROVE")) {
        action = "APPROVE";
        const rest = upperText.replace(/^APPROVE\s*/i, "").trim();
        if (rest) dofNumber = rest;
      } else if (upperText.startsWith("REJECT")) {
        action = "REJECT";
        const rest = upperText.replace(/^REJECT\s*/i, "").trim();
        if (rest) dofNumber = rest;
      } else if (upperText === "1" || upperText.startsWith("1 ")) {
        action = "APPROVE";
        const rest = upperText.replace(/^1\s*/i, "").trim();
        if (rest) dofNumber = rest;
      } else if (upperText === "2" || upperText.startsWith("2 ")) {
        action = "REJECT";
        const rest = upperText.replace(/^2\s*/i, "").trim();
        if (rest) dofNumber = rest;
      }

      if (!action) {
        console.log(`ℹ️ Ignored non-approval message from ${senderPhone}: ${rawText}`);
        return new Response(JSON.stringify({ status: "ignored", reason: "not_an_action" }), {
          status: 200, headers: { "Content-Type": "application/json" }
        });
      }

      // Verify the sender is authorized (Check whatsapp_contacts OR profiles admin)
      let approverName = "Admin";
      let approverId: string | null = null;

      // 1. Check whatsapp_contacts
      const { data: contact } = await supabaseAdmin
        .from("whatsapp_contacts")
        .select("id, name, is_active")
        .eq("phone", senderPhone)
        .eq("is_active", true)
        .maybeSingle();

      if (contact) {
        approverName = contact.name || "Admin";
      } else {
        // 2. Check profiles admin
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("id, role, full_name")
          .eq("whatsapp_phone", senderPhone)
          .maybeSingle();

        if (profile && profile.role === "admin") {
          approverName = profile.full_name || "Admin";
          approverId = profile.id;
        } else {
          console.warn(`⛔ Unauthorized WhatsApp reply from: ${senderPhone}`);
          await sendOpenWaReply(senderPhone, `⛔ Unauthorized. Your number (${senderPhone}) is not registered for approvals.`);
          return new Response(JSON.stringify({ status: "unauthorized" }), {
            status: 200, headers: { "Content-Type": "application/json" }
          });
        }
      }

      // Find the DOF
      let dofQuery = supabaseAdmin.from("dyeing_order_forms").select("id, status, dof_number");
      if (dofNumber) {
        dofQuery = dofQuery.ilike("dof_number", `%${dofNumber}%`);
      } else {
        // Fallback to the latest pending DOF
        dofQuery = dofQuery.eq("status", "pending").order("created_at", { ascending: false }).limit(1);
      }

      const { data: dofData, error: dofErr } = await dofQuery;
      const dof = Array.isArray(dofData) ? dofData[0] : dofData;

      if (dofErr || !dof) {
        console.warn(`❌ Pending DOF not found for reference: ${dofNumber || "latest"}`);
        await sendOpenWaReply(senderPhone, `❌ Pending DOF not found. Please check the DOF number and try again.`);
        return new Response(JSON.stringify({ status: "dof_not_found" }), {
          status: 200, headers: { "Content-Type": "application/json" }
        });
      }

      if (dof.status !== "pending") {
        await sendOpenWaReply(senderPhone, `ℹ️ DOF *${dof.dof_number}* is already *${dof.status.toUpperCase()}*. No changes made.`);
        return new Response(JSON.stringify({ status: "already_processed" }), {
          status: 200, headers: { "Content-Type": "application/json" }
        });
      }

      const newStatus = action === "APPROVE" ? "approved" : "rejected";

      // Update DOF status in Supabase DB
      const { error: updateErr } = await supabaseAdmin
        .from("dyeing_order_forms")
        .update({
          status: newStatus,
          approved_by: approverId,
          approval_notes: `${action === "APPROVE" ? "Approved" : "Rejected"} via WhatsApp by ${approverName} (${senderPhone})`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", dof.id);

      if (updateErr) {
        console.error("❌ DB update error:", updateErr);
        await sendOpenWaReply(senderPhone, `❌ Error updating DOF status in ERP. Please try again.`);
        return new Response(JSON.stringify({ status: "db_update_error", error: updateErr }), {
          status: 200, headers: { "Content-Type": "application/json" }
        });
      }

      // Cleanup temporary PDF from storage
      try {
        const pdfFilename = `${dof.dof_number.replace(/\//g, "_")}.pdf`;
        await supabaseAdmin.storage.from("dof-pdfs").remove([pdfFilename]);
      } catch (sErr) {
        console.warn("⚠️ Storage cleanup error:", sErr);
      }

      // Send confirmation message back to WhatsApp
      const emoji = action === "APPROVE" ? "✅" : "❌";
      const replyText = `${emoji} *DOF ${dof.dof_number}* has been *${newStatus.toUpperCase()}* successfully by ${approverName}.`;
      await sendOpenWaReply(senderPhone, replyText);

      console.log(`✅ DOF ${dof.dof_number} ${newStatus} by ${approverName} (${senderPhone})`);
      return new Response(JSON.stringify({ success: true, status: newStatus, dof: dof.dof_number }), {
        status: 200, headers: { "Content-Type": "application/json" }
      });

    } catch (err) {
      console.error("❌ Webhook processing error:", err);
      return new Response(JSON.stringify({ status: "error", error: (err as Error).message }), {
        status: 200, headers: { "Content-Type": "application/json" }
      });
    }
  }

  return new Response("Method Not Allowed", { status: 405 });
});

// ── Helper: Send confirmation message back via OpenWA (Render Bot) ──
async function sendOpenWaReply(phone: string, text: string) {
  try {
    const botUrl = "https://openwa-attendance-bot.onrender.com";
    const apiKey = "FacPassAttendanceOpenWaMasterKey2026";
    let cleanPhone = phone.toString().replace(/\D/g, "");
    if (cleanPhone.length === 10) cleanPhone = `91${cleanPhone}`;
    const chatId = cleanPhone.includes("@") ? cleanPhone : `${cleanPhone}@c.us`;

    let sessionId = "55581c43-9848-48ed-884d-bce4dac1a28b";
    try {
      const sessRes = await fetch(`${botUrl}/api/sessions`, {
        headers: { "X-API-Key": apiKey }
      });
      if (sessRes.ok) {
        const sessions = await sessRes.json();
        if (Array.isArray(sessions) && sessions.length > 0) {
          const ready = sessions.find((s: any) => s.status === "ready" || s.engineLoaded) || sessions[0];
          if (ready?.id) sessionId = ready.id;
        }
      }
    } catch (_) {}

    const response = await fetch(`${botUrl}/api/sessions/${sessionId}/messages/send-text`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },
      body: JSON.stringify({
        chatId,
        text,
      }),
    });

    const result = await response.json().catch(() => ({}));
    console.log(`📤 OpenWA confirmation reply sent to ${chatId}:`, JSON.stringify(result));
    return { ok: response.ok, data: result };
  } catch (err) {
    console.error("❌ Failed to send OpenWA reply:", err);
    return { ok: false, error: (err as Error).message };
  }
}
