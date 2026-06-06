import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fxoxaovxilwhzlefautn.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4b3hhb3Z4aWx3aHpsZWZhdXRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MDgyMDYsImV4cCI6MjA5MTI4NDIwNn0.5HvOYyAKg79BR1MaZkX-obpwCT4PJbKVOW0vChAOMLE';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  console.log('Querying all greige_yarn_receipts...');
  const { data, error } = await supabase
    .from('greige_yarn_receipts')
    .select('*');
  console.log('All receipts count:', data?.length);
  console.log('Sample receipts:', JSON.stringify(data?.slice(0, 5), null, 2));
  console.log('Error:', error);
}

test();
