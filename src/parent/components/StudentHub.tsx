
import React, { useEffect, useState, useCallback } from 'react';
import { fetchParentPortalData, ParentPortalData } from '../services/smsService';
import { MOCK_STUDENT, MOCK_ACHIEVEMENTS } from '../constants';

import { Trophy, Mail, Hash, User, MapPin, Award, BookOpen, Clock, RefreshCw, ShieldCheck, Activity } from 'lucide-react';

interface StudentHubProps {
  studentNames?: string[];
  studentIds?: string[];
  schoolId?: string;
}

const StudentHub: React.FC<StudentHubProps> = ({ studentNames, studentIds, schoolId }) => {
  const [data, setData] = useState<ParentPortalData | null>(null);
  const [syncing, setSyncing] = useState(true);

  const studentName = studentNames?.length ? studentNames[0] : MOCK_STUDENT.name;
  const studentId = studentIds?.length ? studentIds[0] : MOCK_STUDENT.id;

  const fetchData = useCallback(async () => {
    setSyncing(true);
    setData(null); // Clear old results to prevent stale data visibility
    try {
      const result = await fetchParentPortalData(studentIds || [], schoolId);
      setData(result);
    } catch (e) {
      console.error('StudentHub fetch error:', e);
    } finally {
      setSyncing(false);
    }
  }, [studentIds?.join(','), schoolId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const reportCard = data?.reportCard;
  const subjects = reportCard?.subjects || [];
  const avgScore = subjects.length > 0
    ? Math.round(subjects.reduce((s, r) => s + r.score, 0) / subjects.length)
    : 0;

  return (
    <div className="space-y-8 animate-fadeIn pb-20">
      {/* Student Profile Header */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden relative">
        <div className="h-36 bg-gradient-to-r from-emerald-900 via-emerald-700 to-emerald-900 relative overflow-hidden">
          <div className="absolute top-5 right-7">
            <div className="flex items-center gap-2">
              <button onClick={fetchData} disabled={syncing} className="bg-white/10 backdrop-blur-md text-white text-[10px] px-3 py-1.5 rounded-xl font-black uppercase tracking-widest border border-white/10 flex items-center gap-1.5 hover:bg-white/20 transition-all active:scale-95 disabled:opacity-60">
                <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing…' : `Last: ${data?.lastSync || '—'}`}
              </button>
            </div>
          </div>
        </div>
        <div className="px-8 pb-8">
          <div className="relative flex flex-col md:flex-row md:items-end -mt-14 space-y-5 md:space-y-0 md:space-x-7">
            <div className="relative group/avatar">
              <div className="w-36 h-36 rounded-[2rem] border-[5px] border-white shadow-2xl bg-gradient-to-br from-emerald-100 to-emerald-50 flex items-center justify-center text-5xl font-black text-emerald-600">
                {studentName.charAt(0).toUpperCase()}
              </div>
              <div className="absolute bottom-3 right-3 bg-emerald-600 p-2 rounded-xl text-white shadow-lg border-2 border-white">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="flex-1 pb-2">
              <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">{studentName}</h2>
              <p className="text-emerald-600 font-black uppercase text-xs tracking-[0.2em] mt-2">Student ID: {studentId}</p>
            </div>
            <div className="pb-2">
              {reportCard?.file_url ? (
                <a
                  href={reportCard.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-7 py-3.5 bg-slate-900 text-white font-black rounded-2xl hover:bg-emerald-600 transition-all shadow-xl active:scale-95 text-[10px] uppercase tracking-widest flex items-center gap-2"
                >
                  <BookOpen className="w-4 h-4" /> Download {reportCard.file_name || reportCard.title || 'Report Card'}
                </a>
              ) : (
                <button disabled className="px-7 py-3.5 bg-slate-200 text-slate-400 font-black rounded-2xl text-[10px] uppercase tracking-widest flex items-center gap-2 cursor-not-allowed">
                  <BookOpen className="w-4 h-4" /> No File Available
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12 border-t border-slate-50 pt-10">
            {/* Quick Stats */}
            <div className="space-y-4">
              <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-2">
                <User className="w-4 h-4 text-emerald-600" /> Quick Stats
              </h3>
              {[
                { icon: Hash, label: 'Student ID', value: studentId },
                { icon: Activity, label: 'Avg. Score', value: `${avgScore}%` },
                { icon: Clock, label: 'Attendance', value: data?.attendance?.rate || '0%' },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex justify-between items-center bg-slate-50/50 p-4 rounded-2xl border border-transparent hover:border-emerald-100 transition-colors">
                  <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-2"><Icon className="w-4 h-4" /> {label}</span>
                  <span className="font-black text-slate-800 text-sm">{value}</span>
                </div>
              ))}
            </div>

            {/* Achievements */}
            <div className="md:col-span-2">
              <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-3 mb-5">
                <Trophy className="w-4 h-4 text-emerald-600" /> Merit &amp; Honors
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {data?.achievements && data.achievements.length > 0 ? (
                  data.achievements.map(ach => (
                    <div key={ach.id} className="bg-emerald-50/30 border border-emerald-100/50 p-5 rounded-[1.5rem] flex items-center gap-4 hover:bg-emerald-50 transition-all group">
                      <div className="bg-white p-3 rounded-2xl shadow-sm group-hover:scale-110 transition-transform">
                        <Award className={`w-6 h-6 ${ach.color || 'text-emerald-600'}`} />
                      </div>
                      <div>
                        <h4 className="font-black text-slate-800 text-sm tracking-tight">{ach.title}</h4>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{ach.date || 'Recent'}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="sm:col-span-2 p-8 border-2 border-dashed border-slate-100 rounded-[1.5rem] text-center">
                    <p className="text-slate-400 text-xs font-bold italic">No institutional honors recorded yet.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Report Card Table + Term Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-7 border-b border-slate-50 flex items-center justify-between">
            <h3 className="font-black text-slate-900 flex items-center gap-3 uppercase tracking-tight">
              <BookOpen className="w-5 h-5 text-emerald-600" /> Academic Transcript
            </h3>
            <span className="text-[10px] text-emerald-600 font-black uppercase tracking-widest bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-100">
              {reportCard?.term || 'Current Term'}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
                  <th className="px-7 py-5">Subject</th>
                  <th className="px-7 py-5">Score</th>
                  <th className="px-7 py-5">Grade</th>
                  <th className="px-7 py-5 hidden sm:table-cell">Comment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {syncing ? (
                  <tr>
                    <td colSpan={4} className="px-7 py-16 text-center">
                      <div className="w-10 h-10 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin mx-auto mb-4" />
                      <p className="text-slate-400 text-sm font-bold">Loading academic data…</p>
                    </td>
                  </tr>
                ) : subjects.length > 0 ? (
                  subjects.map((s, idx) => (
                    <tr key={idx} className="hover:bg-emerald-50/30 transition-all">
                      <td className="px-7 py-5 font-black text-slate-900 text-sm">{s.name}</td>
                      <td className="px-7 py-5">
                        <div className="flex items-center gap-3">
                          <span className="font-black text-slate-900">{s.score ?? 0}%</span>
                          <div className="w-14 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-600 transition-all" style={{ width: `${s.score ?? 0}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="px-7 py-5">
                        <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${(s.score ?? 0) >= 90 ? 'bg-emerald-600 text-white' : (s.score ?? 0) >= 80 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                          {s.grade || '—'}
                        </span>
                      </td>
                      <td className="px-7 py-5 text-[11px] text-slate-400 font-medium italic hidden sm:table-cell">{s.comment || '—'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-7 py-16 text-center text-slate-400 font-bold">No subject records found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Term Summary */}
        <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 p-7 flex flex-col gap-5">
          <h3 className="font-black text-slate-900 flex items-center gap-3 uppercase tracking-tight">
            <Clock className="w-5 h-5 text-emerald-600" /> Term Matrix
          </h3>
          <div className="bg-emerald-50 p-6 rounded-[1.5rem] border border-emerald-100">
            <p className="text-[10px] font-black text-emerald-800 uppercase tracking-[0.2em] mb-2">Attendance Rate</p>
            <p className="text-4xl font-black text-slate-900 tracking-tight">{data?.attendance?.rate || '0%'}</p>
          </div>
          <div className="bg-slate-50 p-6 rounded-[1.5rem] border border-slate-100">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Overall Grade Percentage</p>
            <p className="text-4xl font-black text-slate-900 tracking-tight">{reportCard?.gpa || '0.00'}</p>
          </div>
          <div className="bg-slate-50 p-6 rounded-[1.5rem] border border-slate-100">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Class Rank</p>
            <p className="text-2xl font-black text-slate-900 tracking-tight">{reportCard?.rank || '—'}</p>
          </div>
          <div className="mt-auto p-5 rounded-2xl border-2 border-dashed border-slate-100 flex items-center justify-center">
            <p className="text-[10px] text-slate-300 font-black uppercase tracking-[0.3em]">Academic Year 2024/25</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentHub;
