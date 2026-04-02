import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../src/supabaseClient';

interface AttendanceTakerProps {
  schoolId: string;
}

type AttendanceStatus = 'P' | 'A' | 'L';

interface StudentRecord {
  id: string;
  name: string;
  avatar?: string;
  status: AttendanceStatus | null;
}

const STATUS_CONFIG: Record<AttendanceStatus, { label: string; icon: string; bg: string; text: string; ring: string }> = {
  P: { label: 'Present', icon: 'fa-circle-check', bg: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', ring: 'ring-emerald-500' },
  A: { label: 'Absent',  icon: 'fa-circle-xmark', bg: 'bg-rose-500',    text: 'text-rose-600 dark:text-rose-400',       ring: 'ring-rose-500' },
  L: { label: 'Late',    icon: 'fa-clock',         bg: 'bg-amber-500',   text: 'text-amber-600 dark:text-amber-400',     ring: 'ring-amber-500' },
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const fmtDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

const AttendanceTaker: React.FC<AttendanceTakerProps> = ({ schoolId }) => {
  // ── Selector State ─────────────────────────────────
  const [classes, setClasses] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [students, setStudents] = useState<StudentRecord[]>([]);

  // ── Date / Calendar State ──────────────────────────
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // ── Loading / Saving ───────────────────────────────
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState<{ msg: string; type: 'success'|'error' } | null>(null);

  const showToast = useCallback((msg: string, type: 'success'|'error' = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  // ── Load Classes ───────────────────────────────────
  useEffect(() => {
    if (!supabase) return;
    void supabase.from('classes').select('id, name, color, image_url').eq('school_id', schoolId).order('name')
      .then(({ data }) => setClasses(data || []));
  }, [schoolId]);

  // ── Load Courses when class changes ───────────────
  useEffect(() => {
    setSelectedCourseId('');
    setStudents([]);
    if (!selectedClassId || !supabase) { setCourses([]); return; }
    void supabase.from('class_courses').select('id, name').eq('class_id', selectedClassId).eq('school_id', schoolId).order('name')
      .then(({ data }) => setCourses(data || []));
  }, [selectedClassId]);

  // ── Load Students + Attendance when course or date changes ──
  useEffect(() => {
    if (!selectedCourseId) { setStudents([]); return; }
    void loadStudentsAndAttendance();
  }, [selectedCourseId, selectedDate]);

  const loadStudentsAndAttendance = async () => {
    if (!supabase || !selectedCourseId) return;
    setIsLoadingStudents(true);
    try {
      const dateStr = fmtDate(selectedDate);

      // Get assigned students
      const { data: assignments } = await supabase
        .from('class_course_students')
        .select('student_id')
        .eq('class_course_id', selectedCourseId);

      const studentIds = (assignments || []).map((a: any) => String(a.student_id));
      if (studentIds.length === 0) { setStudents([]); setIsLoadingStudents(false); return; }

      // Get student info
      const { data: studentData } = await supabase
        .from('students')
        .select('id, name, avatar')
        .in('id', studentIds)
        .order('name');

      // Get existing attendance for this date
      const { data: attendanceData } = await supabase
        .from('attendance_records')
        .select('student_id, status')
        .eq('context_type', 'subject')
        .eq('context_id', selectedCourseId)
        .eq('attendance_date', dateStr);

      const attendanceMap: Record<string, AttendanceStatus> = {};
      for (const a of (attendanceData || [])) {
        attendanceMap[String(a.student_id)] = a.status as AttendanceStatus;
      }

      setStudents((studentData || []).map((s: any) => ({
        id: String(s.id),
        name: s.name,
        avatar: s.avatar,
        status: attendanceMap[String(s.id)] ?? null,
      })));
    } catch (err) {
      console.error(err);
      showToast('Failed to load students.', 'error');
    } finally {
      setIsLoadingStudents(false);
    }
  };

  // ── Toggle individual status (cycle: null→P→A→L→null) ──
  const cycleStatus = (studentId: string) => {
    setStudents(prev => prev.map(s => {
      if (s.id !== studentId) return s;
      const cycle: (AttendanceStatus | null)[] = [null, 'P', 'A', 'L'];
      const idx = cycle.indexOf(s.status);
      return { ...s, status: cycle[(idx + 1) % cycle.length] };
    }));
  };

  const setStatus = (studentId: string, status: AttendanceStatus | null) => {
    setStudents(prev => prev.map(s => s.id === studentId ? { ...s, status } : s));
  };

  const markAll = (status: AttendanceStatus) => setStudents(prev => prev.map(s => ({ ...s, status })));
  const unmarkAll = () => setStudents(prev => prev.map(s => ({ ...s, status: null })));

  // ── Save attendance ─────────────────────────────────
  const saveAttendance = async () => {
    if (!supabase || !selectedCourseId) return;
    setIsSaving(true);
    try {
      const dateStr = fmtDate(selectedDate);

      // Delete existing records for this date/course
      await supabase.from('attendance_records')
        .delete()
        .eq('context_type', 'subject')
        .eq('context_id', selectedCourseId)
        .eq('attendance_date', dateStr);

      // Insert new records (only if status is set)
      const toInsert = students
        .filter(s => s.status !== null)
        .map(s => ({
          student_id: s.id,
          status: s.status,
          context_type: 'subject',
          context_id: selectedCourseId,
          attendance_date: dateStr,
          school_id: schoolId,
        }));

      if (toInsert.length > 0) {
        const { error } = await supabase.from('attendance_records').insert(toInsert);
        if (error) throw error;
      }
      showToast(`Attendance saved for ${dateStr}.`);
    } catch (err: any) {
      showToast(err.message || 'Failed to save attendance.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Stats ──────────────────────────────────────────
  const stats = useMemo(() => ({
    present: students.filter(s => s.status === 'P').length,
    absent:  students.filter(s => s.status === 'A').length,
    late:    students.filter(s => s.status === 'L').length,
    unmarked: students.filter(s => s.status === null).length,
    total: students.length,
  }), [students]);

  // ── Calendar helpers ───────────────────────────────
  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    return cells;
  }, [calendarMonth]);

  const isToday = (d: Date) => fmtDate(d) === fmtDate(new Date());
  const isSelected = (d: Date) => fmtDate(d) === fmtDate(selectedDate);

  const selectedClass = classes.find(c => c.id === selectedClassId);
  const selectedCourse = courses.find(c => c.id === selectedCourseId);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      {/* Toast */}
      {notification && (
        <div className={`fixed top-6 right-6 z-[999] px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-white font-black text-sm animate-in slide-in-from-top-2 duration-300 ${notification.type === 'error' ? 'bg-rose-500' : 'bg-emerald-500'}`}>
          <i className={`fas ${notification.type === 'error' ? 'fa-circle-xmark' : 'fa-circle-check'}`}></i>
          {notification.msg}
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black tracking-tighter text-slate-800 dark:text-white flex items-center gap-3">
            <i className="fas fa-calendar-check text-brand-500"></i> Attendance
          </h2>
          <p className="text-slate-400 text-sm mt-1">Take roll call for classes and courses</p>
        </div>
        {students.length > 0 && (
          <button onClick={() => void saveAttendance()} disabled={isSaving}
            className="flex items-center gap-2 px-5 py-3 bg-brand-500 text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-brand-600 transition-all shadow-lg shadow-brand-500/25 disabled:opacity-50">
            <i className={`fas ${isSaving ? 'fa-spinner fa-spin' : 'fa-floppy-disk'}`}></i>
            {isSaving ? 'Saving…' : 'Save Attendance'}
          </button>
        )}
      </div>

      {/* ── Selectors + Date Row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Class Dropdown */}
        <div className="relative">
          <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Class</label>
          <div className="relative">
            <select value={selectedClassId} onChange={e => setSelectedClassId(e.target.value)}
              className="w-full appearance-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 pl-4 pr-10 text-sm font-semibold text-slate-700 dark:text-white focus:outline-none focus:border-brand-500 transition-all cursor-pointer shadow-sm">
              <option value="">— Select Class —</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <i className="fas fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none"></i>
          </div>
        </div>

        {/* Course Dropdown */}
        <div className="relative">
          <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Course</label>
          <div className="relative">
            <select value={selectedCourseId} onChange={e => setSelectedCourseId(e.target.value)}
              disabled={!selectedClassId}
              className="w-full appearance-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 pl-4 pr-10 text-sm font-semibold text-slate-700 dark:text-white focus:outline-none focus:border-brand-500 transition-all cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
              <option value="">— Select Course —</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <i className="fas fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none"></i>
          </div>
        </div>

        {/* Date Picker */}
        <div className="relative">
          <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Date</label>
          <button onClick={() => setIsCalendarOpen(p => !p)}
            className="w-full flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 text-sm font-semibold text-slate-700 dark:text-white focus:outline-none hover:border-brand-500 transition-all shadow-sm">
            <span className="flex items-center gap-3">
              <i className="fas fa-calendar text-brand-500"></i>
              {DAYS[selectedDate.getDay()]}, {MONTHS[selectedDate.getMonth()].slice(0,3)} {selectedDate.getDate()}, {selectedDate.getFullYear()}
            </span>
            <i className={`fas fa-chevron-down text-slate-400 text-xs transition-transform duration-200 ${isCalendarOpen ? 'rotate-180' : ''}`}></i>
          </button>

          {/* Calendar Dropdown */}
          {isCalendarOpen && (
            <div className="absolute top-full mt-2 left-0 right-0 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-[20px] shadow-2xl p-4 animate-in fade-in slide-in-from-top-2 duration-200">
              {/* Month nav */}
              <div className="flex items-center justify-between mb-4">
                <button onClick={() => setCalendarMonth(d => new Date(d.getFullYear(), d.getMonth()-1, 1))}
                  className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:bg-brand-500 hover:text-white transition-all">
                  <i className="fas fa-chevron-left text-xs"></i>
                </button>
                <h4 className="text-sm font-black text-slate-700 dark:text-white">
                  {MONTHS[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}
                </h4>
                <button onClick={() => setCalendarMonth(d => new Date(d.getFullYear(), d.getMonth()+1, 1))}
                  className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:bg-brand-500 hover:text-white transition-all">
                  <i className="fas fa-chevron-right text-xs"></i>
                </button>
              </div>
              {/* Day labels */}
              <div className="grid grid-cols-7 mb-2">
                {DAYS.map(d => <div key={d} className="text-center text-[9px] font-black uppercase tracking-widest text-slate-400">{d}</div>)}
              </div>
              {/* Day cells */}
              <div className="grid grid-cols-7 gap-0.5">
                {calendarDays.map((day, i) => (
                  <div key={i}>
                    {day ? (
                      <button onClick={() => { setSelectedDate(day); setIsCalendarOpen(false); }}
                        className={`w-full aspect-square flex items-center justify-center rounded-xl text-xs font-bold transition-all
                          ${isSelected(day) ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/30' :
                            isToday(day) ? 'border-2 border-brand-500 text-brand-500 font-black' :
                            'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
                        {day.getDate()}
                      </button>
                    ) : <div />}
                  </div>
                ))}
              </div>
              {/* Today shortcut */}
              <button onClick={() => { setSelectedDate(new Date()); setCalendarMonth(new Date()); setIsCalendarOpen(false); }}
                className="w-full mt-3 py-2 text-[10px] font-black uppercase tracking-widest text-brand-500 hover:bg-brand-500/5 rounded-xl transition-all">
                Today
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Quick Date Nav ── */}
      <div className="flex items-center gap-2">
        <button onClick={() => setSelectedDate(d => { const n = new Date(d); n.setDate(n.getDate()-1); return n; })}
          className="w-9 h-9 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:border-brand-500 hover:text-brand-500 transition-all shadow-sm">
          <i className="fas fa-chevron-left text-xs"></i>
        </button>
        <div className="flex-1 flex items-center justify-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl py-2 px-4 shadow-sm">
          <i className="fas fa-calendar-day text-brand-500 text-sm"></i>
          <span className="text-sm font-black text-slate-700 dark:text-white">
            {DAYS[selectedDate.getDay()]}, {MONTHS[selectedDate.getMonth()]} {selectedDate.getDate()}, {selectedDate.getFullYear()}
          </span>
          {isToday(selectedDate) && <span className="px-2 py-0.5 bg-brand-500/10 text-brand-600 text-[9px] font-black uppercase tracking-widest rounded-full">Today</span>}
        </div>
        <button onClick={() => setSelectedDate(d => { const n = new Date(d); n.setDate(n.getDate()+1); return n; })}
          className="w-9 h-9 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:border-brand-500 hover:text-brand-500 transition-all shadow-sm">
          <i className="fas fa-chevron-right text-xs"></i>
        </button>
      </div>

      {/* ── Stats Bar (shows when students loaded) ── */}
      {students.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { key: 'present', label: 'Present', value: stats.present, color: 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400', icon: 'fa-circle-check' },
            { key: 'absent',  label: 'Absent',  value: stats.absent,  color: 'text-rose-600 bg-rose-50 border-rose-200 dark:bg-rose-500/10 dark:border-rose-500/20 dark:text-rose-400',             icon: 'fa-circle-xmark' },
            { key: 'late',    label: 'Late',    value: stats.late,    color: 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-400',          icon: 'fa-clock' },
            { key: 'unmarked',label: 'Unmarked',value: stats.unmarked, color: 'text-slate-500 bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700',                                    icon: 'fa-circle-question' },
          ].map(s => (
            <div key={s.key} className={`flex items-center gap-3 p-3 rounded-2xl border ${s.color}`}>
              <i className={`fas ${s.icon} text-lg`}></i>
              <div>
                <p className="text-2xl font-black">{s.value}</p>
                <p className="text-[9px] font-black uppercase tracking-widest opacity-70">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Main Roll Call Panel ── */}
      <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
        {/* Panel Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-5 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-base font-black text-slate-800 dark:text-white flex items-center gap-2">
              <i className="fas fa-clipboard-list text-brand-500"></i>
              Roll Call
              {selectedClass && <span className="text-[10px] font-bold text-slate-400 ml-1">— {selectedClass.name}{selectedCourse ? ` / ${selectedCourse.name}` : ''}</span>}
            </h3>
            {students.length > 0 && <p className="text-[10px] text-slate-400 mt-0.5">{stats.total} students · click a student to cycle status, or use buttons</p>}
          </div>
          {students.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button onClick={() => markAll('P')}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm shadow-emerald-500/20">
                <i className="fas fa-circle-check text-xs"></i> Mark All Present
              </button>
              <button onClick={() => markAll('A')}
                className="flex items-center gap-1.5 px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm shadow-rose-500/20">
                <i className="fas fa-circle-xmark text-xs"></i> Mark All Absent
              </button>
              <button onClick={unmarkAll}
                className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                <i className="fas fa-rotate-left text-xs"></i> Unmark All
              </button>
            </div>
          )}
        </div>

        {/* Student List */}
        <div className="divide-y divide-slate-50 dark:divide-slate-800/60">
          {!selectedClassId ? (
            <div className="flex flex-col items-center justify-center py-20 opacity-30">
              <i className="fas fa-layer-group text-5xl mb-4 text-slate-400"></i>
              <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Select a class to begin</p>
            </div>
          ) : !selectedCourseId ? (
            <div className="flex flex-col items-center justify-center py-20 opacity-30">
              <i className="fas fa-book-open text-5xl mb-4 text-slate-400"></i>
              <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Select a course to begin</p>
            </div>
          ) : isLoadingStudents ? (
            <div className="flex items-center justify-center py-20 gap-3 opacity-40">
              <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm font-black text-brand-500 uppercase tracking-widest">Loading students…</p>
            </div>
          ) : students.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 opacity-30">
              <i className="fas fa-user-graduate text-5xl mb-4 text-slate-400"></i>
              <p className="text-sm font-black text-slate-400 uppercase tracking-widest">No students in this course</p>
            </div>
          ) : students.map((student, idx) => {
            const cfg = student.status ? STATUS_CONFIG[student.status] : null;
            return (
              <div key={student.id}
                className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-all group">
                {/* Index */}
                <span className="text-xs font-black text-slate-300 dark:text-slate-700 w-5 text-right shrink-0">{idx + 1}</span>

                {/* Avatar */}
                <div className="relative shrink-0">
                  {student.avatar
                    ? <img src={student.avatar} alt={student.name} className="w-11 h-11 rounded-2xl object-cover" />
                    : <div className="w-11 h-11 rounded-2xl bg-brand-500/10 flex items-center justify-center text-brand-500 font-black text-base">{student.name.charAt(0)}</div>}
                  {/* Status dot */}
                  {cfg && (
                    <div className={`absolute -bottom-1 -right-1 w-4 h-4 ${cfg.bg} rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900`}>
                      <i className={`fas ${cfg.icon} text-[6px] text-white`}></i>
                    </div>
                  )}
                </div>

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-black truncate ${cfg ? cfg.text : 'text-slate-700 dark:text-white'}`}>{student.name}</p>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">{cfg ? cfg.label : 'Not marked'}</p>
                </div>

                {/* Status Buttons */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {(['P', 'A', 'L'] as AttendanceStatus[]).map(s => {
                    const c = STATUS_CONFIG[s];
                    const active = student.status === s;
                    return (
                      <button key={s} onClick={() => setStatus(student.id, active ? null : s)}
                        title={c.label}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black transition-all border ${
                          active
                            ? `${c.bg} text-white border-transparent shadow-md`
                            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                        }`}>
                        <i className={`fas ${c.icon} text-[10px]`}></i>
                        <span className="hidden sm:inline">{c.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer save */}
        {students.length > 0 && (
          <div className="p-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/20">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              {stats.present}P · {stats.absent}A · {stats.late}L · {stats.unmarked} unmarked
            </p>
            <button onClick={() => void saveAttendance()} disabled={isSaving}
              className="flex items-center gap-2 px-5 py-2.5 bg-brand-500 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-brand-600 transition-all shadow-lg shadow-brand-500/25 disabled:opacity-50">
              <i className={`fas ${isSaving ? 'fa-spinner fa-spin' : 'fa-floppy-disk'}`}></i>
              {isSaving ? 'Saving…' : 'Save Attendance'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AttendanceTaker;
