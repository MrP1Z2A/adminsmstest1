import React from 'react';
import { supabase } from '../../supabaseClient';

type UserRole = 'super_admin' | 'teacher' | 'student' | 'student_service';

type SecurityPermissionProps = {
  role?: UserRole;
};

type RoleConfig = {
  role: UserRole | string;
  title: string;
  badge: string;
  icon: string;
  accentClass: string;
  permissions: string[];
};

const roleConfigs: RoleConfig[] = [
  {
    role: 'super_admin',
    title: 'Super Admin Control',
    badge: 'Root Access',
    icon: 'fa-shield-halved',
    accentClass: 'bg-brand-500 text-white',
    permissions: [
      'Manage all users and system roles',
      'Control security policy and audit access',
      'Approve financial and academic configuration changes',
      'Review deletion, export, and privileged actions',
    ],
  },
  {
    role: 'teacher',
    title: 'Teacher Access',
    badge: 'Academic Role',
    icon: 'fa-chalkboard-user',
    accentClass: 'bg-sky-100 text-sky-700',
    permissions: [
      'Manage attendance, exams, homework, and grading',
      'Open class pages and update course resources',
      'View student academic records assigned to their classes',
      'Cannot change security rules or system-wide permissions',
    ],
  },
  {
    role: 'student',
    title: 'Student Access',
    badge: 'Portal Role',
    icon: 'fa-user-graduate',
    accentClass: 'bg-emerald-100 text-emerald-700',
    permissions: [
      'View assignments, report cards, and approved class materials',
      'Check timetable and attendance visibility where allowed',
      'Access only personal academic information',
      'Cannot manage users or modify security controls',
    ],
  },
  {
    role: 'student_service',
    title: 'Student Service Staff',
    badge: 'Service Role',
    icon: 'fa-user-tie',
    accentClass: 'bg-cyan-100 text-cyan-700',
    permissions: [
      'Assist students with enrollment, queries, and support requests',
      'Access student contact and registration information',
      'Coordinate with teachers and admin for student welfare',
      'Cannot modify academic records or security configurations',
    ],
  },
];

type AccessRow = {
  id: string;
  name: string;
  email: string;
  role: 'Teacher' | 'Student' | 'Staff';
  status: string;
  createdAt: string;
};

const restrictedActionMap: Record<Exclude<UserRole, 'super_admin'>, Array<{ title: string; description: string; icon: string; accent: string }>> = {
  teacher: [
    {
      title: 'Manage Academic Workflows',
      description: 'Continue handling attendance, homework, report cards, and exams.',
      icon: 'fa-book-open-reader',
      accent: 'bg-sky-100 text-sky-700',
    },
    {
      title: 'Request Elevated Access',
      description: 'Ask a Super Admin to grant or adjust higher-level permissions.',
      icon: 'fa-key',
      accent: 'bg-amber-100 text-amber-700',
    },
  ],
  student: [
    {
      title: 'View Academic Records',
      description: 'Check only your personal timetable, results, and assigned materials.',
      icon: 'fa-file-lines',
      accent: 'bg-emerald-100 text-emerald-700',
    },
    {
      title: 'Restricted Security Access',
      description: 'Security configuration is available only to Super Admin accounts.',
      icon: 'fa-lock',
      accent: 'bg-rose-100 text-rose-700',
    },
  ],
  student_service: [
    {
      title: 'Student Support Operations',
      description: 'Handle student enrollment queries, support requests, and service coordination.',
      icon: 'fa-user-tie',
      accent: 'bg-cyan-100 text-cyan-700',
    },
    {
      title: 'Restricted Security Access',
      description: 'Security configuration is available only to Super Admin accounts.',
      icon: 'fa-lock',
      accent: 'bg-rose-100 text-rose-700',
    },
  ],
};

const formatCreatedDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleDateString();
};

const SecurityPermission: React.FC<SecurityPermissionProps> = ({ role = 'super_admin' }) => {
  const currentRoleConfig = roleConfigs.find((entry) => entry.role === role) || roleConfigs[0];
  const [accessRows, setAccessRows] = React.useState<AccessRow[]>([]);
  const [isUsersLoading, setIsUsersLoading] = React.useState(false);
  const [usersLoadError, setUsersLoadError] = React.useState<string | null>(null);
  const [userSearch, setUserSearch] = React.useState('');

  React.useEffect(() => {
    if (role !== 'super_admin') return;

    const loadUsers = async () => {
      setIsUsersLoading(true);
      setUsersLoadError(null);

      const studentsResult = await supabase
        .schema('public')
        .from('students')
        .select('id, name, email, status, created_at')
        .order('created_at', { ascending: false });

      const teachersOrderedResult = await supabase
        .schema('public')
        .from('teachers')
        .select('id, name, email, status, created_at')
        .order('created_at', { ascending: false });

      const staffOrderedResult = await supabase
        .schema('public')
        .from('student_services')
        .select('id, name, email, status, created_at')
        .order('created_at', { ascending: false });

      let teachersData: any[] = [];
      let teachersError: any = teachersOrderedResult.error;

      if (!teachersOrderedResult.error && Array.isArray(teachersOrderedResult.data)) {
        teachersData = teachersOrderedResult.data;
      } else {
        const teachersFallbackResult = await supabase
          .schema('public')
          .from('teachers')
          .select('id, name, email, status, created_at');

        teachersError = teachersFallbackResult.error;
        teachersData = Array.isArray(teachersFallbackResult.data) ? teachersFallbackResult.data : [];
      }

      let staffData: any[] = [];
      if (!staffOrderedResult.error && Array.isArray(staffOrderedResult.data)) {
        staffData = staffOrderedResult.data;
      } else {
        const staffFallbackResult = await supabase
          .schema('public')
          .from('student_services')
          .select('id, name, email, status, created_at');
        staffData = Array.isArray(staffFallbackResult.data) ? staffFallbackResult.data : [];
      }

      const studentsData = Array.isArray(studentsResult.data) ? studentsResult.data : [];

      if (studentsResult.error && teachersError) {
        setAccessRows([]);
        setUsersLoadError(studentsResult.error.message || teachersError.message || 'Failed to load users.');
        setIsUsersLoading(false);
        return;
      }

      const rows: AccessRow[] = [
        ...teachersData.map((teacher: any) => ({
          id: String(teacher.id || ''),
          name: String(teacher.name || 'Unnamed Teacher'),
          email: String(teacher.email || 'No email'),
          role: 'Teacher' as const,
          status: String(teacher.status || 'Active'),
          createdAt: String(teacher.created_at || ''),
        })),
        ...staffData.map((staff: any) => ({
          id: String(staff.id || ''),
          name: String(staff.name || 'Unnamed Staff'),
          email: String(staff.email || 'No email'),
          role: 'Staff' as const,
          status: String(staff.status || 'Active'),
          createdAt: String(staff.created_at || ''),
        })),
        ...studentsData.map((student: any) => ({
          id: String(student.id || ''),
          name: String(student.name || 'Unnamed Student'),
          email: String(student.email || 'No email'),
          role: 'Student' as const,
          status: String(student.status || 'Active'),
          createdAt: String(student.created_at || ''),
        })),
      ];

      rows.sort((left, right) => (right.createdAt || '').localeCompare(left.createdAt || ''));
      setAccessRows(rows);

      if (studentsResult.error || teachersError) {
        setUsersLoadError(studentsResult.error?.message || teachersError?.message || null);
      }

      setIsUsersLoading(false);
    };

    void loadUsers();
  }, [role]);

  const securityStats = React.useMemo(() => {
    const teachersCount = accessRows.filter((entry) => entry.role === 'Teacher').length;
    const studentsCount = accessRows.filter((entry) => entry.role === 'Student').length;
    const staffCount = accessRows.filter((entry) => entry.role === 'Staff').length;

    return {
      protectedRoles: 4,
      liveAccounts: accessRows.length,
      teachersCount,
      studentsCount,
      staffCount,
    };
  }, [accessRows]);

  if (role !== 'super_admin') {
    return (
      <div className="space-y-8 animate-in fade-in duration-700 pb-20">
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-brand-500 rounded-[40px] p-6 sm:p-8 lg:p-10 text-white shadow-premium">
          <p className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-brand-100">Security Permission</p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tighter mt-2">Access Restricted</h2>
          <p className="text-slate-200 mt-3 text-sm sm:text-base max-w-3xl">
            You are signed in as {role.replace('_', ' ')}. Only Super Admin accounts can modify system security permissions.
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-[32px] sm:rounded-[48px] p-6 sm:p-8 border border-slate-100 dark:border-slate-800 shadow-premium">
          <div className="flex items-start gap-4">
            <div className={`w-16 h-16 rounded-[20px] flex items-center justify-center text-2xl ${currentRoleConfig.accentClass}`}>
              <i className={`fas ${currentRoleConfig.icon}`}></i>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Current Role</p>
              <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-900 dark:text-white">{currentRoleConfig.title}</h3>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">Your account can continue using the academic tools listed below.</p>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
            {(restrictedActionMap[role as Exclude<UserRole, 'super_admin'>] || []).map((item) => (
              <div key={item.title} className="rounded-[28px] border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-5">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg ${item.accent}`}>
                  <i className={`fas ${item.icon}`}></i>
                </div>
                <h4 className="mt-4 text-lg font-black tracking-tight text-slate-900 dark:text-white">{item.title}</h4>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-brand-500 rounded-[40px] p-6 sm:p-8 lg:p-10 text-white shadow-premium">
        <p className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-brand-100">Security Permission</p>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tighter mt-2">System Access Control</h2>
        <p className="text-slate-200 mt-3 text-sm sm:text-base max-w-3xl">
          Review role-based access, monitor privileged users, and keep core administrative actions locked behind approval.
        </p>
      </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        {[
          { label: 'Protected Roles', value: String(securityStats.protectedRoles), note: 'Super Admin, Teacher, Staff, Student' },
          { label: 'Live Accounts', value: String(securityStats.liveAccounts), note: 'Loaded from all tables' },
          { label: 'Teachers', value: String(securityStats.teachersCount), note: 'Accounts in public.teachers' },
          { label: 'Students', value: String(securityStats.studentsCount), note: 'Accounts in public.students' },
          { label: 'Service Staff', value: String(securityStats.staffCount), note: 'Accounts in public.student_services' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-100 dark:border-slate-800 p-5 shadow-premium">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{stat.label}</p>
            <p className="mt-3 text-3xl font-black tracking-tight text-slate-900 dark:text-white">{stat.value}</p>
            <p className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-300">{stat.note}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {roleConfigs.map((config) => (
          <div key={config.role} className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 p-6 sm:p-8 shadow-premium">
            <div className="flex items-start justify-between gap-4">
              <div className={`w-14 h-14 rounded-[20px] flex items-center justify-center text-xl ${config.accentClass}`}>
                <i className={`fas ${config.icon}`}></i>
              </div>
              <span className="inline-flex px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                {config.badge}
              </span>
            </div>

            <h3 className="mt-5 text-2xl font-black tracking-tight text-slate-900 dark:text-white">{config.title}</h3>
            <div className="mt-5 space-y-3">
              {config.permissions.map((permission) => (
                <div key={permission} className="flex items-start gap-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 px-4 py-3">
                  <span className="mt-0.5 w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] shrink-0">
                    <i className="fas fa-check"></i>
                  </span>
                  <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">{permission}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[32px] sm:rounded-[48px] border border-slate-100 dark:border-slate-800 shadow-premium overflow-hidden">
        <div className="p-6 sm:p-8 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">User Access Control</p>
            <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-900 dark:text-white">Student, Teacher & Service Staff Access Review</h3>
          </div>
          <div className="relative w-full sm:w-72">
            <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none"></i>
            <input
              type="text"
              placeholder="Search by name, email or ID..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-brand-500 outline-none text-sm font-semibold text-slate-700 dark:text-slate-200 placeholder-slate-400 transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/70 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Created At</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isUsersLoading && (
                <tr>
                  <td className="px-6 py-6 text-sm font-semibold text-slate-500" colSpan={5}>Loading users from Supabase...</td>
                </tr>
              )}

              {!isUsersLoading && accessRows.length === 0 && (
                <tr>
                  <td className="px-6 py-6 text-sm font-semibold text-slate-500" colSpan={5}>No student, teacher, or service staff users found.</td>
                </tr>
              )}

              {!isUsersLoading && accessRows.filter((entry) => {
                const q = userSearch.trim().toLowerCase();
                if (!q) return true;
                return (
                  entry.name.toLowerCase().includes(q) ||
                  entry.email.toLowerCase().includes(q) ||
                  entry.id.toLowerCase().includes(q)
                );
              }).map((entry) => (
                <tr key={entry.email} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-all">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-brand-500/10 text-brand-500 flex items-center justify-center font-black">
                        {entry.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-900 dark:text-white">{entry.name} <span className="text-[10px] text-slate-400">({entry.id || 'N/A'})</span></p>
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-300">{entry.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] ${
                      entry.role === 'Teacher' ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300'
                      : entry.role === 'Staff' ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300'
                      : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                    }`}>
                      {entry.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.15em] ${entry.status.toLowerCase() === 'active' ? 'text-emerald-600' : 'text-amber-600'}`}>
                      <span className={`w-2 h-2 rounded-full ${entry.status.toLowerCase() === 'active' ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                      {entry.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-slate-500 dark:text-slate-300">{formatCreatedDate(entry.createdAt)}</td>
                  <td className="px-6 py-4 text-right">
                    <button className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-brand-500 transition-all">
                      <i className="fas fa-gear"></i>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {usersLoadError && (
          <div className="px-6 pb-6">
            <p className="text-sm font-semibold text-amber-700 bg-amber-50 rounded-2xl px-4 py-3">
              {usersLoadError}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SecurityPermission;
