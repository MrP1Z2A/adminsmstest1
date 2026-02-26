import React from 'react';
import { Student } from '../types';

/**
 * RegistrationHub Component
 * 
 * The central hub for onboarding new students and managing recent registrations.
 * Provides quick actions for initializing "New" or "Old" student protocols.
 */

interface RegistrationHubProps {
  students: Student[];
  enrollStudentAction: (type: 'New' | 'Old') => void;
  deleteEntity: (id: string, type: string) => void;
}

const RegistrationHub: React.FC<RegistrationHubProps> = ({
  students,
  enrollStudentAction,
  deleteEntity
}) => {
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
        {/* New Student Card */}
        <div className="bg-white dark:bg-slate-900 p-8 sm:p-10 lg:p-12 rounded-[36px] sm:rounded-[48px] lg:rounded-[64px] shadow-premium border border-slate-100 dark:border-slate-800 text-center space-y-6 sm:space-y-8">
          <div className="w-24 h-24 bg-indigo-500/10 text-indigo-500 rounded-[32px] flex items-center justify-center text-4xl mx-auto shadow-inner">
            <i className="fas fa-sparkles"></i>
          </div>
          <h4 className="text-2xl sm:text-3xl font-black tracking-tight">New Student Protocol</h4>
          <p className="text-slate-400 text-sm font-semibold max-w-xs mx-auto">Initialize a new cognitive node within the institutional network.</p>
          <button 
            onClick={() => enrollStudentAction('New')} 
            className="w-full py-6 bg-indigo-500 text-white font-black rounded-3xl text-xs uppercase tracking-widest shadow-xl shadow-indigo-500/20 active:scale-95 transition-all"
          >
            Start Onboarding
          </button>
        </div>

        {/* Legacy/Old Student Card */}
        <div className="bg-white dark:bg-slate-900 p-8 sm:p-10 lg:p-12 rounded-[36px] sm:rounded-[48px] lg:rounded-[64px] shadow-premium border border-slate-100 dark:border-slate-800 text-center space-y-6 sm:space-y-8">
          <div className="w-24 h-24 bg-slate-900/10 text-slate-900 dark:text-white rounded-[32px] flex items-center justify-center text-4xl mx-auto shadow-inner">
            <i className="fas fa-clock-rotate-left"></i>
          </div>
          <h4 className="text-2xl sm:text-3xl font-black tracking-tight">Old Student Re-Entry</h4>
          <p className="text-slate-400 text-sm font-semibold max-w-xs mx-auto">Re-verify and reintegrate a legacy node into the system hubs.</p>
          <button 
            onClick={() => enrollStudentAction('Old')} 
            className="w-full py-6 bg-slate-900 text-white font-black rounded-3xl text-xs uppercase tracking-widest shadow-xl shadow-slate-900/20 active:scale-95 transition-all"
          >
            Initialize Re-Entry
          </button>
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
