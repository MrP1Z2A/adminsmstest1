import { Student } from '../types';

export type ParentRole = 'Primary Parent' | 'Secondary Parent';

export type ParentEntry = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: ParentRole;
  students: Student[];
};

const getNormalizedText = (value: string | undefined) => String(value || '').trim();

const buildParentKey = (name: string, phone: string, email: string, role: ParentRole) => {
  return [name.toLowerCase(), phone.toLowerCase(), email.toLowerCase(), role.toLowerCase()].join('|');
};

export const buildParentEntries = (students: Student[]) => {
  const parentMap = new Map<string, ParentEntry>();

  students.forEach((student) => {
    const parentCandidates: Array<{ role: ParentRole; name?: string; phone?: string; email?: string }> = [
      {
        role: 'Primary Parent',
        name: student.parent_name,
        phone: student.parent_number,
        email: student.parent_email,
      },
      {
        role: 'Secondary Parent',
        name: student.secondary_parent_name,
        phone: student.secondary_parent_number,
        email: student.secondary_parent_email,
      },
    ];

    parentCandidates.forEach((parentCandidate) => {
      const name = getNormalizedText(parentCandidate.name);
      const phone = getNormalizedText(parentCandidate.phone);
      const email = getNormalizedText(parentCandidate.email);

      if (!name && !phone && !email) {
        return;
      }

      const key = buildParentKey(name, phone, email, parentCandidate.role);
      const existing = parentMap.get(key);

      if (existing) {
        existing.students.push(student);
        return;
      }

      parentMap.set(key, {
        id: key,
        name: name || 'Unnamed Parent',
        phone,
        email,
        role: parentCandidate.role,
        students: [student],
      });
    });
  });

  return Array.from(parentMap.values()).sort((left, right) => left.name.localeCompare(right.name));
};

export const formatStudentDate = (value?: string) => {
  if (!value) return '—';
  return value;
};
