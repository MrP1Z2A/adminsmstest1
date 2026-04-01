
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lzlhsmtkkcpomabqaqdu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6bGhzbXRra2Nwb21hYnFhcWR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxMTc0ODksImV4cCI6MjA4NTY5MzQ4OX0.Tmday5nk3oElp1UMZCjeTfLBefw4oOLBOIfcAb__DYE';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error fetching student:', error.message);
    return;
  }

  if (data && data.length > 0) {
    console.log('Student columns:', Object.keys(data[0]).join(', '));
  } else {
    console.log('No students found to check schema.');
  }
}

checkSchema();
