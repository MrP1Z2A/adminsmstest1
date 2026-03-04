import React from 'react';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface TeacherEnrollmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  enrollData: {
    name: string;
    email: string;
  };
  setEnrollData: (data: { name: string; email: string }) => void;
  onSubmit: () => void;
}

const TeacherEnrollmentModal: React.FC<TeacherEnrollmentModalProps> = ({
  isOpen,
  onClose,
  enrollData,
  setEnrollData,
  onSubmit,
}) => {
  if (!isOpen) return null;

  const isTeacherEmailValid = !enrollData.email || EMAIL_PATTERN.test(enrollData.email.trim());

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[28px] sm:rounded-[40px] lg:rounded-[56px] shadow-2xl overflow-y-auto border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-300">
        <div className="p-6 sm:p-8 lg:p-12 border-b border-slate-50 dark:border-slate-800 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-2xl sm:text-3xl font-black tracking-tighter">Initialize Teacher Node</h3>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-2">Faculty Identity Registration</p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400 flex items-center justify-center"
            title="Close"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="p-6 sm:p-8 lg:p-12 space-y-6 sm:space-y-8">
          <div>
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-3">Full Legal Name</label>
            <input
              type="text"
              placeholder="Enter teacher name..."
              className="w-full bg-slate-50 dark:bg-slate-800 p-6 rounded-3xl outline-none border-2 border-transparent focus:border-brand-500 font-bold transition-all"
              value={enrollData.name}
              onChange={(e) => setEnrollData({ ...enrollData, name: e.target.value })}
            />
          </div>

          <div>
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-3">Network Email</label>
            <input
              type="email"
              placeholder="teacher@iem.io"
              className={`w-full bg-slate-50 dark:bg-slate-800 p-6 rounded-3xl outline-none border-2 font-bold transition-all ${isTeacherEmailValid ? 'border-transparent focus:border-brand-500' : 'border-rose-400 focus:border-rose-500'}`}
              value={enrollData.email}
              onChange={(e) => setEnrollData({ ...enrollData, email: e.target.value })}
            />
            {!isTeacherEmailValid && <p className="mt-2 text-[11px] font-bold text-rose-500">Enter a valid email format (example@domain.com).</p>}
          </div>

          <div className="p-6 bg-brand-50 dark:bg-brand-500/10 rounded-3xl border border-brand-100 dark:border-brand-500/20">
            <p className="text-[10px] text-brand-600 dark:text-brand-400 font-bold leading-relaxed">
              <i className="fas fa-info-circle mr-2"></i>
              A login credential set will be generated and the teacher profile will be created with role set to teacher.
            </p>
          </div>
        </div>

        <div className="p-6 sm:p-8 lg:p-12 bg-slate-50 dark:bg-slate-900/50 flex flex-col-reverse sm:flex-row gap-3 sm:gap-4">
          <button
            onClick={onSubmit}
            className="flex-1 py-6 bg-brand-500 text-white font-black rounded-[32px] text-sm uppercase tracking-widest shadow-xl shadow-brand-500/20 active:scale-95 transition-all"
          >
            Initialize Node
          </button>
        </div>
      </div>
    </div>
  );
};

export default TeacherEnrollmentModal;
