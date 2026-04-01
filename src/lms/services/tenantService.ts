import { supabase } from '../src/supabaseClient';

export type TenantContext = {
  userId: string;
  schoolId: string;
  role: string;
};

export const getCurrentTenantContext = async (): Promise<TenantContext> => {
  if (!supabase) throw new Error('Supabase client not initialized.');
  
  // 1. Check for session first
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('Auth session missing! Please sign in.');
  }

  const user = session.user;
  if (!user?.id) {
    throw new Error('User context not found in session.');
  }

  let profile: any = null;
  let profileError: any = null;
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    if (!supabase) break;
    
    // Attempt 1: Check profiles table
    const { data: pData, error: pError } = await supabase
      .from('profiles')
      .select('school_id, role')
      .eq('id', user.id)
      .maybeSingle();
      
    if (pData) {
      profile = pData;
      break;
    }

    // Attempt 2: Fallback to students table for student context
    const { data: sData, error: sError } = await supabase
      .from('students')
      .select('school_id')
      .eq('email', user.email)
      .maybeSingle();

    if (sData) {
      profile = { school_id: sData.school_id, role: 'student' };
      break;
    }

    profileError = pError || sError;
    attempts++;
    if (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 800)); // Increase delay
    }
  }

  if (!profile) {
    console.warn(`Tenant resolution failed for user ${user.id} after ${attempts} attempts`);
    throw new Error('Sync Failed: No school profile or student record found.');
  }

  const schoolId = String(profile.school_id || '').trim();
  if (!schoolId) {
    throw new Error('Sync Failed: No school is assigned to this account.');
  }

  return {
    userId: user.id,
    schoolId,
    role: String(profile.role || 'student'),
  };
};

export const withSchoolId = <T extends Record<string, any>>(payload: T, schoolId: string): T & { school_id: string } => ({
  ...payload,
  school_id: schoolId,
});

export const withSchoolIdRows = <T extends Record<string, any>>(rows: T[], schoolId: string): Array<T & { school_id: string }> => (
  rows.map((row) => ({ ...row, school_id: schoolId }))
);
