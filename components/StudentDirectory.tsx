import React from 'react';
import { Student } from '../types';

/**
 * StudentDirectory Component
 * 
 * Displays a searchable/filterable list of all students in the system.
 * Includes administrative controls for editing, deleting, and managing permissions.
 */

interface StudentDirectoryProps {
  students: Student[];
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  openPermissions: (student: Student) => void;
  openEditModal: (type: string, data: any) => void;
  deleteEntity: (id: string, type: string) => void;
}

const StudentDirectory: React.FC<StudentDirectoryProps> = ({
  students,
  selectedDate,
  setSelectedDate,
  openPermissions,
  openEditModal,
  deleteEntity
}) => {
  return (
    <div className="space-y-12 animate-in fade-in duration-700 pb-20">
      {/* Header Section with Title and Filters */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-10">
        <div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tighter">Directory</h2>
          <p className="text-sm text-slate-400 font-bold uppercase tracking-[0.3em] mt-3">Identity Management Protocol</p>
        </div>
        
        {/* Filter Pills */}
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="bg-white dark:bg-slate-900 p-2 rounded-[24px] sm:rounded-[32px] shadow-premium border border-slate-100 dark:border-slate-800 flex items-center gap-2">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border p-2 rounded"
              title="Filter by created date"
            />
            {selectedDate && (
              <button
                onClick={() => setSelectedDate('')}
                className="px-3 py-2 rounded-[14px] text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white dark:bg-slate-900 rounded-[32px] sm:rounded-[48px] lg:rounded-[64px] p-3 sm:p-6 shadow-premium border border-slate-100 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left">
            <thead className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] border-b border-slate-50 dark:border-slate-800">
              <tr>
                <th className="px-12 py-10">Identity Block</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {students.map(s => (
                <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-all group">
                  {/* Student Identity Card */}
                  <td className="px-12 py-10 flex items-center gap-8">
                    <div className="w-16 h-16 rounded-[28px] bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-black text-brand-500 shadow-inner group-hover:scale-110 transition-all">
                      {s.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-lg font-black tracking-tight">{s.name}</p>
                      <p className="text-[10px] text-slate-400 uppercase mt-1">{s.email} • {s.grade}</p>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default StudentDirectory;
