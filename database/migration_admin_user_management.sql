-- 1. Function to create a user in auth.users and profiles
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

  -- Encrypt password using pgcrypto (Supabase auth uses bcrypt)
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

  -- Insert/update public.profiles
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (v_user_id, p_email, p_full_name, p_role::user_role)
  ON CONFLICT (id) DO UPDATE
  SET email = p_email, full_name = p_full_name, role = p_role::user_role;

  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Function to update a user
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
      role = p_role::user_role
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Function to delete a user
CREATE OR REPLACE FUNCTION delete_user_admin(
  p_user_id UUID
) RETURNS VOID AS $$
BEGIN
  -- Security check: only allow admins
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied: User is not an administrator';
  END IF;

  -- Delete public.profiles
  DELETE FROM public.profiles WHERE id = p_user_id;

  -- Delete auth.identities
  DELETE FROM auth.identities WHERE user_id = p_user_id;

  -- Delete auth.users
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
