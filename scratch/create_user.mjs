/**
 * Script to find an existing Supabase user by email and set their profile role to 'admin'.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://fxoxaovxilwhzlefautn.supabase.co';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const EMAIL    = 'tharun@at.com';
const PASSWORD = 'admin123';
const ROLE     = 'admin';
const FULLNAME = 'Tharun';

async function run() {
  // 1. List users and find by email
  console.log(`Looking up existing user: ${EMAIL}...`);
  const { data: listData, error: listError } = await supabase.auth.admin.listUsers();

  if (listError) {
    console.error('❌  Could not list users:', listError.message);
    process.exit(1);
  }

  const existingUser = listData.users.find(u => u.email === EMAIL);

  let userId;

  if (existingUser) {
    userId = existingUser.id;
    console.log(`✅  Found existing user. ID: ${userId}`);

    // Update password to ensure it's correct
    console.log('Updating password...');
    const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
      password: PASSWORD,
      email_confirm: true
    });
    if (updateError) {
      console.error('❌  Password update failed:', updateError.message);
    } else {
      console.log('✅  Password updated.');
    }
  } else {
    // Create fresh
    console.log('User not found — creating new auth user...');
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true
    });
    if (authError) {
      console.error('❌  Auth user creation failed:', authError.message);
      process.exit(1);
    }
    userId = authData.user.id;
    console.log(`✅  Auth user created. ID: ${userId}`);
  }

  // 2. Upsert the profile row with role = 'admin'
  console.log(`Setting profile role to '${ROLE}'...`);
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      full_name: FULLNAME,
      email: EMAIL,
      role: ROLE
    }, { onConflict: 'id' });

  if (profileError) {
    console.error('❌  Profile upsert failed:', profileError.message);
    process.exit(1);
  }

  console.log('');
  console.log('══════════════════════════════════════════');
  console.log('  ✅  User ready!');
  console.log(`  Email   : ${EMAIL}`);
  console.log(`  Password: ${PASSWORD}`);
  console.log(`  Role    : ${ROLE}`);
  console.log('══════════════════════════════════════════');
}

run().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
