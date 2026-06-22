# WhatsApp Dyeing Order Form (DOF) Approval Integration

This project integrates Meta's WhatsApp Cloud API with Supabase Edge Functions to handle Dyeing Order Form (DOF) notifications and one-click approvals.

## Subsystems
- **`send-whatsapp` Edge Function:** Triggered by database webhook on inserting a new DOF in `dyeing_order_forms`. Generates a styled A4 receipt PDF containing metadata, QR codes, linked orders, and summaries, uploads it to Supabase storage, and sends it to all registered admins with interactive Approve/Reject buttons.
- **`receive-whatsapp` Webhook Endpoint:** Publicly accessible endpoint (`--no-verify-jwt`) registered in Meta Developer Portal. Receives callbacks when admins click "Approve" or "Reject", updates the database status, deletes the temporary PDF from storage, and replies with a status update.

## Managing Admins & Phone Numbers
- Recipient phone numbers are dynamic and are queried from the **`profiles`** table in Supabase.
- **To add a new admin:**
  1. Add their profile in the database or select their existing row.
  2. Set their `role` to `'admin'`.
  3. Enter their phone number in the `whatsapp_phone` column (format: with country code, no leading `+` or spaces, e.g., `919159109074`).
- **Notification Broadcast:** When a new DOF is submitted, the system automatically loops through and sends the interactive PDF to all admins with a non-null `whatsapp_phone`.
- **First-Come, First-Served:** Any admin can click Approve/Reject. The system logs who approved the form (`approved_by: user_id`) and prevents double-processing by replying with an already-approved/rejected message if another admin attempts to approve it later.

## Deployment & Verification Commands
- **Deploy send-whatsapp:**
  ```bash
  npx supabase functions deploy send-whatsapp --project-ref fxoxaovxilwhzlefautn
  ```
- **Deploy receive-whatsapp (MUST be public):**
  ```bash
  npx supabase functions deploy receive-whatsapp --no-verify-jwt --project-ref fxoxaovxilwhzlefautn
  ```
- **Local Test Scripts:**
  - `node scratch/test-deployed-send-whatsapp.cjs` (Sends mock notification)
  - `node scratch/test-deployed-receive-whatsapp.cjs` (Simulates webhook click)
  - `node scratch/inspect-webhook-logs.cjs` (Queries incoming webhook logs)
