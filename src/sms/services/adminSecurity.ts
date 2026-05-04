import { supabase } from '../supabaseClient';
import { hashPassword } from './cryptoUtils';

export const updateSchoolDeletePassword = async (schoolId: string, password: string) => {
  const normalizedSchoolId = String(schoolId || '').trim();
  const normalizedPassword = String(password || '').trim();

  if (!normalizedSchoolId) {
    throw new Error('School context is missing.');
  }

  if (!normalizedPassword) {
    throw new Error('Please enter a password.');
  }

  const hashedPass = await hashPassword(normalizedPassword);
  const { error } = await supabase
    .from('admin_security_settings')
    .upsert(
      {
        school_id: normalizedSchoolId,
        delete_password_hash: hashedPass,
      },
      { onConflict: 'school_id' }
    );

  if (error) {
    throw error;
  }
};

export const updateSchoolLoginPassword = async (schoolId: string, password: string) => {
  const normalizedSchoolId = String(schoolId || '').trim();
  const normalizedPassword = String(password || '').trim();

  if (!normalizedSchoolId) {
    throw new Error('School context is missing.');
  }

  if (!normalizedPassword) {
    throw new Error('School password is required.');
  }

  if (normalizedPassword.length < 8) {
    throw new Error('School password must be at least 8 characters long.');
  }

  const hashedPass = await hashPassword(normalizedPassword);
  const { data, error } = await supabase
    .from('schools')
    .update({
      password_hash: hashedPass,
    })
    .eq('id', normalizedSchoolId)
    .select('id')
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data?.id) {
    throw new Error('School login password could not be updated.');
  }
};

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
