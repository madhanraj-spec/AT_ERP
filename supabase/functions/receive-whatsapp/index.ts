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
      let insertErr = null;
      try {
        const { error } = await supabaseAdmin.from("webhook_logs").insert({ payload: body });
        if (error) {
          insertErr = error;
          console.error("⚠️ Webhook log insert error:", error);
        }
      } catch (err) {
        console.error("⚠️ Webhook log try-catch error:", err);
      }

      const entry   = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value   = changes?.value;
      const message = value?.messages?.[0];

      // Acknowledge immediately (Meta requires 200 within 20s)
      if (!message) {
        return new Response("ok", { status: 200 });
      }

      const senderPhone = message.from; // e.g. "919876543210"

      // ── Handle text replies or button clicks ──
      let rawText = "";
      if (message.type === "text") {
        rawText = (message.text?.body || "").trim().toUpperCase();
      } else if (message.type === "button") {
        rawText = (message.button?.payload || "").trim().toUpperCase();
      } else if (message.type === "interactive") {
        const buttonReply = message.interactive?.button_reply;
        if (buttonReply) {
          rawText = (buttonReply.id || "").trim().toUpperCase();
        }
      }

      if (rawText) {
        // Match: "APPROVE AT/2026/DOF/00001" or "REJECT AT/2026/DOF/00001"
        const match = rawText.match(/^(APPROVE|REJECT)\s+(.+)$/);
        if (!match) {
          console.log(`ℹ️ Ignored non-command message from ${senderPhone}: ${rawText}`);
          return new Response("ok", { status: 200 });
        }

        const action    = match[1];           // "APPROVE" or "REJECT"
        const dofNumber = match[2].trim();    // DOF number

        // Verify the sender is an authorized admin
        const { data: userProfile, error: profileErr } = await supabaseAdmin
          .from("profiles")
          .select("id, role, full_name")
          .eq("whatsapp_phone", senderPhone)
          .single();

        if (profileErr || !userProfile || userProfile.role !== "admin") {
          console.warn(`⛔ Unauthorized WhatsApp reply from: ${senderPhone}`);
          const replyResult = await sendWhatsAppReply(senderPhone, `⛔ Unauthorized. Your number is not registered as an admin.`);
          return new Response(JSON.stringify({ status: "unauthorized", reply_result: replyResult, insert_error: insertErr }), {
            status: 200, headers: { "Content-Type": "application/json" }
          });
        }

        // Find the DOF by its number
        const { data: dof, error: dofErr } = await supabaseAdmin
          .from("dyeing_order_forms")
          .select("id, status, dof_number")
          .ilike("dof_number", dofNumber)
          .single();

        if (dofErr || !dof) {
          console.warn(`❌ DOF not found: ${dofNumber}`);
          const replyResult = await sendWhatsAppReply(senderPhone, `❌ DOF *${dofNumber}* not found. Please check the DOF number and try again.`);
          return new Response(JSON.stringify({ status: "dof_not_found", reply_result: replyResult, insert_error: insertErr }), {
            status: 200, headers: { "Content-Type": "application/json" }
          });
        }

        if (dof.status !== "pending") {
          const replyResult = await sendWhatsAppReply(senderPhone, `ℹ️ DOF *${dof.dof_number}* is already *${dof.status.toUpperCase()}*. No changes made.`);
          return new Response(JSON.stringify({ status: "already_processed", reply_result: replyResult, insert_error: insertErr }), {
            status: 200, headers: { "Content-Type": "application/json" }
          });
        }

        const newStatus = action === "APPROVE" ? "approved" : "rejected";

        const { error: updateErr } = await supabaseAdmin
          .from("dyeing_order_forms")
          .update({
            status: newStatus,
            approved_by: userProfile.id,
            approval_notes: `${action} via WhatsApp by ${userProfile.full_name} (${senderPhone})`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", dof.id);

        if (updateErr) {
          console.error("❌ DB update error:", updateErr);
          const replyResult = await sendWhatsAppReply(senderPhone, `❌ Error updating DOF status. Please try again.`);
          return new Response(JSON.stringify({ status: "db_update_error", update_error: updateErr, reply_result: replyResult, insert_error: insertErr }), {
            status: 200, headers: { "Content-Type": "application/json" }
          });
        }

        // Delete the temporary PDF from storage to save space
        try {
          const pdfFilename = `${dof.dof_number.replace(/\//g, "_")}.pdf`;
          const { error: deleteErr } = await supabaseAdmin.storage
            .from("dof-pdfs")
            .remove([pdfFilename]);
          if (deleteErr) {
            console.warn("⚠️ Failed to delete PDF from storage:", deleteErr.message);
          } else {
            console.log(`🧹 Deleted temporary PDF: ${pdfFilename}`);
          }
        } catch (sErr) {
          console.warn("⚠️ Storage cleanup error:", sErr);
        }

        const emoji = action === "APPROVE" ? "✅" : "❌";
        const replyResult = await sendWhatsAppReply(
          senderPhone,
          `${emoji} *DOF ${dof.dof_number}* has been *${newStatus.toUpperCase()}* successfully by ${userProfile.full_name}.`
        );

        console.log(`✅ DOF ${dof.dof_number} ${newStatus} by ${userProfile.full_name}`);
        return new Response(JSON.stringify({ status: "success", reply_result: replyResult, insert_error: insertErr }), {
          status: 200, headers: { "Content-Type": "application/json" }
        });
      }

      return new Response(JSON.stringify({ status: "ignored", insert_error: insertErr }), {
        status: 200, headers: { "Content-Type": "application/json" }
      });

    } catch (err) {
      console.error("❌ Webhook processing error:", err);
      return new Response(JSON.stringify({ status: "error", error: err.message }), {
        status: 200, headers: { "Content-Type": "application/json" }
      });
    }
  }

  return new Response("Method Not Allowed", { status: 405 });
});

// ── Helper: Send a reply message back via WhatsApp ──────────
async function sendWhatsAppReply(to: string, text: string) {
  try {
    const metaUrl = `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`;
    const response = await fetch(metaUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${META_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: text, preview_url: false },
      }),
    });
    const result = await response.json();
    console.log(`📤 Reply sent to ${to}:`, JSON.stringify(result));
    return { ok: response.ok, status: response.status, data: result };
  } catch (err) {
    console.error("❌ Failed to send WhatsApp reply:", err);
    return { ok: false, error: err.message };
  }
}
