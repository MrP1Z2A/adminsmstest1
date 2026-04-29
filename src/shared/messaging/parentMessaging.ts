export type ParentMessagingStudentRecord = {
  id?: string | null;
  name?: string | null;
  avatar?: string | null;
  parent_name?: string | null;
  parent_email?: string | null;
  secondary_parent_name?: string | null;
  secondary_parent_email?: string | null;
};

export type ParentMessagingUser = {
  id: string;
  name: string;
  email: string;
  role: 'parent';
  avatar?: string;
  studentIds: string[];
  studentNames: string[];
};

export const normalizeParentMessagingEmail = (value?: string | null) =>
  String(value || '').trim().toLowerCase();

export const getFallbackParentName = (email?: string | null) => {
  const normalizedEmail = normalizeParentMessagingEmail(email);
  const localPart = normalizedEmail.split('@')[0] || '';
  const cleaned = localPart.replace(/[._-]+/g, ' ').trim();

  if (!cleaned) return 'Parent';

  return cleaned.replace(/\b\w/g, (char) => char.toUpperCase());
};

export const buildParentMessagingId = (schoolId: string, email: string) =>
  `parent:${String(schoolId || '').trim()}:${normalizeParentMessagingEmail(email)}`;

export const isParentMessagingId = (value?: string | null, schoolId?: string) => {
  const normalizedValue = String(value || '').trim();
  if (!normalizedValue.startsWith('parent:')) return false;
  if (!schoolId) return true;

  return normalizedValue.startsWith(`parent:${String(schoolId).trim()}:`);
};

export const buildParentMessagingUsers = (
  schoolId: string,
  students: ParentMessagingStudentRecord[]
): ParentMessagingUser[] => {
  const parentMap = new Map<string, ParentMessagingUser>();

  students.forEach((student) => {
    const studentId = String(student.id || '').trim();
    const studentName = String(student.name || '').trim();
    const candidates = [
      {
        email: normalizeParentMessagingEmail(student.parent_email),
        name: String(student.parent_name || '').trim(),
      },
      {
        email: normalizeParentMessagingEmail(student.secondary_parent_email),
        name: String(student.secondary_parent_name || '').trim(),
      },
    ];

    candidates.forEach((candidate) => {
      if (!candidate.email) return;

      const parentId = buildParentMessagingId(schoolId, candidate.email);
      const existing = parentMap.get(parentId);

      if (existing) {
        if (!existing.name || existing.name === 'Parent') {
          existing.name = candidate.name || existing.name || getFallbackParentName(candidate.email);
        }
        if (studentId && !existing.studentIds.includes(studentId)) {
          existing.studentIds.push(studentId);
        }
        if (studentName && !existing.studentNames.includes(studentName)) {
          existing.studentNames.push(studentName);
        }
        return;
      }

      parentMap.set(parentId, {
        id: parentId,
        name: candidate.name || getFallbackParentName(candidate.email),
        email: candidate.email,
        role: 'parent',
        avatar: student.avatar ? String(student.avatar) : undefined,
        studentIds: studentId ? [studentId] : [],
        studentNames: studentName ? [studentName] : [],
      });
    });
  });

  return Array.from(parentMap.values()).sort((left, right) => left.name.localeCompare(right.name));
};

export const findParentMessagingUserByEmail = (
  schoolId: string,
  students: ParentMessagingStudentRecord[],
  email: string
) => {
  const normalizedEmail = normalizeParentMessagingEmail(email);
  if (!normalizedEmail) return null;

  return buildParentMessagingUsers(schoolId, students)
    .find((parent) => parent.email === normalizedEmail) || null;
};
