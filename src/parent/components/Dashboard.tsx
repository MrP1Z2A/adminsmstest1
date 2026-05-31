
import React, { useEffect, useState, useCallback } from 'react';
import { fetchParentPortalData, ParentPortalData, ExamResult, fetchEvents } from '../services/smsService';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from 'recharts';
import {
  Calendar, TrendingUp, RefreshCw, CheckCircle2, CreditCard,
  Activity, Users, BookOpen, AlertCircle, Download, FileDown, FileText
} from 'lucide-react';

interface DashboardProps {
  parentEmail?: string;
  studentNames?: string[];
  studentIds?: string[];
  schoolId?: string;
  onNoticeClick?: (notice: any) => void;
}

const StatCard = ({ label, value, sub, subColor = 'text-emerald-500', icon: Icon }: any) => (
  <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
    <div className="flex items-start justify-between mb-3">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{label}</p>
      {Icon && <div className="p-2 bg-slate-50 rounded-xl text-slate-400 group-hover:text-brand-600 transition-colors"><Icon className="w-4 h-4" /></div>}
    </div>
    <p className="text-3xl font-black text-slate-900 tracking-tight">{value}</p>
    {sub && <p className={`text-[10px] font-bold mt-2 flex items-center gap-1 ${subColor}`}>{sub}</p>}
  </div>
);

const Dashboard: React.FC<DashboardProps> = ({ parentEmail, studentNames, studentIds, schoolId, onNoticeClick }) => {
  const [data, setData] = useState<ParentPortalData | null>(null);
  const [syncing, setSyncing] = useState(true);
  const [events, setEvents] = useState<any[]>([]);

  const studentName = studentNames?.length ? studentNames[0] : 'Student';
  const primaryId = studentIds?.length ? studentIds[0] : '';

  const fetchData = useCallback(async () => {
    setSyncing(true);
    setData(null); // Clear old data to prevent leakage while fetching
    try {
      const [result, evs] = await Promise.all([
        fetchParentPortalData(studentIds || [], schoolId),
        schoolId ? fetchEvents(schoolId) : Promise.resolve([])
      ]);
      setData(result);
      setEvents(evs.slice(0, 3));
    } catch (e) {
      console.error('Dashboard fetch failed:', e);
    } finally {
      setSyncing(false);
    }
  }, [studentIds?.join(','), schoolId]);

  const downloadPaymentHistory = () => {
    if (!data?.payments || data.payments.length === 0) return;
    
    const headers = ['Date', 'Description', 'Amount', 'Status', 'Note'];
    const csvContent = [
      headers.join(','),
      ...data.payments.map(p => [
        p.date,
        `"${p.description.replace(/"/g, '""')}"`,
        p.amount,
        p.status,
        `"${(p.note || '').replace(/"/g, '""')}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `payment_history_${studentName.replace(/\s+/g, '_')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadInvoice = (payment: any) => {
    // Simulated invoice download
    const invoiceContent = `
      INVOICE
      -----------------
      Student: ${studentName}
      Date: ${payment.date}
      Description: ${payment.description}
      Amount: ${payment.amount} MMK
      Status: ${payment.status}
      Note: ${payment.note || 'N/A'}
    `;
    const blob = new Blob([invoiceContent], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `invoice_${payment.id}.txt`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => { fetchData(); }, [fetchData]);

const COLORS = ['#4ea59d', '#3f857e', '#366c67', '#2f5854', '#134e4a'];

  // Derive chart data from exam results (per subject averages)
  const chartData: { subject: string; score: number }[] = [];
  if (data?.examResults) {
    const subjectMap: Record<string, number[]> = {};
    data.examResults.forEach(e => {
      if (!subjectMap[e.subject]) subjectMap[e.subject] = [];
      subjectMap[e.subject].push(e.score);
    });
    Object.entries(subjectMap).forEach(([subject, scores]) => {
      chartData.push({
        subject: subject.length > 10 ? subject.slice(0, 8) + '…' : subject,
        score: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      });
    });
  }

  const gpa = data?.reportCard?.gpa || '0.00%';
  const attendanceRate = data?.attendance?.rate || '0%';
  const pendingHomework = data?.homework?.filter(h => h.status?.toLowerCase() === 'pending').length ?? 0;
  const overduePayments = data?.payments?.filter(p => p.status?.toLowerCase() === 'pending' || p.status === 'Overdue').length ?? 0;
  const totalAbsent = data?.attendance?.absent ?? 0;

  return (
    <div className="space-y-6 animate-fadeIn pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Parental Dashboard</h1>
          <div className="flex items-center gap-3 text-slate-500 text-sm mt-1 flex-wrap">
            <p>Monitoring <span className="font-black text-brand-600">{studentName}</span></p>
            {data && (
              <span className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-3 py-0.5 rounded-full text-[10px] font-black border border-emerald-100">
                <span className={`w-1.5 h-1.5 bg-emerald-500 rounded-full ${syncing ? 'animate-pulse' : ''}`} />
                {syncing ? 'Syncing…' : `Last: ${data.lastSync}`}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={fetchData} disabled={syncing}
          className="bg-white border border-slate-100 px-4 py-2.5 rounded-xl text-slate-600 hover:text-brand-600 hover:border-brand-100 transition-all shadow-sm flex items-center gap-2 text-sm font-bold active:scale-95 disabled:opacity-50 self-start"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin text-brand-600' : ''}`} />
          {syncing ? 'Syncing…' : 'Refresh'}
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Overall Grade Percentage" value={gpa} sub="From exam grades" icon={TrendingUp} />
        <StatCard label="Attendance" value={attendanceRate} sub={`${totalAbsent} absences recorded`} icon={CheckCircle2} />
        <StatCard label="Pending Tasks" value={pendingHomework} sub={pendingHomework > 0 ? `${pendingHomework} due soon` : 'All clear!'} subColor={pendingHomework > 0 ? 'text-amber-500' : 'text-emerald-500'} icon={Activity} />
        <StatCard label="Overdue Fees" value={overduePayments} sub={overduePayments > 0 ? 'Action required' : 'Good standing'} subColor={overduePayments > 0 ? 'text-rose-500' : 'text-emerald-500'} icon={CreditCard} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Performance Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-black text-slate-900 flex items-center gap-2 uppercase tracking-tight">
              <TrendingUp className="w-5 h-5 text-brand-600" /> Academic Performance
            </h3>
            <span className="text-[10px] font-black bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg border border-emerald-100 uppercase tracking-widest">
              Live Exam Data
            </span>
          </div>
          {syncing ? (
            <div className="h-56 flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin" />
            </div>
          ) : chartData.length > 0 ? (
            <div className="h-56 w-full min-h-[224px]">
              <ResponsiveContainer width="100%" height={224}>
                <BarChart data={chartData} margin={{ top: 0, right: 0, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="subject" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} />
                  <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <Tooltip
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px', fontWeight: 'bold' }}
                  />
                  <Bar dataKey="score" radius={[8, 8, 0, 0]} barSize={36}>
                    {chartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-56 flex flex-col items-center justify-center text-slate-300 gap-3">
              <BookOpen className="w-12 h-12 opacity-40" />
              <p className="text-sm font-bold text-slate-400">No exam results available yet</p>
            </div>
          )}
        </div>

        {/* Attendance Breakdown */}
        <div className="bg-gradient-to-br from-emerald-900 to-emerald-800 p-8 rounded-2xl shadow-xl text-white relative overflow-hidden">
          <div className="absolute top-[-30%] right-[-20%] w-48 h-48 bg-white/5 rounded-full blur-3xl" />
          <div className="relative z-10 space-y-6">
            <div>
              <h3 className="font-black text-lg uppercase tracking-tighter flex items-center gap-2">
                <Users className="w-5 h-5" /> Attendance
              </h3>
              <p className="text-brand-300 text-[10px] font-bold uppercase tracking-widest mt-1">Current Period</p>
            </div>
            <div className="text-5xl font-black tracking-tighter">{attendanceRate}</div>
            <div className="space-y-3">
              {[
                { label: 'Present', value: data?.attendance?.present ?? 0, color: 'bg-brand-400' },
                { label: 'Absent', value: data?.attendance?.absent ?? 0, color: 'bg-rose-400' },
                { label: 'Late', value: data?.attendance?.late ?? 0, color: 'bg-amber-400' },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                    <span className="text-emerald-100/80 font-bold text-xs uppercase tracking-widest">{item.label}</span>
                  </div>
                  <span className="font-black text-white">{item.value} days</span>
                </div>
              ))}
            </div>
            <div className="pt-4 border-t border-white/10">
              <p className="text-[10px] font-black text-brand-100/40 uppercase tracking-widest">
                Total: {data?.attendance?.total ?? 0} school days
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Notices / Bulletins */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="font-black text-slate-900 mb-5 flex items-center gap-2 uppercase tracking-tight">
            <Calendar className="w-5 h-5 text-brand-600" /> Institution Bulletins
          </h3>
          <div className="space-y-3 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
            {syncing ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="animate-pulse h-14 bg-slate-50 rounded-2xl" />
              ))
            ) : data?.notices && data.notices.length > 0 ? (
              data.notices.map((note, idx) => (
                <div
                   key={idx}
                   onClick={() => onNoticeClick?.(note)}
                   className="flex flex-col gap-2 p-5 bg-slate-50 rounded-2xl border-l-4 border-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer group"
                >
                  <div className="flex justify-between items-center">
                    <h4 className="text-sm font-black text-slate-900 group-hover:text-emerald-700 transition-colors">{note.title}</h4>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{note.date}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-slate-300 gap-2">
                <AlertCircle className="w-10 h-10 opacity-40" />
                <p className="text-sm font-bold text-slate-400">No notices available</p>
              </div>
            )}
          </div>
        </div>

        {/* Upcoming Events */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="font-black text-slate-900 mb-5 flex items-center gap-2 uppercase tracking-tight">
            <Calendar className="w-5 h-5 text-purple-600" /> Upcoming Events
          </h3>
          <div className="space-y-4 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
            {syncing ? (
              Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="animate-pulse h-16 bg-slate-50 rounded-2xl" />
              ))
            ) : events.length > 0 ? (
              events.map((event, idx) => (
                <div key={idx} className="flex gap-4 p-4 bg-slate-50/50 rounded-2xl border border-slate-50 hover:bg-purple-50 hover:border-purple-100 transition-all group">
                  <div className="flex flex-col items-center justify-center bg-white border border-slate-100 rounded-xl px-3 py-2 shrink-0 h-fit group-hover:border-purple-200 shadow-sm">
                    <span className="text-purple-600 text-[10px] font-black uppercase tracking-widest">{new Date(event.event_date).toLocaleString('default', { month: 'short' })}</span>
                    <span className="text-slate-900 text-lg font-black leading-none mt-1">{new Date(event.event_date).getDate()}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[9px] font-black px-2 py-0.5 rounded bg-slate-200 text-slate-600 uppercase tracking-widest">{event.type}</span>
                    </div>
                    <h4 className="text-sm font-black text-slate-900 truncate">{event.title}</h4>
                    <p className="text-[10px] text-slate-500 font-bold truncate mt-1 flex items-center gap-1">
                      <TrendingUp className="w-3 h-3 text-emerald-500" /> {event.location || 'Institutional Campus'}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-slate-300 gap-2">
                <Calendar className="w-10 h-10 opacity-40" />
                <p className="text-sm font-bold text-slate-400">No upcoming events</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Payments */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-black text-slate-900 flex items-center gap-2 uppercase tracking-tight">
              <CreditCard className="w-5 h-5 text-brand-600" /> Financial Standing
            </h3>
            <button
              onClick={downloadPaymentHistory}
              className="text-[10px] font-black bg-slate-100 hover:bg-emerald-600 hover:text-white px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 uppercase tracking-widest"
            >
              <Download className="w-3.5 h-3.5" /> History
            </button>
          </div>
          <div className="space-y-3 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
            {syncing ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="animate-pulse h-14 bg-slate-50 rounded-2xl" />
              ))
            ) : data?.payments && data.payments.length > 0 ? (
              data.payments.map(pay => (
                <div key={pay.id} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 hover:border-emerald-100 hover:bg-emerald-50/20 transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${pay.status.toLowerCase() === 'paid' ? 'bg-brand-50 text-brand-600' :
                        pay.status.toLowerCase() === 'overdue' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'
                      }`}>
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-800 leading-tight">{pay.description}</h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{pay.date}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right shrink-0">
                      <p className="text-base font-black text-slate-900">{Number(pay.amount).toLocaleString()} MMK</p>
                      <span className={`text-[9px] font-black px-2.5 py-0.5 rounded-md uppercase tracking-widest ${pay.status.toLowerCase() === 'paid' ? 'bg-brand-100 text-brand-700' :
                          pay.status.toLowerCase() === 'overdue' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                        }`}>{pay.status}</span>
                    </div>
                    <button
                      onClick={() => downloadInvoice(pay)}
                      className="p-2 text-slate-300 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      title="Download Invoice"
                    >
                      <FileDown className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-slate-300 gap-2">
                <CreditCard className="w-10 h-10 opacity-40" />
                <p className="text-sm font-bold text-slate-400">No payment records found</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pending Homework */}
      <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden mt-8">
        <div className="p-7 border-b border-slate-50 flex items-center justify-between">
          <h3 className="font-black text-slate-900 flex items-center gap-3 uppercase tracking-tight">
            <BookOpen className="w-5 h-5 text-brand-600" /> Pending Homework
          </h3>
          <span className="text-[10px] text-amber-600 font-black uppercase tracking-widest bg-amber-50 px-3 py-1 rounded-lg border border-amber-100">
            {data?.homework?.filter(h => h.status?.toLowerCase() === 'pending').length || 0} Tasks
          </span>
        </div>
        <div className="overflow-x-auto max-h-80 overflow-y-auto custom-scrollbar">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
                <th className="px-7 py-5">Assignment Title</th>
                <th className="px-7 py-5">Description</th>
                <th className="px-7 py-5">Due Date</th>
                <th className="px-7 py-5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {syncing ? (
                <tr>
                  <td colSpan={4} className="px-7 py-16 text-center">
                    <div className="w-10 h-10 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-slate-400 text-sm font-bold">Fetching assignments…</p>
                  </td>
                </tr>
              ) : data?.homework && data.homework.filter(h => h.status?.toLowerCase() === 'pending').length > 0 ? (
                data.homework
                  .filter(h => h.status?.toLowerCase() === 'pending')
                  .map((hw, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/30 transition-all group">
                      <td className="px-7 py-5">
                        <p className="font-bold text-slate-900 text-sm">{hw.title}</p>
                      </td>
                      <td className="px-7 py-5 text-xs text-slate-500 max-w-xs truncate" title={hw.description}>
                        {hw.description || 'No description provided'}
                      </td>
                      <td className="px-7 py-5">
                        <div className="flex items-center gap-2 text-slate-600">
                          <Calendar className="w-3.5 h-3.5" />
                          <span className="text-xs font-bold">{hw.dueDate || '—'}</span>
                        </div>
                      </td>
                      <td className="px-7 py-5 text-center">
                        <span className="px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-amber-50 text-amber-700 border border-amber-100 italic">
                          Pending
                        </span>
                      </td>
                    </tr>
                  ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-7 py-16 text-center">
                    <div className="flex flex-col items-center justify-center gap-3 text-slate-300">
                      <CheckCircle2 className="w-12 h-12 opacity-40 text-emerald-500" />
                      <p className="text-sm font-bold text-slate-400">All assignments completed!</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Exam Results */}
      <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden mt-8 mb-10">
        <div className="p-7 border-b border-slate-50 flex items-center justify-between">
          <h3 className="font-black text-slate-900 flex items-center gap-3 uppercase tracking-tight">
            <Activity className="w-5 h-5 text-purple-600" /> Recent Exam Results
          </h3>
          <span className="text-[10px] text-purple-600 font-black uppercase tracking-widest bg-purple-50 px-3 py-1 rounded-lg border border-purple-100">
            {data?.examResults?.length || 0} Results
          </span>
        </div>
        <div className="overflow-x-auto max-h-80 overflow-y-auto custom-scrollbar">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
                <th className="px-7 py-5">Subject / Exam</th>
                <th className="px-7 py-5">Date</th>
                <th className="px-7 py-5 text-right">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data?.examResults && data.examResults.length > 0 ? (
                data.examResults.map((result, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/30 transition-all group">
                    <td className="px-7 py-5">
                      <p className="font-bold text-slate-900 text-sm">{result.subject}</p>
                    </td>
                    <td className="px-7 py-5 text-xs text-slate-500 font-medium">
                      {result.date || 'N/A'}
                    </td>
                    <td className="px-7 py-5 text-right">
                      <span className={`inline-flex items-center px-4 py-1.5 rounded-xl text-xs font-black shadow-sm border ${
                        result.score >= 80 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                        result.score >= 50 ? 'bg-amber-50 text-amber-700 border-amber-100' :
                        'bg-rose-50 text-rose-700 border-rose-100'
                      }`}>
                        {result.score}%
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="px-7 py-16 text-center text-slate-400 text-sm font-bold">
                    No individual exam results found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
