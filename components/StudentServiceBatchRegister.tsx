import React from 'react';
import { Student } from '../types';

interface StudentServiceBatchRegisterProps {
  studentServiceStaff: Student[];
  enrollStudentServiceAction: () => void;
  batchRegisterStudentService: (file: File) => Promise<void>;
  isBatchRegistering: boolean;
  deleteEntity: (id: string, type: string) => void;
}

const StudentServiceBatchRegister: React.FC<StudentServiceBatchRegisterProps> = ({
  studentServiceStaff,
  enrollStudentServiceAction,
  batchRegisterStudentService,
  isBatchRegistering,
  deleteEntity,
}) => {
  const batchFileInputRef = React.useRef<HTMLInputElement | null>(null);

  return (
    <div className="space-y-12 animate-in fade-in duration-700 pb-20">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-10">
        <div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tighter">Student Service Hub</h2>
          <p className="text-sm text-slate-400 font-bold uppercase tracking-[0.3em] mt-3">Service Staff Onboarding Suite</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        {/* Single Registration */}
        <div className="bg-white dark:bg-slate-900 p-8 sm:p-10 lg:p-12 rounded-[36px] sm:rounded-[48px] lg:rounded-[64px] shadow-premium border border-slate-100 dark:border-slate-800 text-center space-y-6 sm:space-y-8">
          <div className="w-24 h-24 bg-cyan-500/10 text-cyan-500 rounded-[32px] flex items-center justify-center text-4xl mx-auto shadow-inner">
            <i className="fas fa-user-tie"></i>
          </div>
          <h4 className="text-2xl sm:text-3xl font-black tracking-tight">Register Staff Member</h4>
          <p className="text-slate-400 text-sm font-semibold max-w-xs mx-auto">Create a student service staff account and initialize access credentials.</p>
          <button
            onClick={enrollStudentServiceAction}
            className="w-full py-6 bg-cyan-500 text-white font-black rounded-3xl text-xs uppercase tracking-widest shadow-xl shadow-cyan-500/20 active:scale-95 transition-all"
          >
            Register Staff
          </button>
        </div>

        {/* Batch Registration */}
        <div className="bg-white dark:bg-slate-900 p-8 sm:p-10 lg:p-12 rounded-[36px] sm:rounded-[48px] lg:rounded-[64px] shadow-premium border border-slate-100 dark:border-slate-800 text-center space-y-6 sm:space-y-8">
          <div className="w-24 h-24 bg-emerald-500/10 text-emerald-500 rounded-[32px] flex items-center justify-center text-4xl mx-auto shadow-inner">
            <i className="fas fa-file-import"></i>
          </div>
          <h4 className="text-2xl sm:text-3xl font-black tracking-tight">Batch Staff Registration</h4>
          <p className="text-slate-400 text-sm font-semibold max-w-xs mx-auto">Import staff members from spreadsheet files (.csv, .xls, .xlsx, .ods).</p>
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
              await batchRegisterStudentService(file);
              e.target.value = '';
            }}
          />
        </div>
      </div>

      {/* Recent Staff List */}
      <div className="bg-white dark:bg-slate-900 rounded-[32px] sm:rounded-[48px] lg:rounded-[64px] p-6 sm:p-8 lg:p-10 shadow-premium border border-slate-100 dark:border-slate-800">
        <h4 className="text-xl sm:text-2xl font-black mb-8 sm:mb-10 flex items-center gap-4">
          <div className="w-2 h-8 bg-rose-500 rounded-full"></div>
          Recent Staff (Quick Termination)
        </h4>

        {studentServiceStaff.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <i className="fas fa-user-tie text-5xl mb-4 opacity-20"></i>
            <p className="font-bold">No student service staff registered yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {studentServiceStaff.slice(0, 10).map((staff) => (
              <div
                key={staff.id}
                className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 flex items-center justify-center overflow-hidden">
                    {staff.avatar ? (
                      <img src={staff.avatar} alt={staff.name} className="w-full h-full object-cover" />
                    ) : (
                      <i className="fas fa-user-tie text-cyan-500 text-sm"></i>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-black">{staff.name}</p>
                    <p className="text-xs text-slate-400 font-semibold">{staff.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => deleteEntity(staff.id, 'student-service')}
                  className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white flex items-center justify-center transition-all text-sm"
                  title="Remove staff"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentServiceBatchRegister;
