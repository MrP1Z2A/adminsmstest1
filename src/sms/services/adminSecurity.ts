import { supabase } from '../supabaseClient';
import { hashPassword } from './cryptoUtils';

const getStoredAdminPasswordHash = async (schoolId: string) => {
  const { data: securitySettings, error: securityError } = await supabase
    .from('admin_security_settings')
    .select('delete_password_hash')
    .eq('school_id', schoolId)
    .maybeSingle();

  if (securityError) {
    throw securityError;
  }

  if (securitySettings?.delete_password_hash) {
    return String(securitySettings.delete_password_hash);
  }

  const { data: school, error: schoolError } = await supabase
    .from('schools')
    .select('password_hash')
    .eq('id', schoolId)
    .maybeSingle();

  if (schoolError) {
    throw schoolError;
  }

  return school?.password_hash ? String(school.password_hash) : '';
};

export const verifySchoolAdminPassword = async (schoolId: string, password: string) => {
  const normalizedSchoolId = String(schoolId || '').trim();
  const normalizedPassword = String(password || '');

  if (!normalizedSchoolId || !normalizedPassword.trim()) {
    return false;
  }

  const hashedPass = await hashPassword(normalizedPassword);
  const storedHash = await getStoredAdminPasswordHash(normalizedSchoolId);
  return Boolean(storedHash) && storedHash === hashedPass;
};
