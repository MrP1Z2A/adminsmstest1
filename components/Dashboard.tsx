import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

/**
 * Dashboard Component
 * 
 * This component renders the "Institutional Pulse" overview.
 * It displays key metrics like total students, attendance rate, and risk levels.
 */

interface DashboardProps {
  stats: {
    totalStudents: number;
    totalParents: number;
    demoEarning: number;
    totalTeachers: number;
    genderBreakdown: {
      male: number;
      female: number;
    };
    teacherGenderBreakdown: {
      male: number;
      female: number;
    };
  };
}

const Dashboard: React.FC<DashboardProps> = ({ stats }) => {
  const totalStudents = stats.genderBreakdown.male + stats.genderBreakdown.female;
  const totalTeachers = stats.teacherGenderBreakdown.male + stats.teacherGenderBreakdown.female;
  const maleValue = stats.genderBreakdown.male;
  const femaleValue = stats.genderBreakdown.female;
  const maleTeacherValue = stats.teacherGenderBreakdown.male;
  const femaleTeacherValue = stats.teacherGenderBreakdown.female;

  const maleColor = '#10b981';
  const femaleColor = '#84cc16';
  const maleTrack = '#d1fae5';
  const femaleTrack = '#ecfccb';

  const maleRingData = [
    { name: 'Male', value: maleValue },
    { name: 'Remaining', value: Math.max(totalStudents - maleValue, 0) },
  ];

  const femaleRingData = [
    { name: 'Female', value: femaleValue },
    { name: 'Remaining', value: Math.max(totalStudents - femaleValue, 0) },
  ];

  const maleTeacherRingData = [
    { name: 'Male', value: maleTeacherValue },
    { name: 'Remaining', value: Math.max(totalTeachers - maleTeacherValue, 0) },
  ];

  const femaleTeacherRingData = [
    { name: 'Female', value: femaleTeacherValue },
    { name: 'Remaining', value: Math.max(totalTeachers - femaleTeacherValue, 0) },
  ];

  const examResultDemoData = [
    { grade: 'G1', percentage: 43 },
    { grade: 'G2', percentage: 65 },
    { grade: 'G3', percentage: 86 },
    { grade: 'G4', percentage: 88 },
    { grade: 'G5', percentage: 100 },
    { grade: 'G6', percentage: 95 },
    { grade: 'G7', percentage: 85 },
    { grade: 'G8', percentage: 58 },
    { grade: 'G9', percentage: 30 },
  ];

  const metricCards = [
    { label: 'Total Students', val: stats.totalStudents, icon: 'fa-user-graduate', color: 'text-brand-500', bg: 'bg-brand-50', layout: 'sm:col-start-1 sm:row-start-1' },
    { label: 'Total Parents', val: stats.totalParents, icon: 'fa-people-roof', color: 'text-sky-600', bg: 'bg-sky-50', layout: 'sm:col-start-1 sm:row-start-2' },
    { label: 'Total Teachers', val: stats.totalTeachers, icon: 'fa-chalkboard-teacher', color: 'text-emerald-500', bg: 'bg-emerald-50', layout: 'sm:col-start-2 sm:row-start-1' },
    { label: 'Demo Earning', val: `$${stats.demoEarning.toLocaleString()}`, icon: 'fa-sack-dollar', color: 'text-amber-600', bg: 'bg-amber-50', layout: 'sm:col-start-2 sm:row-start-2' },
  ];

  return (
    <div className="space-y-12 animate-in fade-in duration-700">
      <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tighter">Institutional Pulse</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-start">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 items-start content-start lg:col-span-4">
          {metricCards.map((card, i) => (
            <div 
              key={i} 
              className="group w-full min-w-0 p-3 sm:p-3.5 lg:p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/70 flex items-center justify-between gap-2 shadow-premium hover:-translate-y-0.5 transition-all"
            >
              <div>
                <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1 group-hover:text-brand-500 transition-colors">
                  {card.label}
                </p>
                <p className="text-lg sm:text-xl font-black tracking-tight leading-none break-words">{card.val}</p>
              </div>
              
              {/* Icon container with hover animation */}
              <div className={`w-9 h-9 ${card.bg} ${card.color} rounded-xl flex items-center justify-center text-sm shadow-inner group-hover:scale-105 transition-all`}>
                <i className={`fas ${card.icon}`}></i>
              </div>
            </div>
          ))}
        </div>

        <div className="w-full p-4 sm:p-5 lg:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-premium lg:col-span-4">
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3">
            Students Male/Female
          </p>
          <div className="h-40 sm:h-44 lg:h-48 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={maleRingData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={44}
                  outerRadius={56}
                  startAngle={90}
                  endAngle={-270}
                  stroke="none"
                  cornerRadius={8}
                >
                  <Cell fill={maleColor} />
                  <Cell fill={maleTrack} />
                </Pie>
                <Pie
                  data={femaleRingData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={28}
                  outerRadius={38}
                  startAngle={90}
                  endAngle={-270}
                  stroke="none"
                  cornerRadius={8}
                >
                  <Cell fill={femaleColor} />
                  <Cell fill={femaleTrack} />
                </Pie>
                <Tooltip formatter={(value: number, name: string) => [value, name]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <p className="text-xs text-slate-500 dark:text-slate-400">Total</p>
              <p className="text-lg sm:text-xl font-black tracking-tight">{totalStudents}</p>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-center gap-6 text-sm font-semibold text-slate-600 dark:text-slate-300">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: maleColor }}></span>
              <span>Male</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: femaleColor }}></span>
              <span>Female</span>
            </div>
          </div>
        </div>

        <div className="w-full p-4 sm:p-5 lg:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-premium lg:col-span-4">
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3">
            Teachers Male/Female
          </p>
          <div className="h-40 sm:h-44 lg:h-48 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={maleTeacherRingData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={44}
                  outerRadius={56}
                  startAngle={90}
                  endAngle={-270}
                  stroke="none"
                  cornerRadius={8}
                >
                  <Cell fill={maleColor} />
                  <Cell fill={maleTrack} />
                </Pie>
                <Pie
                  data={femaleTeacherRingData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={28}
                  outerRadius={38}
                  startAngle={90}
                  endAngle={-270}
                  stroke="none"
                  cornerRadius={8}
                >
                  <Cell fill={femaleColor} />
                  <Cell fill={femaleTrack} />
                </Pie>
                <Tooltip formatter={(value: number, name: string) => [value, name]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <p className="text-xs text-slate-500 dark:text-slate-400">Total</p>
              <p className="text-lg sm:text-xl font-black tracking-tight">{totalTeachers}</p>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-center gap-6 text-sm font-semibold text-slate-600 dark:text-slate-300">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: maleColor }}></span>
              <span>Male</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: femaleColor }}></span>
              <span>Female</span>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-5 lg:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-premium lg:col-span-12">
          <div className="flex items-center justify-between gap-3 mb-4">
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
              Average Grade
            </p>
            <span className="text-[10px] font-black uppercase tracking-widest text-brand-500">Students %</span>
          </div>

          <div className="h-64 sm:h-72 lg:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={examResultDemoData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="grade" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 700 }} />
                <YAxis
                  domain={[0, 100]}
                  tickFormatter={(value) => `${value}%`}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#64748b', fontSize: 12, fontWeight: 700 }}
                />
                <Tooltip formatter={(value: number) => [`${value}%`, 'Students']} cursor={{ fill: 'rgba(99, 102, 241, 0.08)' }} />
                <Bar dataKey="percentage" fill="#5b7be3" radius={[6, 6, 0, 0]} maxBarSize={44} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
