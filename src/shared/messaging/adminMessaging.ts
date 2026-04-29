const ADMIN_MESSAGING_PREFIX = 'school-admin';

export const buildAdminMessagingId = (schoolId: string) => {
  const normalizedSchoolId = String(schoolId || '').trim();
  return `${ADMIN_MESSAGING_PREFIX}:${normalizedSchoolId || 'unknown'}`;
};

export const isAdminMessagingId = (value?: string | null, schoolId?: string) => {
  const normalizedValue = String(value || '').trim();
  if (!normalizedValue) return false;

  if (schoolId) {
    return normalizedValue === buildAdminMessagingId(schoolId);
  }

  return normalizedValue.startsWith(`${ADMIN_MESSAGING_PREFIX}:`);
};

export const getAdminMessagingName = (schoolName?: string | null) => {
  const normalizedSchoolName = String(schoolName || '').trim();
  return normalizedSchoolName ? `${normalizedSchoolName} Administration` : 'School Administration';
};
