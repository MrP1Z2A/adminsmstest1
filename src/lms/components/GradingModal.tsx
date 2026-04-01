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
  percentages: Record<string, string>;
  notes: Record<string, string>;
  onBack: () => void;
  onGrade: (studentId: string, grade: string) => void;
  onPercentageChange: (studentId: string, percentage: string) => void;
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
  percentages,
  notes,
  onBack,
  onGrade,
  onPercentageChange,
  onNoteChange,
  onSaveNote,
  savingNoteStudentId = null,
  isLoading = false,
}: GradingModalProps) {
  if (!exam) return null;

  return (
    <div className="space-y-8 animate-fadeIn text-slate-100">
      <div className="bg-white/10 backdrop-blur-2xl shadow-xl rounded-[40px] p-8 md:p-10 border border-white/20">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2">
            <p className="text-[10px] font-black text-[#4ea59d] uppercase tracking-[0.4em]">Grading Workspace</p>
            <h2 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tight">{exam.title}</h2>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#4ea59d]"></span>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Class: {className || '-'}</p>
            </div>
          </div>
          <button
            onClick={onBack}
            className="px-6 py-3 bg-white/5 border border-white/10 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-white/10 transition-all flex items-center gap-2"
          >
            <i className="fa-solid fa-arrow-left"></i> Back to Exams
          </button>
        </div>
      </div>

      <div className="bg-white/5 backdrop-blur-xl rounded-[40px] border border-white/10 p-8 shadow-2xl relative overflow-hidden">
        <div className="mb-8 flex items-center justify-between border-b border-white/5 pb-6">
          <h3 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-3">
            <i className="fa-solid fa-users-viewfinder text-[#4ea59d]"></i> 
            Student Evaluations
          </h3>
          <span className="px-4 py-1.5 rounded-full bg-[#4ea59d]/10 text-[#4ea59d] text-[10px] font-black uppercase tracking-widest">
            {students.length} Students Enrolled
          </span>
        </div>

        {isLoading ? (
          <div className="py-20 text-center space-y-4">
            <div className="w-12 h-12 border-4 border-[#4ea59d]/30 border-t-[#4ea59d] rounded-full animate-spin mx-auto"></div>
            <p className="text-slate-400 text-sm font-bold uppercase tracking-widest animate-pulse">Synchronizing Student Data...</p>
          </div>
        ) : (
          <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
            {students.map((student) => (
              <div key={student.id} className="group bg-white/5 hover:bg-white/10 rounded-[32px] border border-white/10 hover:border-[#4ea59d]/30 p-6 transition-all duration-300">
                <div className="flex flex-col lg:flex-row gap-6 lg:items-center lg:justify-between">
                  {/* Student Info */}
                  <div className="flex items-center gap-4 min-w-[200px]">
                    <div className="w-12 h-12 rounded-2xl bg-[#4ea59d]/20 border border-[#4ea59d]/30 flex items-center justify-center text-xl font-black text-[#4ea59d] shadow-lg group-hover:scale-110 transition-transform">
                      {student.name.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-black text-white text-base tracking-tight">{student.name}</h4>
                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Student Portal Access Enabled</p>
                    </div>
                  </div>

                  {/* Grading Controls */}
                  <div className="flex-1 flex flex-col xl:flex-row gap-6 xl:items-center xl:justify-end">
                    {/* Grade Selector */}
                    <div className="flex flex-wrap gap-1.5">
                      {gradeOptions.map((grade) => (
                        <button
                          key={grade}
                          type="button"
                          onClick={() => onGrade(student.id, grade)}
                          className={`w-10 h-10 rounded-xl text-xs font-black transition-all duration-300 active:scale-90 ${
                            grades[student.id] === grade
                              ? 'bg-[#4ea59d] text-white shadow-lg shadow-[#4ea59d]/30 scale-110'
                              : 'bg-white/5 border border-white/10 text-slate-400 hover:border-[#4ea59d]/50 hover:text-white'
                          }`}
                        >
                          {grade}
                        </button>
                      ))}
                    </div>

                    {/* Numeric Input & Notes */}
                    <div className="flex flex-col sm:flex-row items-center gap-3">
                      <div className="relative w-full sm:w-28">
                        <input
                          type="text"
                          value={percentages[student.id] || ''}
                          onChange={(e) => onPercentageChange(student.id, e.target.value)}
                          placeholder="0"
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-[#4ea59d] transition-all text-center pr-8"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-[10px] font-black">%</span>
                      </div>

                      <div className="flex-1 w-full relative">
                        <input
                          type="text"
                          value={notes[student.id] || ''}
                          onChange={(e) => onNoteChange(student.id, e.target.value)}
                          placeholder="Teacher commentary & insight..."
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-200 focus:outline-none focus:border-[#4ea59d] transition-all"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => onSaveNote(student.id)}
                        disabled={savingNoteStudentId === student.id}
                        className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 ${
                          savingNoteStudentId === student.id
                            ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                            : 'bg-[#4ea59d] text-white shadow-[#4ea59d]/20 hover:bg-[#3d8c85]'
                        }`}
                      >
                        {savingNoteStudentId === student.id ? (
                          <span className="flex items-center gap-2">
                            <i className="fa-solid fa-spinner animate-spin"></i> Saving
                          </span>
                        ) : 'Save Data'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {students.length === 0 && !isLoading && (
              <div className="py-20 text-center space-y-6">
                <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto border border-white/10">
                  <i className="fa-solid fa-users-slash text-slate-600 text-3xl"></i>
                </div>
                <div className="space-y-2">
                  <h4 className="text-xl font-black text-white">No Students Found</h4>
                  <p className="text-slate-500 text-sm max-w-md mx-auto">This course doesn't appear to have any enrolled students yet. Please verify assignments in the Academic Directory.</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
