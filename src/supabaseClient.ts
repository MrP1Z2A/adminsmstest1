
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Fallback to prevent "supabaseUrl is required" error on startup 
// while the user is still configuring their environment.
const effectiveUrl = supabaseUrl || 'https://lzlhsmtkkcpomabqaqdu.supabase.co';
const effectiveKey = supabaseAnonKey || 'sb_publishable_wTAOBsSeZ-3V-pFwHzqy5w_5xyOng6-';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase configuration missing in .env.local. Using placeholders.');
}

export const supabase = createClient(effectiveUrl, effectiveKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
