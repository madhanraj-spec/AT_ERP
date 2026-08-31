-- ============================================================
-- WhatsApp Settings and Recipient Contacts Schema
-- ============================================================

-- 1. Contacts table for WhatsApp message recipients
CREATE TABLE IF NOT EXISTS public.whatsapp_contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  designation TEXT DEFAULT 'Admin',
  notify_dof BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. General WhatsApp / OpenWA settings table
CREATE TABLE IF NOT EXISTS public.whatsapp_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Enable RLS
ALTER TABLE public.whatsapp_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_settings ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for whatsapp_contacts
DROP POLICY IF EXISTS "Allow authenticated read whatsapp_contacts" ON public.whatsapp_contacts;
CREATE POLICY "Allow authenticated read whatsapp_contacts" ON public.whatsapp_contacts 
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow admin modify whatsapp_contacts" ON public.whatsapp_contacts;
CREATE POLICY "Allow admin modify whatsapp_contacts" ON public.whatsapp_contacts 
  FOR ALL USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin' 
    OR auth.role() = 'service_role'
  );

-- 5. RLS Policies for whatsapp_settings
DROP POLICY IF EXISTS "Allow authenticated read whatsapp_settings" ON public.whatsapp_settings;
CREATE POLICY "Allow authenticated read whatsapp_settings" ON public.whatsapp_settings 
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow admin modify whatsapp_settings" ON public.whatsapp_settings;
CREATE POLICY "Allow admin modify whatsapp_settings" ON public.whatsapp_settings 
  FOR ALL USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin' 
    OR auth.role() = 'service_role'
  );

-- 6. Insert Default Settings
INSERT INTO public.whatsapp_settings (key, value)
VALUES 
  ('openwa_bot_url', 'https://openwa-attendance-bot.onrender.com'),
  ('openwa_api_key', 'FacPassAttendanceOpenWaMasterKey2026'),
  ('openwa_endpoint', '/sendText'),
  ('is_enabled', 'true')
ON CONFLICT (key) DO UPDATE 
SET value = EXCLUDED.value, updated_at = timezone('utc'::text, now());

-- 7. Grant Permissions
GRANT ALL ON public.whatsapp_contacts TO authenticated, service_role;
GRANT ALL ON public.whatsapp_settings TO authenticated, service_role;

-- 8. Add WhatsApp Bot link to admin role permissions if present
UPDATE public.role_permissions
SET sidebar_links = (
  CASE 
    WHEN NOT sidebar_links::jsonb ? '/admin/whatsapp' 
    THEN (sidebar_links::jsonb || '["/admin/whatsapp"]'::jsonb)::jsonb
    ELSE sidebar_links::jsonb
  END
)::jsonb
WHERE role_name = 'admin';

