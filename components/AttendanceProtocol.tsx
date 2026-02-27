import React from 'react';
import { Student } from '../types';

/**
 * AttendanceProtocol Component
 * 
 * Manages subject-specific attendance tracking.
 * Includes subject selection, date picking, and bulk marking capabilities.
 */

interface AttendanceProtocolProps {
  students: Student[];
  subjects: any[];
  attendanceDate: string;
  setAttendanceDate: (date: string) => void;
  classes: any[];
  allStudents: any[];
  selectedStudents: string[];
  setSelectedStudents: (ids: string[]) => void;
  className: string;
  setClassName: (name: string) => void;
  classImage: File | null;
  setClassImage: (file: File | null) => void;
  classOuterColor: string;
  setClassOuterColor: (color: string) => void;
  createClassWithStudents: () => void;
  editingClassId: string | null;
  startEditClass: (classItem: any) => void;
  cancelEditClass: () => void;
  saveClassEdits: () => void;
  deleteClass: (classId: string, onDeleted?: () => void) => void;
  removeStudentFromClass: (classId: string, studentId: string) => void;
  selectedAttendanceSubject: string | null;
  setSelectedAttendanceSubject: (id: string | null) => void;
  subjectAttendanceStore: Record<string, Record<string, Record<string, 'P' | 'A' | 'L'>>>;
  updateSubjectAttendance: (contextType: 'class' | 'subject', contextId: string, date: string, studentId: string, status: 'P' | 'A' | 'L') => Promise<void>;
  bulkMarkSubjectPresent: (contextType: 'class' | 'subject', contextId: string, date: string, studentIds: string[], contextName?: string) => Promise<void>;
  loadAttendanceForContext: (contextType: 'class' | 'subject', contextId: string, date: string) => Promise<void>;
  exportMonthlyAttendancePdf: (
    contextType: 'class' | 'subject',
    contextId: string,
    month: string,
    studentList: Array<{ id: string; name: string }>,
    contextLabel?: string
  ) => Promise<void>;
  notify: (msg: string) => void;
}

const AttendanceProtocol: React.FC<AttendanceProtocolProps> = ({
  students,
  subjects,
  attendanceDate,
  setAttendanceDate,
  classes,
  allStudents,
  selectedStudents,
  setSelectedStudents,
  className,
  setClassName,
  classImage,
  setClassImage,
  classOuterColor,
  setClassOuterColor,
  createClassWithStudents,
  editingClassId,
  startEditClass,
  cancelEditClass,
  saveClassEdits,
  deleteClass,
  removeStudentFromClass,
  selectedAttendanceSubject,
  setSelectedAttendanceSubject,
  subjectAttendanceStore,
  updateSubjectAttendance,
  bulkMarkSubjectPresent,
  loadAttendanceForContext,
  exportMonthlyAttendancePdf,
  notify
}) => {
  const [selectedClassId, setSelectedClassId] = React.useState<string | null>(null);
  const [isClassFormOpen, setIsClassFormOpen] = React.useState(false);
  const [exportMonth, setExportMonth] = React.useState(new Date().toISOString().slice(0, 7));
  const classImageInputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (editingClassId) {
      setIsClassFormOpen(true);
    }
  }, [editingClassId]);

  const selectedClass = classes.find(c => String(c.id) === selectedClassId);
  const selectedClassStudentIds: string[] = selectedClass?.student_ids || [];
  const selectedClassStudents = allStudents.filter(student => selectedClassStudentIds.includes(String(student.id)));

  const activeAttendanceId = selectedClassId || selectedAttendanceSubject;
  const attendanceStoreKey = selectedClassId ? `class:${selectedClassId}` : selectedAttendanceSubject ? `subject:${selectedAttendanceSubject}` : null;
  const activeStudents = selectedClassId ? selectedClassStudents : students;

  React.useEffect(() => {
    if (selectedClassId) {
      void loadAttendanceForContext('class', selectedClassId, attendanceDate);
      return;
    }

    if (selectedAttendanceSubject) {
      void loadAttendanceForContext('subject', selectedAttendanceSubject, attendanceDate);
    }
  }, [selectedClassId, selectedAttendanceSubject, attendanceDate, loadAttendanceForContext]);

  React.useEffect(() => {
    if (attendanceDate?.length >= 7) {
      setExportMonth(attendanceDate.slice(0, 7));
    }
  }, [attendanceDate]);

  const markAllPresentForClass = async () => {
    if (!selectedClassId) return;
    await bulkMarkSubjectPresent(
      'class',
      selectedClassId,
      attendanceDate,
      activeStudents.map(student => String(student.id)),
      selectedClass?.name || 'selected class'
    );
  };

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-5 duration-700 pb-20">
      {/* Header with Date Picker and Actions */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-10">
        <div className="flex items-start sm:items-center gap-4 sm:gap-8 lg:gap-10">
          <div className="w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 rounded-[24px] sm:rounded-[32px] lg:rounded-[40px] bg-brand-500 flex items-center justify-center text-white text-2xl sm:text-3xl lg:text-4xl shadow-glow flex-shrink-0">
            <i className="fas fa-calendar-check"></i>
          </div>
          <div className="min-w-0">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tighter">Presence Protocol</h2>
            <div className="flex flex-wrap items-center gap-3 sm:gap-6 mt-3">
              <input 
                type="date" 
                value={attendanceDate} 
                onChange={(e) => setAttendanceDate(e.target.value)} 
                className="bg-transparent text-sm font-black uppercase tracking-widest text-slate-500 border-none focus:ring-0 cursor-pointer" 
              />
              <div className="h-4 w-px bg-slate-200 dark:bg-slate-800"></div>
              <span className="text-[10px] font-black uppercase text-brand-500 tracking-[0.2em]">Live Session Mapping</span>
            </div>
          </div>
        </div>
        {activeAttendanceId && (
          <button 
            onClick={async () => {
              if (selectedClassId) {
                await markAllPresentForClass();
              } else if (selectedAttendanceSubject) {
                await bulkMarkSubjectPresent(
                  'subject',
                  selectedAttendanceSubject,
                  attendanceDate,
                  activeStudents.map(student => String(student.id)),
                  subjects.find(s => s.id === selectedAttendanceSubject)?.name
                );
              }
            }} 
            className="w-full xl:w-auto px-8 sm:px-10 py-4 sm:py-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-slate-800 dark:text-white font-black rounded-[24px] sm:rounded-[32px] text-[10px] sm:text-xs uppercase tracking-widest shadow-premium"
          >
            Mark All Present
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[32px] sm:rounded-[48px] lg:rounded-[56px] p-6 sm:p-8 lg:p-10 border border-slate-100 dark:border-slate-800 shadow-premium space-y-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">{editingClassId ? 'Edit Class' : 'Create Class'}</h2>
            <p className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-slate-400 mt-2">{editingClassId ? 'Update class appearance and details' : 'Build a class and attach student profiles'}</p>
          </div>
          <button
            onClick={() => setIsClassFormOpen(prev => !prev)}
            className="px-4 py-2 rounded-xl bg-brand-50 text-brand-500 border border-brand-100 text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
          >
            <i className={`fas ${isClassFormOpen ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
            {isClassFormOpen ? 'Hide Form' : 'Create Class'}
          </button>
        </div>

        {isClassFormOpen && (
          <>
        <div className="space-y-3">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Class Name</label>
          <input
            type="text"
            placeholder="Enter class name"
            value={className}
            onChange={(e) => setClassName(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border-2 border-transparent focus:border-brand-500 outline-none font-bold"
          />
        </div>

        <div className="space-y-3">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Class Image</label>
          <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-4">
            <input
              ref={classImageInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => {
                if (e.target.files) setClassImage(e.target.files[0]);
              }}
              className="w-full text-xs font-semibold text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-brand-500 file:text-white"
            />
            {classImage && (
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="text-[11px] text-slate-500">Selected: {classImage.name}</p>
                <button
                  type="button"
                  onClick={() => {
                    setClassImage(null);
                    if (classImageInputRef.current) {
                      classImageInputRef.current.value = '';
                    }
                  }}
                  className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 hover:text-rose-500 flex items-center justify-center"
                  title="Remove selected image"
                >
                  <i className="fas fa-xmark text-xs"></i>
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Add Students</label>
            <span className="text-[10px] font-black uppercase tracking-widest text-brand-500">{selectedStudents.length} Selected</span>
          </div>
          <div className="max-h-48 overflow-y-auto bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-3 space-y-2">
            {allStudents.map(student => (
              <label key={student.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white dark:hover:bg-slate-700/60 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  value={student.id}
                  checked={selectedStudents.includes(String(student.id))}
                  onChange={(e) => {
                    const studentId = String(student.id);
                    if (e.target.checked) {
                      setSelectedStudents([...selectedStudents, studentId]);
                    } else {
                      setSelectedStudents(
                        selectedStudents.filter(id => id !== studentId)
                      );
                    }
                  }}
                  className="w-4 h-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
                />
                <span className="font-semibold text-sm">{student.name}</span>
                <span className="text-[10px] text-slate-400 uppercase tracking-widest">({student.id})</span>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Image Area Color</label>
          <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-3 flex items-center gap-3">
            <input
              type="color"
              value={classOuterColor}
              onChange={(e) => setClassOuterColor(e.target.value)}
              className="w-12 h-10 rounded-lg cursor-pointer"
            />
            <span className="text-xs font-black uppercase tracking-widest text-slate-500">{classOuterColor}</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2">
          {classes.length > 0 && (
            <p className="text-xs text-slate-500 font-semibold">Classes created: {classes.length}</p>
          )}
          <div className="flex w-full sm:w-auto gap-2">
            {editingClassId && (
              <button
                onClick={cancelEditClass}
                className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-100 text-xs font-black uppercase tracking-widest"
              >
                Cancel
              </button>
            )}
            <button
              onClick={editingClassId ? saveClassEdits : createClassWithStudents}
              className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-brand-500 text-white text-xs font-black uppercase tracking-widest shadow-xl shadow-brand-500/30 hover:brightness-105 active:scale-95 transition-all"
            >
              {editingClassId ? 'Update Class' : 'Create Class'}
            </button>
          </div>
        </div>
          </>
        )}

      </div>

      {classes.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-[32px] sm:rounded-[48px] lg:rounded-[56px] p-6 sm:p-8 lg:p-10 border border-slate-100 dark:border-slate-800 shadow-premium space-y-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Created Classes</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {classes.map((classItem) => (
              <div
                key={classItem.id}
                onClick={() => {
                  setSelectedClassId(String(classItem.id));
                  setSelectedAttendanceSubject(null);
                }}
                className="rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden cursor-pointer hover:-translate-y-1 transition-all"
                style={{ backgroundColor: '#f8fafc' }}
              >
                <div className="flex justify-end p-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      startEditClass(classItem);
                    }}
                    className="w-8 h-8 mr-2 rounded-lg bg-white dark:bg-slate-900 text-slate-400 hover:text-brand-500 border border-slate-100 dark:border-slate-700 flex items-center justify-center"
                    title="Edit class"
                  >
                    <i className="fas fa-pen"></i>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteClass(String(classItem.id), () => {
                        if (selectedClassId === String(classItem.id)) {
                          setSelectedClassId(null);
                        }
                      });
                    }}
                    className="w-8 h-8 rounded-lg bg-white dark:bg-slate-900 text-slate-400 hover:text-rose-500 border border-slate-100 dark:border-slate-700 flex items-center justify-center"
                    title="Delete class"
                  >
                    <i className="fas fa-trash"></i>
                  </button>
                </div>
                <div className="w-full aspect-square" style={{ backgroundColor: classItem.color || classItem.outer_color || '#f8fafc' }}>
                  {classItem.image_url ? (
                    <img src={classItem.image_url} alt={classItem.name} className="w-full h-full object-contain" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs font-black uppercase tracking-widest">
                      No Image
                    </div>
                  )}
                </div>
                <div className="p-3 space-y-1 bg-white dark:bg-slate-900">
                  <p className="font-black text-sm truncate">{classItem.name}</p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{classItem.class_code || `${classItem.name?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'class'}1`}</p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-brand-500">
                    {(classItem.student_count ?? 0)} Students
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Subject Selection Grid or Student List */}
      {!activeAttendanceId ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {subjects.map(sub => (
            <button 
              key={sub.id} 
              onClick={() => {
                setSelectedClassId(null);
                setSelectedAttendanceSubject(sub.id);
              }}
              className="bg-white dark:bg-slate-900 p-10 rounded-[56px] shadow-premium border border-slate-100 dark:border-slate-800 group hover:-translate-y-4 transition-all duration-500 text-left"
            >
              <div className={`w-16 h-16 ${sub.bg} ${sub.color} rounded-[24px] flex items-center justify-center text-3xl shadow-inner mb-8 group-hover:rotate-6 transition-transform`}>
                <i className={`fas ${sub.icon}`}></i>
              </div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">{sub.code}</p>
              <h4 className="text-xl font-black mb-1 group-hover:text-brand-500 transition-colors">{sub.name}</h4>
              <p className="text-xs font-bold text-slate-500">{sub.teacher}</p>
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-10 animate-in slide-in-from-right-5 duration-500">
          {/* Back Button and Subject Info */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 p-5 sm:p-8 lg:p-10 bg-white dark:bg-slate-900 rounded-[32px] sm:rounded-[48px] lg:rounded-[56px] border border-slate-100 dark:border-slate-800 shadow-premium">
            <div className="flex items-center gap-4 sm:gap-6 lg:gap-8 min-w-0">
              <button 
                onClick={() => {
                  if (selectedClassId) {
                    setSelectedClassId(null);
                  } else {
                    setSelectedAttendanceSubject(null);
                  }
                }} 
                className="w-12 h-12 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-brand-500 transition-all"
              >
                <i className="fas fa-arrow-left"></i>
              </button>
              <div className="min-w-0">
                <h4 className="text-xl sm:text-2xl font-black tracking-tight break-words">
                  Marking: {selectedClassId ? `${selectedClass?.name} (${selectedClass?.class_code || 'class1'})` : subjects.find(s => s.id === selectedAttendanceSubject)?.name}
                </h4>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {selectedClassId ? 'Class Attendance View' : `Course Terminal: ${subjects.find(s => s.id === selectedAttendanceSubject)?.code}`}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-3 rounded-2xl bg-slate-50 dark:bg-slate-800 px-4 py-3 border border-slate-100 dark:border-slate-700">
                <i className="fas fa-calendar text-slate-400"></i>
                <input
                  type="date"
                  value={attendanceDate}
                  onChange={(e) => setAttendanceDate(e.target.value)}
                  className="bg-transparent text-sm font-black uppercase tracking-widest text-slate-500 border-none focus:ring-0 cursor-pointer"
                />
              </div>
              <div className="flex items-center gap-2 rounded-2xl bg-slate-50 dark:bg-slate-800 px-3 py-3 border border-slate-100 dark:border-slate-700">
                <input
                  type="month"
                  value={exportMonth}
                  onChange={(e) => setExportMonth(e.target.value)}
                  className="bg-transparent text-xs font-black uppercase tracking-widest text-slate-500 border-none focus:ring-0 cursor-pointer"
                  title="Select export month"
                />
                <button
                  onClick={() => {
                    if (selectedClassId) {
                      void exportMonthlyAttendancePdf(
                        'class',
                        selectedClassId,
                        exportMonth,
                        activeStudents.map(student => ({ id: String(student.id), name: student.name })),
                        selectedClass?.class_code || selectedClass?.name
                      );
                    } else if (selectedAttendanceSubject) {
                      const subjectName = subjects.find(s => s.id === selectedAttendanceSubject)?.name || selectedAttendanceSubject;
                      void exportMonthlyAttendancePdf(
                        'subject',
                        selectedAttendanceSubject,
                        exportMonth,
                        activeStudents.map(student => ({ id: String(student.id), name: student.name })),
                        subjectName
                      );
                    } else {
                      notify('Please select a class or subject before exporting.');
                    }
                  }}
                  className="px-4 py-2 rounded-xl bg-brand-500 text-white text-[10px] font-black uppercase tracking-widest"
                  title="Export selected month as PDF"
                >
                  PDF
                </button>
              </div>
            </div>
          </div>

          {/* Student Attendance List */}
          <div className="bg-white dark:bg-slate-900 rounded-[32px] sm:rounded-[48px] lg:rounded-[64px] p-3 sm:p-6 shadow-premium border border-slate-100 dark:border-slate-800 overflow-hidden">
            <div className="divide-y divide-slate-50 dark:divide-slate-800">
              {activeStudents.map(s => {
                const currentStatus = (attendanceStoreKey ? subjectAttendanceStore[attendanceStoreKey]?.[attendanceDate] : undefined)?.[s.id];
                return (
                  <div key={s.id} className="p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-slate-50 dark:hover:bg-white/5 transition-all group first:rounded-t-[48px] last:rounded-b-[48px]">
                    <div className="flex items-center gap-8">
                      <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-black text-brand-500">
                        {s.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-lg font-black tracking-tight">{s.name} <span className="text-xs text-slate-400">({s.id})</span></p>
                      </div>
                      {selectedClassId && (
                        <button
                          onClick={() => removeStudentFromClass(selectedClassId, String(s.id))}
                          className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-rose-500 flex items-center justify-center"
                          title="Delete student"
                        >
                          <i className="fas fa-trash text-xs"></i>
                        </button>
                      )}
                    </div>
                    
                    {/* Attendance Status Toggle */}
                    <div className="flex flex-wrap bg-slate-100/50 dark:bg-slate-800/50 p-2 rounded-[20px] sm:rounded-[28px] border border-slate-50 dark:border-slate-700">
                      {['P', 'A', 'L'].map((btn) => (
                        <button 
                          key={btn} 
                          onClick={() => {
                            if (selectedClassId) {
                              void updateSubjectAttendance('class', selectedClassId, attendanceDate, String(s.id), btn as 'P' | 'A' | 'L');
                            } else if (selectedAttendanceSubject) {
                              void updateSubjectAttendance('subject', selectedAttendanceSubject, attendanceDate, String(s.id), btn as 'P' | 'A' | 'L');
                            }
                          }} 
                          className={`px-4 sm:px-6 py-2.5 sm:py-3 rounded-[14px] sm:rounded-[20px] text-[10px] font-black uppercase tracking-widest transition-all ${currentStatus === btn ? `bg-brand-500 text-white shadow-lg` : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
                        >
                          {btn === 'P' ? 'Present' : btn === 'A' ? 'Absent' : 'Late'}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceProtocol;
