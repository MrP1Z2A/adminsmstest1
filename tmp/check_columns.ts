
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lzlhsmtkkcpomabqaqdu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6bGhzbXRra2Nwb21hYnFhcWR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxMTc0ODksImV4cCI6MjA4NTY5MzQ4OX0.Tmday5nk3oElp1UMZCjeTfLBefw4oOLBOIfcAb__DYE';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
  const { data, error } = await supabase.rpc('get_table_columns_v2', { t_name: 'students' });
  // Since I don't know if get_table_columns_v2 exists, I'll try a direct query if possible, 
  // but Supabase usually blocks information_schema via RPC unless defined.
  // I'll try to select a non-existent column to see the error message which might listed allowed columns.
  
  const { error: error2 } = await supabase
    .from('students')
    .select('non_existent_column_for_schema_check');
    
  if (error2) {
    console.log('Error message (might contain column names):', error2.message);
  }
}

checkColumns();
