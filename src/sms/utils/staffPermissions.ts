const STAFF_PERMISSION_ITEM_IDS = [
  'dashboard',
  'live-calendar',
  'students',
  'parents',
  'student-achievements',
  'student-register',
  'teachers',
  'teacher-register',
  'student-service',
  'student-service-batch',
  'student-attendance',
  'sms-attendance',
  'class-group-management',
  'homework',
  'report-card',
  'notice',
  'events',
  'student-activities',
  'announcements-parent',
  'class-announcements',
  'live-intel',
  'payment',
  'payment-assign',
  'payment-history',
  'student-finance-status',
  'exam',
  'about-school',
  'security',
  'messages',
] as const;

export const STAFF_PERMISSION_ITEM_SET = new Set<string>(STAFF_PERMISSION_ITEM_IDS);

export const DEFAULT_STAFF_ALLOWED_PAGES: string[] = ['dashboard', 'students', 'about-school', 'messages'];

const dedupePermissions = (items: string[]) => Array.from(new Set(items));

const normalizePermissionArray = (items: unknown[]) => dedupePermissions(
  items
    .map((item) => String(item || '').trim())
    .filter((item) => STAFF_PERMISSION_ITEM_SET.has(item))
);

export const normalizeStaffAllowedPages = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return normalizePermissionArray(value);
  }

  if (!value || typeof value !== 'object') {
    return [];
  }

  const candidate = value as Record<string, unknown>;

  if (Array.isArray(candidate.allowedPages)) {
    return normalizePermissionArray(candidate.allowedPages);
  }

  return dedupePermissions(
    Object.entries(candidate)
      .filter(([key, enabled]) => Boolean(enabled) && STAFF_PERMISSION_ITEM_SET.has(key))
      .map(([key]) => key)
  );
};
