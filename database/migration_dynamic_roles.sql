-- 1. Drop all dependent policies that reference public.profiles(role)
DROP POLICY IF EXISTS "Admins can update orders" ON public.orders;
DROP POLICY IF EXISTS "Admin can update DOFs" ON public.dyeing_order_forms;
DROP POLICY IF EXISTS "Admin can delete DOFs" ON public.dyeing_order_forms;
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow admin modify role_permissions" ON public.role_permissions;
DROP POLICY IF EXISTS "Allow authenticated read role_permissions" ON public.role_permissions;

-- 2. Alter profiles.role to be TEXT to support custom dynamic roles
ALTER TABLE public.profiles ALTER COLUMN role TYPE TEXT;

-- 3. Create role_permissions table
CREATE TABLE IF NOT EXISTS public.role_permissions (
    role_name TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    sidebar_links JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Enable RLS
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- 5. Create / Recreate all RLS policies (now that role column is TEXT)
CREATE POLICY "Admins can insert profiles" ON public.profiles FOR INSERT WITH CHECK (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));
CREATE POLICY "Admins can update profiles" ON public.profiles FOR UPDATE USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));

CREATE POLICY "Admins can update orders" ON public.orders FOR UPDATE USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin' OR auth.uid() = merchandiser_id
);
CREATE POLICY "Admin can update DOFs" ON public.dyeing_order_forms FOR UPDATE USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);
CREATE POLICY "Admin can delete DOFs" ON public.dyeing_order_forms FOR DELETE USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

CREATE POLICY "Allow authenticated read role_permissions" ON public.role_permissions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow admin modify role_permissions" ON public.role_permissions FOR ALL USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);


-- 4. Seed initial permissions with their original hardcoded values
INSERT INTO public.role_permissions (role_name, label, sidebar_links) VALUES
('admin', 'Admin', '["/dashboard", "/admin/orders", "/admin/dyeing-forms", "/admin/approvals", "/admin/finances", "/greige-yarn", "/dyed-yarn", "/production", "/warping-sizing", "/weaving", "/inspection/four-point", "/inspection/unwashed", "/inspection/washed", "/inspection/report", "/processing", "/masters", "/admin/users"]'),
('merchandiser', 'Merchandiser', '["/merchandiser/orders", "/merchandiser/dyeing-forms", "/masters"]'),
('yarn', 'Yarn Manager', '["/greige-yarn", "/dyed-yarn", "/processing", "/masters"]'),
('greige_yarn', 'Greige Yarn Operator', '["/dashboard", "/greige-yarn"]'),
('dyed_yarn', 'Dyed Yarn Operator', '["/dashboard", "/dyed-yarn"]'),
('production', 'Production Manager', '["/dashboard", "/production", "/processing", "/masters"]'),
('warping_sizing', 'Warping & Sizing Operator', '["/warping-sizing"]'),
('weaving', 'Weaving Operator', '["/weaving", "/processing"]'),
('inspection', 'Inspection/QC Officer', '["/inspection/four-point", "/inspection/unwashed", "/inspection/washed", "/inspection/report", "/processing"]')
ON CONFLICT (role_name) DO UPDATE 
SET label = EXCLUDED.label, sidebar_links = EXCLUDED.sidebar_links;

-- 5. Update create_user_admin to use TEXT role (remove enum typecast)
CREATE OR REPLACE FUNCTION create_user_admin(
  p_email TEXT,
  p_password TEXT,
  p_full_name TEXT,
  p_role TEXT
) RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
  v_encrypted_password TEXT;
BEGIN
  -- Security check: only allow admins
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied: User is not an administrator';
  END IF;

  -- Encrypt password
  v_encrypted_password := extensions.crypt(p_password, extensions.gen_salt('bf'));

  -- Insert into auth.users
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    p_email,
    v_encrypted_password,
    now(),
    '{"provider": "email", "providers": ["email"]}',
    jsonb_build_object('full_name', p_full_name),
    now(),
    now(),
    '',
    '',
    '',
    ''
  ) RETURNING id INTO v_user_id;

  -- Insert into auth.identities
  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    v_user_id,
    jsonb_build_object('sub', v_user_id, 'email', p_email),
    'email',
    p_email,
    now(),
    now(),
    now()
  );

  -- Insert public.profiles
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (v_user_id, p_email, p_full_name, p_role)
  ON CONFLICT (id) DO UPDATE
  SET email = p_email, full_name = p_full_name, role = p_role;

  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Update update_user_admin to use TEXT role (remove enum typecast)
CREATE OR REPLACE FUNCTION update_user_admin(
  p_user_id UUID,
  p_email TEXT,
  p_password TEXT,
  p_full_name TEXT,
  p_role TEXT
) RETURNS VOID AS $$
BEGIN
  -- Security check: only allow admins
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied: User is not an administrator';
  END IF;

  -- Update auth.users
  IF p_password IS NOT NULL AND p_password <> '' THEN
    UPDATE auth.users
    SET email = p_email,
        encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
        updated_at = now()
    WHERE id = p_user_id;
  ELSE
    UPDATE auth.users
    SET email = p_email,
        updated_at = now()
    WHERE id = p_user_id;
  END IF;

  -- Update auth.identities
  UPDATE auth.identities
  SET identity_data = jsonb_build_object('sub', p_user_id, 'email', p_email),
      provider_id = p_email,
      updated_at = now()
  WHERE user_id = p_user_id;

  -- Update public.profiles
  UPDATE public.profiles
  SET email = p_email,
      full_name = p_full_name,
      role = p_role
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
