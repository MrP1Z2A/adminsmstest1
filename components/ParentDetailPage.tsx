import React from 'react';
import { Student } from '../types';
import { ParentEntry, buildParentEntries, formatStudentDate } from './parentDirectoryUtils';

interface ParentDetailPageProps {
  parentId: string | null;
  students: Student[];
  classes: any[];
  onBack: () => void;
}

const ParentDetailPage: React.FC<ParentDetailPageProps> = ({ parentId, students, classes, onBack }) => {
  const parentEntries = React.useMemo(() => buildParentEntries(students), [students]);

  const parent = React.useMemo<ParentEntry | null>(
    () => parentEntries.find((entry) => entry.id === parentId) || null,
    [parentEntries, parentId]
  );

  const getStudentClassName = React.useCallback((studentId: string) => {
    const matchedClass = classes.find(classItem =>
      (classItem?.student_ids || []).map((id: any) => String(id)).includes(String(studentId))
    );

    return matchedClass?.name ? String(matchedClass.name) : 'No Class';
  }, [classes]);

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-brand-500 text-white text-xs font-black uppercase tracking-[0.2em] shadow-lg shadow-brand-500/30 ring-2 ring-brand-500/20 hover:bg-brand-600 transition-all"
        >
          <i className="fas fa-arrow-left text-[11px]"></i>
          Back to Parent Directory
        </button>
      </div>

      {!parent ? (
        <div className="rounded-[32px] border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 text-center text-sm font-semibold text-slate-500">
          Parent not found.
        </div>
      ) : (
        <article className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-premium p-6 sm:p-8 space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2 min-w-0">
              <span className="inline-flex px-3 py-1 rounded-full bg-brand-500/10 text-brand-600 text-[10px] font-black uppercase tracking-[0.2em]">
                {parent.role}
              </span>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white break-words">{parent.name}</h2>
              <p className="text-sm text-slate-500 dark:text-slate-300">Full guardian and linked student details</p>
            </div>
            <div className="rounded-[22px] bg-slate-50 dark:bg-slate-800 px-4 py-3 text-right shrink-0">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Linked Students</p>
              <p className="mt-2 text-2xl font-black tracking-tight text-slate-900 dark:text-white">{parent.students.length}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 px-4 py-3 border border-slate-100 dark:border-slate-700">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Phone</p>
              <p className="mt-1 font-semibold text-slate-700 dark:text-slate-200">{parent.phone || 'No phone provided'}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 px-4 py-3 border border-slate-100 dark:border-slate-700">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Email</p>
              <p className="mt-1 font-semibold text-slate-700 dark:text-slate-200 break-all">{parent.email || 'No email provided'}</p>
            </div>
          </div>

          <div className="space-y-3">
            {parent.students.map((student) => (
              <div key={`${parent.id}-${student.id}`} className="rounded-[24px] bg-slate-50 dark:bg-slate-800/70 border border-slate-100 dark:border-slate-700 p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div>
                    <p className="text-lg font-black tracking-tight text-slate-900 dark:text-white">{student.name}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-300">{student.email || 'No student email'}</p>
                  </div>
                  <span className="inline-flex px-3 py-1 rounded-full bg-white dark:bg-slate-900 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 border border-slate-200 dark:border-slate-700">
                    {getStudentClassName(student.id)}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="rounded-2xl bg-white dark:bg-slate-900 px-4 py-3 border border-slate-200 dark:border-slate-700">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Gender</p>
                    <p className="mt-1 font-semibold text-slate-700 dark:text-slate-200">{student.gender || '—'}</p>
                  </div>
                  <div className="rounded-2xl bg-white dark:bg-slate-900 px-4 py-3 border border-slate-200 dark:border-slate-700">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Date of Birth</p>
                    <p className="mt-1 font-semibold text-slate-700 dark:text-slate-200">{formatStudentDate(student.date_of_birth)}</p>
                  </div>
                  <div className="rounded-2xl bg-white dark:bg-slate-900 px-4 py-3 border border-slate-200 dark:border-slate-700">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Status</p>
                    <p className="mt-1 font-semibold text-slate-700 dark:text-slate-200">{student.status}</p>
                  </div>
                  <div className="rounded-2xl bg-white dark:bg-slate-900 px-4 py-3 border border-slate-200 dark:border-slate-700">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Student Type</p>
                    <p className="mt-1 font-semibold text-slate-700 dark:text-slate-200">{student.type || '—'}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </article>
      )}
    </div>
  );
};

export default ParentDetailPage;
