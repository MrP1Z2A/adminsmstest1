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

const normalizeAttendanceStatus = (value: unknown): AttendanceStatus | null => {
  const normalized = String(value || '').trim().toUpperCase();
  if (!normalized) return null;
  if (normalized === 'P' || normalized === 'PRESENT') return 'P';
  if (normalized === 'A' || normalized === 'ABSENT') return 'A';
  if (normalized === 'L' || normalized === 'LATE' || normalized === 'LEAVE') return 'L';
  return null;
};

const getTodayIsoDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const DailyAttendancePage: React.FC<DailyAttendancePageProps> = ({
  students = [],
  allStudents = [],
  classes = [],
  subjects = [],
  notify,
  schoolId,
}) => {
  if (!supabase) {
    return (
      <div className="p-10 bg-white/5 rounded-[40px] border border-white/10 text-center">
        <p className="text-slate-400 font-black uppercase text-[10px] tracking-widest">Supabase Engine Offline</p>
      </div>
    );
  }

  const [contextType, setContextType] = React.useState<AttendanceContextType>(
    (classes && classes.length > 0) ? 'class' : 'subject'
  );
  const [selectedContextId, setSelectedContextId] = React.useState<string>('');
  const [isRosterLoading, setIsRosterLoading] = React.useState(false);
  const [internalStudents, setInternalStudents] = React.useState<Student[]>([]);
  const [isRosterCollapsed, setIsRosterCollapsed] = React.useState(false);
  const [attendanceDate, setAttendanceDate] = React.useState(new Date().toISOString().split('T')[0]);
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

  const refreshRoster = React.useCallback(async () => {
    if (!supabase || !schoolId || contextType !== 'subject' || !selectedContextId) return;

    setIsRosterLoading(true);
    try {
      console.log(`[Attendance Registry] Dynamic Roster Fetch Init | Context: ${selectedContextId} | School: ${schoolId}`);
      const { data, error } = await supabase
        .from('class_course_students')
        .select('student_id, student_name, students(id, name, email)')
        .eq('class_course_id', selectedContextId)
        .eq('school_id', schoolId);

      if (error) throw error;

      const mapped = (data || []).map((row: any) => {
        if (row.students) return row.students;
        return {
          id: String(row.student_id),
          name: row.student_name || row.student_id,
          email: 'Course Enrollee'
        };
      });

      console.log(`[Attendance Registry] Found ${mapped.length} Personnel Records.`);
      setInternalStudents(mapped);
    } catch (err) {
      console.error('[Attendance Registry] Critical Roster Sync Failure:', err);
    } finally {
      setIsRosterLoading(false);
    }
  }, [schoolId, contextType, selectedContextId]);

  React.useEffect(() => {
    if (contextType === 'subject' && selectedContextId) {
      void refreshRoster();
    } else {
      setInternalStudents([]);
    }
  }, [selectedContextId, contextType, refreshRoster]);

  const activeStudents = React.useMemo(() => {
    // If no context is selected, we can't show a roster
    if (!selectedContextId) return [] as Student[];

    // Priority 1: Internal fetched students (for curated course contexts)
    if (internalStudents.length > 0) return internalStudents;

    // Priority 2: Explicitly passed subject students
    if (contextType === 'subject') {
      return students;
    }

    // Priority 3: Class context (filter from allStudents)
    if (contextType === 'class') {
      const selectedClass = classes.find(classItem => String(classItem.id) === String(selectedContextId));
      const ids = (selectedClass?.student_ids || []).map(id => String(id));
      const source = allStudents && allStudents.length > 0 ? allStudents : students;
      return source.filter(student => ids.includes(String(student.id)));
    }

    return students;
  }, [contextType, selectedContextId, classes, allStudents, students, internalStudents]);

  const loadAttendance = React.useCallback(async () => {
    if (!selectedContextId || !attendanceDate) return;

    setIsLoading(true);
    if (!supabase) {
      setIsLoading(false);
      return;
    }
    const contextCandidates = contextType === 'class' ? ['class', 'batch'] : ['subject', 'course', 'class_course'];

    const { data, error } = await supabase
      .from('attendance_records')
      .select('student_id, status')
      .in('context_type', contextCandidates)
      .eq('context_id', selectedContextId)
      .eq('attendance_date', attendanceDate)
      .eq('school_id', schoolId);

    if (error) {
      notify?.(`System Error: ${error.message}`);
      setIsLoading(false);
      return;
    }

    const nextMap: Record<string, AttendanceStatus> = {};
    (data || []).forEach((row: any) => {
      const status = normalizeAttendanceStatus(row.status);
      if (status) nextMap[String(row.student_id)] = status;
    });

    setAttendanceMap(nextMap);
    setIsLoading(false);
  }, [selectedContextId, attendanceDate, contextType, notify, schoolId]);

  React.useEffect(() => {
    void loadAttendance();
  }, [loadAttendance]);

  const saveSingle = async (studentId: string, status: AttendanceStatus) => {
    if (!selectedContextId || !attendanceDate || !supabase) return;

    setIsSaving(true);
    const payload = {
      context_type: contextType,
      context_id: selectedContextId,
      attendance_date: attendanceDate,
      student_id: String(studentId),
      status,
      school_id: schoolId,
    };

    const { error } = await supabase
      .from('attendance_records')
      .upsert([payload], { onConflict: 'context_type,context_id,attendance_date,student_id' });

    setIsSaving(false);

    if (error) {
      notify?.(`Transmission Error: ${error.message}`);
      return;
    }

    setAttendanceMap(prev => ({ ...prev, [String(studentId)]: status }));
  };

  const markAllPresent = async () => {
    if (!selectedContextId || !attendanceDate || activeStudents.length === 0 || !supabase) {
      notify?.('No active formation records to monitor.');
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

    const { error } = await supabase
      .from('attendance_records')
      .upsert(payload, { onConflict: 'context_type,context_id,attendance_date,student_id' });

    setIsSaving(false);

    if (error) {
      notify?.(`Bulk Save Failure: ${error.message}`);
      return;
    }

    const nextMap: Record<string, AttendanceStatus> = {};
    activeStudents.forEach(student => { nextMap[String(student.id)] = 'P'; });
    setAttendanceMap(nextMap);
    notify?.('Roster marked as Present.');
  };

  return (
    <div className="space-y-8">
      {/* Search & Meta Section */}
      <div className="bg-white/10 backdrop-blur-2xl p-8 rounded-[40px] border border-white/20 shadow-2xl">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="flex items-center gap-3 bg-[#0a1a19] px-6 py-3 rounded-2xl border border-white/10">
              <label className="text-[10px] font-black text-[#4ea59d] uppercase tracking-[0.2em] whitespace-nowrap">Log Date:</label>
              <input
                type="date"
                value={attendanceDate}
                onChange={(e) => setAttendanceDate(e.target.value)}
                className="bg-transparent outline-none text-white font-bold text-xs"
              />
            </div>
            
            <button
              onClick={() => void loadAttendance()}
              disabled={isLoading || isSaving}
              className="p-3 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 transition-all flex items-center justify-center"
              title="Reload Records"
            >
              {isLoading ? <i className="fas fa-spinner fa-spin text-sm"></i> : <i className="fas fa-rotate text-sm"></i>} 
            </button>
          </div>

          <div className="flex items-center gap-4 w-full md:w-auto">
            <button
              onClick={() => void markAllPresent()}
              disabled={isLoading || isSaving || activeStudents.length === 0}
              className="flex-1 md:flex-none px-8 py-4 bg-[#4ea59d] text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:scale-105 active:scale-95 transition-all shadow-xl shadow-[#4ea59d]/20 disabled:opacity-30 flex items-center justify-center gap-3"
            >
              <i className="fa-solid fa-users-check"></i>
              {isSaving ? 'Synching...' : 'Bulk Mark Present'}
            </button>
          </div>
        </div>
      </div>

      {/* Student List Grid */}
      <div className="bg-[#0a1a19] rounded-[48px] border border-white/5 overflow-hidden shadow-3xl">
         <header 
            onClick={() => setIsRosterCollapsed(!isRosterCollapsed)}
            className="px-10 py-8 border-b border-white/5 bg-white/[0.02] flex items-center justify-between cursor-pointer hover:bg-white/[0.04] transition-all group"
          >
            <div className="flex items-center gap-4">
               <div className={`w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-[#4ea59d] transition-transform duration-300 ${isRosterCollapsed ? '-rotate-90' : ''}`}>
                  <i className="fas fa-chevron-down text-[10px]"></i>
               </div>
               <div>
                  <h3 className="text-xl font-black text-white uppercase tracking-tight">Student Roster</h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
                    {isRosterLoading ? (
                      <span className="flex items-center gap-2"><i className="fas fa-spinner fa-spin"></i> Syncing Records...</span>
                    ) : (
                      `Live Population: ${activeStudents.length} Students`
                    )}
                  </p>
               </div>
            </div>
            <div className="hidden md:flex items-center gap-4 text-[9px] font-black uppercase tracking-widest">
               <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#4ea59d]"></div> Present</span>
               <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-rose-500"></div> Absent</span>
               <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-orange-500"></div> Leave</span>
            </div>
         </header>

         {!isRosterCollapsed && (
          <div className="max-h-[500px] overflow-y-auto custom-scrollbar divide-y divide-white/5">
               {activeStudents.map(student => {
                  const currentStatus = attendanceMap[String(student.id)] || '-';
                  return (
                    <div key={student.id} className="px-10 py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6 hover:bg-white/[0.01] transition-colors">
                      <div className="flex items-center gap-5">
                         <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-[#4ea59d] font-black border border-white/10 text-sm">
                            {student.name.charAt(0)}
                         </div>
                         <div>
                            <p className="font-bold text-white text-base tracking-tight">{student.name}</p>
                            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-0.5">{student.email || 'Independent ID'}</p>
                         </div>
                      </div>

                      <div className="flex items-center gap-4">
                        {(['P', 'A', 'L'] as AttendanceStatus[]).map(status => {
                          const active = currentStatus === status;
                          let activeClass = 'bg-[#4ea59d] text-white shadow-lg shadow-[#4ea59d]/20 scale-110';
                          if (status === 'A') activeClass = 'bg-rose-500 text-white shadow-lg shadow-rose-500/20 scale-110';
                          if (status === 'L') activeClass = 'bg-orange-500 text-white shadow-lg shadow-orange-500/20 scale-110';

                          return (
                            <button
                              key={status}
                              onClick={() => void saveSingle(String(student.id), status)}
                              disabled={isSaving}
                              className={`w-12 h-12 rounded-2xl text-[10px] font-black transition-all ${active ? activeClass : 'bg-white/5 text-slate-500 hover:text-white border border-white/5'}`}
                            >
                              {status}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                   );
                })}
             </div>
          )}
         {!isRosterCollapsed && activeStudents.length === 0 && (
            <div className="p-20 text-center space-y-4">
               <i className="fas fa-users-slash text-4xl text-white/5"></i>
               <p className="text-slate-500 text-[11px] font-black uppercase tracking-[0.3em]">No Personnel Records Found</p>
            </div>
         )}
      </div>
    </div>
  );
};

export default DailyAttendancePage;
