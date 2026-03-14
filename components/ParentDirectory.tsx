import React from 'react';
import { Student } from '../types';
import { ParentRole, buildParentEntries } from './parentDirectoryUtils';

interface ParentDirectoryProps {
  students: Student[];
  onOpenParent: (parentId: string) => void;
}

const ParentDirectory: React.FC<ParentDirectoryProps> = ({ students, onOpenParent }) => {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [roleFilter, setRoleFilter] = React.useState<'all' | ParentRole>('all');

  const parentEntries = React.useMemo(() => buildParentEntries(students), [students]);

  const filteredParents = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return parentEntries.filter((parent) => {
      const matchesRole = roleFilter === 'all' || parent.role === roleFilter;
      const matchesQuery = !query || [
        parent.name,
        parent.email,
        parent.phone,
        ...parent.students.map((student) => student.name),
        ...parent.students.map((student) => student.email),
      ].some((value) => String(value || '').toLowerCase().includes(query));

      return matchesRole && matchesQuery;
    });
  }, [parentEntries, roleFilter, searchQuery]);

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <div className="bg-white dark:bg-slate-900 rounded-[32px] sm:rounded-[48px] lg:rounded-[56px] p-6 sm:p-8 lg:p-10 border border-slate-100 dark:border-slate-800 shadow-premium space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-500">Families</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tighter mt-2">Parent Directory</h2>
            <p className="text-sm sm:text-base text-slate-500 mt-3">View parents and guardians directly from the student records, with each linked student shown underneath.</p>
          </div>
          <div className="rounded-[24px] bg-slate-50 dark:bg-slate-800 px-5 py-4 min-w-[180px]">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Visible Parents</p>
            <p className="mt-2 text-2xl font-black tracking-tight text-slate-900 dark:text-white">{filteredParents.length}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_220px] gap-4">
          <label className="space-y-2">
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Search Parent or Student</span>
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by parent name, phone, email, or student"
              className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 text-sm font-semibold"
            />
          </label>

          <label className="space-y-2">
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Guardian Type</span>
            <select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value as 'all' | ParentRole)}
              className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 text-sm font-semibold"
            >
              <option value="all">All Guardians</option>
              <option value="Primary Parent">Primary Parent</option>
              <option value="Secondary Parent">Secondary Parent</option>
            </select>
          </label>
        </div>
      </div>

      {filteredParents.length === 0 ? (
        <div className="rounded-[32px] border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 text-center text-sm font-semibold text-slate-500">
          No parent records found from the current student data.
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {filteredParents.map((parent) => (
            <button
              key={parent.id}
              type="button"
              onClick={() => onOpenParent(parent.id)}
              className="w-full text-left bg-white dark:bg-slate-900 rounded-[28px] border border-slate-100 dark:border-slate-800 p-5 shadow-premium transition-all hover:-translate-y-0.5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-2">
                  <span className="inline-flex px-3 py-1 rounded-full bg-brand-500/10 text-brand-600 text-[10px] font-black uppercase tracking-[0.2em]">
                    {parent.role}
                  </span>
                  <h3 className="text-xl font-black tracking-tight text-slate-900 dark:text-white break-words">{parent.name}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-300 truncate">{parent.phone || parent.email || 'No contact provided'}</p>
                </div>
                <div className="rounded-[20px] bg-slate-50 dark:bg-slate-800 px-3 py-2 text-right shrink-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Students</p>
                  <p className="mt-1 text-xl font-black tracking-tight text-slate-900 dark:text-white">{parent.students.length}</p>
                </div>
              </div>
              <p className="mt-4 text-xs font-black uppercase tracking-widest text-brand-500">Click to view full information</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ParentDirectory;