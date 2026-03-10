import React from 'react';
import { Student } from '../types';

/**
 * RegistrationHub Component
 * 
 * The central hub for onboarding new students and managing recent registrations.
 * Provides quick actions for new student onboarding and batch import.
 */

interface RegistrationHubProps {
  students: Student[];
  enrollStudentAction: (type: 'New' | 'Old') => void;
  batchRegisterStudents: (file: File) => Promise<void>;
  isBatchRegistering: boolean;
  deleteEntity: (id: string, type: string) => void;
}

const RegistrationHub: React.FC<RegistrationHubProps> = ({
  students,
  enrollStudentAction,
  batchRegisterStudents,
  isBatchRegistering,
  deleteEntity
}) => {
  const batchFileInputRef = React.useRef<HTMLInputElement | null>(null);

  return (
    <div className="space-y-12 animate-in fade-in duration-700 pb-20">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-10">
        <div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tighter">Registration Hub</h2>
          <p className="text-sm text-slate-400 font-bold uppercase tracking-[0.3em] mt-3">Node Onboarding Suite</p>
        </div>
      </div>

      {/* Onboarding Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        <div className="bg-white dark:bg-slate-900 p-8 sm:p-10 lg:p-12 rounded-[36px] sm:rounded-[48px] lg:rounded-[64px] shadow-premium border border-slate-100 dark:border-slate-800 text-center space-y-6 sm:space-y-8">
          <div className="w-24 h-24 bg-indigo-500/10 text-indigo-500 rounded-[32px] flex items-center justify-center text-4xl mx-auto shadow-inner">
            <i className="fas fa-user-plus"></i>
          </div>
          <h4 className="text-2xl sm:text-3xl font-black tracking-tight">New Student Protocol</h4>
          <p className="text-slate-400 text-sm font-semibold max-w-xs mx-auto">Register a student profile and initialize their account.</p>
          <button 
            onClick={() => enrollStudentAction('New')} 
            className="w-full py-6 bg-indigo-500 text-white font-black rounded-3xl text-xs uppercase tracking-widest shadow-xl shadow-indigo-500/20 active:scale-95 transition-all"
          >
            Register Student
          </button>
        </div>

        <div className="bg-white dark:bg-slate-900 p-8 sm:p-10 lg:p-12 rounded-[36px] sm:rounded-[48px] lg:rounded-[64px] shadow-premium border border-slate-100 dark:border-slate-800 text-center space-y-6 sm:space-y-8">
          <div className="w-24 h-24 bg-emerald-500/10 text-emerald-500 rounded-[32px] flex items-center justify-center text-4xl mx-auto shadow-inner">
            <i className="fas fa-file-import"></i>
          </div>
          <h4 className="text-2xl sm:text-3xl font-black tracking-tight">Batch Student Registration</h4>
          <p className="text-slate-400 text-sm font-semibold max-w-xs mx-auto">Import students from spreadsheet files (.csv, .xls, .xlsx, .ods).</p>
          <button
            onClick={() => {
              if (isBatchRegistering) return;
              batchFileInputRef.current?.click();
            }}
            disabled={isBatchRegistering}
            className={`w-full py-6 text-white font-black rounded-3xl text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all ${isBatchRegistering ? 'bg-emerald-300 cursor-not-allowed' : 'bg-emerald-500 shadow-emerald-500/20'}`}
          >
            {isBatchRegistering ? 'Importing...' : 'Upload Spreadsheet'}
          </button>
          <input
            ref={batchFileInputRef}
            type="file"
            accept=".csv,.tsv,.xls,.xlsx,.ods"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              await batchRegisterStudents(file);
              e.target.value = '';
            }}
          />
        </div>
      </div>

      {/* Recent Registrations Quick List */}
      <div className="bg-white dark:bg-slate-900 rounded-[32px] sm:rounded-[48px] lg:rounded-[64px] p-6 sm:p-8 lg:p-10 shadow-premium border border-slate-100 dark:border-slate-800">
        <h4 className="text-xl sm:text-2xl font-black mb-8 sm:mb-10 flex items-center gap-4">
          <div className="w-2 h-8 bg-rose-500 rounded-full"></div>
          Recent Registrations (Quick Termination)
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {students.slice(0, 6).map(s => (
            <div key={s.id} className="p-8 bg-slate-50 dark:bg-slate-800/50 rounded-[40px] flex items-center justify-between group">
              <div className="flex items-center gap-5">
                <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-700 flex items-center justify-center font-black text-brand-500 shadow-sm">
                  {s.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-black truncate max-w-[120px]">{s.name}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">{s.id}</p>
                </div>
              </div>
              <button 
                onClick={() => deleteEntity(s.id, 'student')} 
                className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 text-slate-300 hover:text-rose-500 transition-all shadow-sm flex items-center justify-center"
              >
                <i className="fas fa-trash-can text-sm"></i>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RegistrationHub;
