import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fxoxaovxilwhzlefautn.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4b3hhb3Z4aWx3aHpsZWZhdXRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MDgyMDYsImV4cCI6MjA5MTI4NDIwNn0.5HvOYyAKg79BR1MaZkX-obpwCT4PJbKVOW0vChAOMLE';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  await supabase.auth.signInWithPassword({
    email: 'tharun@at.com',
    password: 'admin123'
  });

  const { data: receipts, error } = await supabase
    .from('dyed_yarn_receipts')
    .select('*, dyeing_unit:master_partners(partner_name)')
    .order('dyrr_number');

  if (error) {
    console.error('Error fetching receipts:', error);
    return;
  }

  console.log('Receipts list:');
  receipts.forEach(r => {
    console.log(`ID: ${r.id}, No: ${r.dyrr_number}, DOF ID: ${r.dof_id}, DOF No: ${r.dof_number}, Unit: ${r.dyeing_unit?.partner_name}, Date: ${r.received_date}`);
  });
}

check();
