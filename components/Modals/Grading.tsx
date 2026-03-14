import React from 'react';

type Exam = {
  id: string;
  title: string;
};

type Student = {
  id: string;
  name: string;
};

type GradingModalProps = {
  exam: Exam | null;
  className?: string;
  students: Student[];
  grades: Record<string, string>;
  notes: Record<string, string>;
  onBack: () => void;
  onGrade: (studentId: string, grade: string) => void;
  onNoteChange: (studentId: string, note: string) => void;
  onSaveNote: (studentId: string) => void;
  savingNoteStudentId?: string | null;
  isLoading?: boolean;
};

const gradeOptions = ['A+', 'A', 'B', 'C', 'D', 'E', 'F'] as const;

export default function GradingModal({
  exam,
  className,
  students,
  grades,
  notes,
  onBack,
  onGrade,
  onNoteChange,
  onSaveNote,
  savingNoteStudentId = null,
  isLoading = false,
}: GradingModalProps) {
  if (!exam) return null;

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-700">
      <div className="bg-gradient-to-r from-emerald-900 via-emerald-700 to-teal-600 rounded-[40px] p-6 sm:p-8 lg:p-10 text-white shadow-premium">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-emerald-200">Grading Workspace</p>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tighter mt-2">{exam.title}</h2>
            <p className="text-emerald-100 mt-2 text-sm">Class: {className || '-'}</p>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="rounded-2xl bg-white/15 px-4 py-2.5 text-xs font-black uppercase tracking-widest hover:bg-white/25"
          >
            Back to Exams
          </button>
        </div>
      </div>

      <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-premium">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-xl font-black tracking-tight">Student Grades and Comments</h3>
          <span className="text-xs font-black uppercase tracking-widest text-slate-500">{students.length} Students</span>
        </div>

        {isLoading ? (
          <p className="py-10 text-center text-zinc-500">Loading students...</p>
        ) : (
          <div className="space-y-4">
            {students.map((student) => (
              <div key={student.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-200 font-bold text-zinc-600">
                      {student.name.charAt(0)}
                    </div>
                    <span className="font-semibold">{student.name}</span>
                  </div>

                  <div className="w-full lg:w-auto">
                    <div className="flex flex-wrap gap-1 justify-start lg:justify-end">
                      {gradeOptions.map((grade) => (
                        <button
                          key={grade}
                          type="button"
                          onClick={() => onGrade(student.id, grade)}
                          className={`h-8 min-w-8 px-2 rounded-lg text-xs font-bold transition-all ${
                            grades[student.id] === grade
                              ? 'scale-110 bg-zinc-900 text-white'
                              : 'border border-zinc-200 bg-white text-zinc-400 hover:border-zinc-400'
                          }`}
                        >
                          {grade}
                        </button>
                      ))}
                    </div>

                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <input
                        type="text"
                        value={notes[student.id] || ''}
                        onChange={(event) => onNoteChange(student.id, event.target.value)}
                        placeholder="Add teacher comment for this student"
                        className="w-full sm:min-w-[280px] rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                      />
                      <button
                        type="button"
                        onClick={() => onSaveNote(student.id)}
                        className="rounded-xl bg-brand-500 px-3 py-2 text-xs font-black uppercase tracking-widest text-white hover:bg-brand-600"
                      >
                        {savingNoteStudentId === student.id ? 'Saving...' : 'Save Note'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {students.length === 0 && (
              <p className="py-10 text-center text-zinc-500">No students found in this class.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}