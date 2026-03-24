import React from 'react';
import { supabase } from '../src/supabaseClient';

type Student = {
  id: string;
  name: string;
  email?: string;
};

type AttendanceContextType = 'class' | 'subject';
type AttendanceStatus = 'P' | 'A' | 'L';

interface LightweightClass {
  id: string;
  name: string;
  student_ids?: string[];
}

interface LightweightSubject {
  id: string;
  name: string;
}

interface DailyAttendancePageProps {
  students: Student[];
  allStudents?: Student[];
  classes?: LightweightClass[];
  subjects?: LightweightSubject[];
  notify?: (message: string) => void;
  schoolId?: string;
}

const getTodayIsoDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const DailyAttendancePage: React.FC<DailyAttendancePageProps> = ({
  students,
  allStudents,
  classes = [],
  subjects = [],
  notify,
  schoolId,
}) => {
  if (!supabase) {
    return (
      <section className="space-y-6">
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 p-5 sm:p-6">
          <h2 className="text-xl sm:text-2xl font-black tracking-tight">Daily Attendance</h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">Supabase is not configured.</p>
        </div>
      </section>
    );
  }

  const db = supabase;

  const [contextType, setContextType] = React.useState<AttendanceContextType>('class');
  const [selectedContextId, setSelectedContextId] = React.useState<string>('');
  const [attendanceDate, setAttendanceDate] = React.useState(getTodayIsoDate());
  const [attendanceMap, setAttendanceMap] = React.useState<Record<string, AttendanceStatus>>({});
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

  const activeContextList = contextType === 'class' ? classes : subjects;

  React.useEffect(() => {
    if (!activeContextList.length) {
      setSelectedContextId('');
      return;
    }

    const exists = activeContextList.some(item => String(item.id) === String(selectedContextId));
    if (!exists) {
      setSelectedContextId(String(activeContextList[0].id));
    }
  }, [activeContextList, selectedContextId]);

  const activeStudents = React.useMemo(() => {
    if (!selectedContextId) return [] as Student[];

    if (contextType === 'class') {
      const selectedClass = classes.find(classItem => String(classItem.id) === String(selectedContextId));
      const ids = (selectedClass?.student_ids || []).map(id => String(id));
      const source = allStudents && allStudents.length > 0 ? allStudents : students;
      return source.filter(student => ids.includes(String(student.id)));
    }

    return students;
  }, [contextType, selectedContextId, classes, allStudents, students]);

  const loadAttendance = React.useCallback(async () => {
    if (!selectedContextId || !attendanceDate) return;

    setIsLoading(true);

    const { data, error } = await db
      .from('attendance_records')
      .select('student_id, status')
      .eq('context_type', contextType)
      .eq('context_id', selectedContextId)
      .eq('attendance_date', attendanceDate)
      .eq('school_id', schoolId);

    if (error) {
      notify?.(`Failed to load attendance: ${error.message}`);
      setIsLoading(false);
      return;
    }

    const nextMap: Record<string, AttendanceStatus> = {};
    (data || []).forEach((row: any) => {
      nextMap[String(row.student_id)] = row.status as AttendanceStatus;
    });

    setAttendanceMap(nextMap);
    setIsLoading(false);
  }, [selectedContextId, attendanceDate, contextType, notify]);

  React.useEffect(() => {
    void loadAttendance();
  }, [loadAttendance]);

  const saveSingle = async (studentId: string, status: AttendanceStatus) => {
    if (!selectedContextId || !attendanceDate) return;

    setIsSaving(true);

    const payload = {
      context_type: contextType,
      context_id: selectedContextId,
      attendance_date: attendanceDate,
      student_id: String(studentId),
      status,
      school_id: schoolId,
    };

    const upsertResult = await db
      .from('attendance_records')
      .upsert([payload], { onConflict: 'context_type,context_id,attendance_date,student_id' });

    setIsSaving(false);

    if (upsertResult.error) {
      notify?.(`Failed to save attendance: ${upsertResult.error.message}`);
      return;
    }

    setAttendanceMap(prev => ({ ...prev, [String(studentId)]: status }));
  };

  const markAllPresent = async () => {
    if (!selectedContextId || !attendanceDate || activeStudents.length === 0) {
      notify?.('No students available to mark.');
      return;
    }

    setIsSaving(true);

    const payload = activeStudents.map(student => ({
      context_type: contextType,
      context_id: selectedContextId,
      attendance_date: attendanceDate,
      student_id: String(student.id),
      status: 'P' as const,
      school_id: schoolId,
    }));

    const upsertResult = await db
      .from('attendance_records')
      .upsert(payload, { onConflict: 'context_type,context_id,attendance_date,student_id' });

    setIsSaving(false);

    if (upsertResult.error) {
      notify?.(`Failed to bulk save attendance: ${upsertResult.error.message}`);
      return;
    }

    const nextMap: Record<string, AttendanceStatus> = {};
    activeStudents.forEach(student => {
      nextMap[String(student.id)] = 'P';
    });

    setAttendanceMap(nextMap);
    notify?.('All students marked Present.');
  };

  return (
    <section className="space-y-6">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 p-5 sm:p-6">
        <h2 className="text-xl sm:text-2xl font-black tracking-tight">Daily Attendance</h2>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">Standalone page component for class/subject attendance.</p>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-4 gap-3">
          <select
            value={contextType}
            onChange={(e) => setContextType(e.target.value as AttendanceContextType)}
            className="w-full bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 outline-none"
          >
            <option value="class">Class Attendance</option>
            <option value="subject">Subject Attendance</option>
          </select>

          <select
            value={selectedContextId}
            onChange={(e) => setSelectedContextId(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 outline-none md:col-span-2"
          >
            {!activeContextList.length && <option value="">No options available</option>}
            {activeContextList.map(item => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>

          <input
            type="date"
            value={attendanceDate}
            onChange={(e) => setAttendanceDate(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 outline-none"
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void loadAttendance()}
            disabled={isLoading || isSaving || !selectedContextId}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest ${isLoading || isSaving || !selectedContextId ? 'bg-slate-300 text-slate-600 cursor-not-allowed' : 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'}`}
          >
            {isLoading ? 'Loading...' : 'Reload'}
          </button>
          <button
            type="button"
            onClick={() => void markAllPresent()}
            disabled={isLoading || isSaving || activeStudents.length === 0}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest ${isLoading || isSaving || activeStudents.length === 0 ? 'bg-emerald-200 text-emerald-700 cursor-not-allowed' : 'bg-emerald-500 text-white'}`}
          >
            {isSaving ? 'Saving...' : 'Mark All Present'}
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-5 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h3 className="text-sm sm:text-base font-black">Students ({activeStudents.length})</h3>
          <span className="text-[11px] font-bold text-slate-500">P = Present, A = Absent, L = Leave</span>
        </div>

        {activeStudents.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No students available for this context.</p>
        ) : (
          <ul className="divide-y divide-slate-200 dark:divide-slate-700">
            {activeStudents.map(student => {
              const currentStatus = attendanceMap[String(student.id)] || '-';
              return (
                <li key={student.id} className="px-5 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-900 dark:text-slate-100">{student.name}</p>
                    <p className="text-xs text-slate-500">{student.email}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500 mr-1">Current: {currentStatus}</span>
                    {(['P', 'A', 'L'] as AttendanceStatus[]).map(status => {
                      const active = currentStatus === status;
                      return (
                        <button
                          key={status}
                          type="button"
                          onClick={() => void saveSingle(String(student.id), status)}
                          disabled={isSaving || isLoading}
                          className={`w-9 h-9 rounded-lg text-xs font-black ${active ? 'bg-brand-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'}`}
                        >
                          {status}
                        </button>
                      );
                    })}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
};

export default DailyAttendancePage;
