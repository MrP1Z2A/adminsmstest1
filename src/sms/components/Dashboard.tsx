import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { supabase } from '../supabaseClient';

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
    totalEarningMMK: number;
    totalTeachers: number;
    totalStudentServices: number;
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

const Dashboard: React.FC<DashboardProps> = React.memo(({ stats }) => {
  const [classAverages, setClassAverages] = useState<{ grade: string, percentage: number }[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const convertGradeToNumber = (gradeStr: string): number => {
    if (!gradeStr) return NaN;
    const raw = String(gradeStr).trim().toUpperCase();
    const mapping: Record<string, number> = {
      'A+': 100, 'A': 95, 'A-': 90,
      'B+': 85,  'B': 80, 'B-': 75,
      'C+': 70,  'C': 65, 'C-': 60,
      'D+': 55,  'D': 50, 'D-': 45,
      'E': 30,   'F': 0
    };
    if (mapping[raw] !== undefined) return mapping[raw];
    const numericRaw = raw.replace(/[^0-9.]/g, '');
    return parseFloat(numericRaw);
  };

  useEffect(() => {
    const fetchGrades = async () => {
      // Fetch classes first to do manual mapping if join fails
      const classesRes = await supabase.from('classes').select('id, name');
      const classMap: Record<string, string> = {};
      if (classesRes?.data) {
        classesRes.data.forEach((c: any) => { classMap[c.id] = c.name; });
      }

      const { data, error } = await supabase
        .from('exam_grades')
        .select(`
          grade,
          class_id,
          name
        `);
      
      if (error) {
        console.error('Error fetching grades:', error);
        setFetchError(error.message);
        return;
      }

      if (data) {
        const classData: Record<string, { total: number, count: number, name: string }> = {};
        
        data.forEach((row: any) => {
          // If the exact class name is not in the row, use the manual classMap fallback
          const className = row.name || classMap[row.class_id] || row.class_id || 'Unknown Class';
          
          const gradeVal = convertGradeToNumber(row.grade);
          
          if (!isNaN(gradeVal)) {
            if (!classData[className]) {
              classData[className] = { total: 0, count: 0, name: className };
            }
            classData[className].total += gradeVal;
            classData[className].count += 1;
          }
        });

        const averages = Object.values(classData).map(c => ({
          grade: c.name,
          percentage: Math.round(c.total / c.count)
        })).sort((a, b) => a.grade.localeCompare(b.grade));

        setClassAverages(averages);
      }
    };

    fetchGrades();
  }, []);

  const formatCompactMMK = (value: number) => {
    const abs = Math.abs(value || 0);
    if (abs >= 1_000_000_000) {
      const compact = (value / 1_000_000_000).toFixed(2).replace(/\.00$/, '');
      return `${compact}B MMK`;
    }
    if (abs >= 1_000_000) {
      const compact = (value / 1_000_000).toFixed(1).replace(/\.0$/, '');
      return `${compact}m MMK`;
    }
    if (abs >= 1_000) {
      const compact = (value / 1_000).toFixed(1).replace(/\.0$/, '');
      return `${compact}k MMK`;
    }
    return `${Math.round(value || 0).toLocaleString()} MMK`;
  };

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



  const metricCards = [
    { label: 'Total Students', val: stats.totalStudents, icon: 'fa-user-graduate', color: 'text-brand-500', bg: 'bg-brand-50', layout: 'sm:col-start-1 sm:row-start-1' },
    { label: 'Total Parents', val: stats.totalParents, icon: 'fa-people-roof', color: 'text-sky-600', bg: 'bg-sky-50', layout: 'sm:col-start-1 sm:row-start-2' },
    { label: 'Total Teachers', val: stats.totalTeachers, icon: 'fa-chalkboard-teacher', color: 'text-emerald-500', bg: 'bg-emerald-50', layout: 'sm:col-start-2 sm:row-start-1' },
    { label: 'Student Service', val: stats.totalStudentServices, icon: 'fa-user-gear', color: 'text-cyan-600', bg: 'bg-cyan-50', layout: 'sm:col-start-1 sm:row-start-3' },
    { label: 'Total Earning', val: formatCompactMMK(stats.totalEarningMMK), tooltip: `${(stats.totalEarningMMK || 0).toLocaleString()} MMK`, icon: 'fa-sack-dollar', color: 'text-amber-600', bg: 'bg-amber-50', layout: 'sm:col-start-2 sm:row-start-2' },
  ];

  return (
    <div className="space-y-12 animate-in fade-in duration-700">
      <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tighter">Institutional Pulse</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-start">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 items-start content-start lg:col-span-4">
          {metricCards.map((card, i) => (
            <div 
              key={i} 
              className="relative group w-full min-w-0 p-3 sm:p-3.5 lg:p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/70 flex items-center justify-between gap-2 shadow-premium hover:-translate-y-0.5 transition-all"
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

              {/* Custom Tooltip */}
              {card.tooltip && (
                <div className="absolute -top-12 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none bg-slate-800 dark:bg-slate-700 text-white text-xs font-bold py-2 px-3 rounded-lg shadow-xl whitespace-nowrap z-50 transform scale-95 group-hover:scale-100">
                  {card.tooltip}
                  <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-800 dark:bg-slate-700 rotate-45 rounded-sm"></div>
                </div>
              )}
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
                  isAnimationActive={false}
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
                  isAnimationActive={false}
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
                <Tooltip formatter={(value: any, name: any) => [value, name]} />
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
                  isAnimationActive={false}
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
                  isAnimationActive={false}
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
                <Tooltip formatter={(value: any, name: any) => [value, name]} />
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

        <div className="p-4 sm:p-5 lg:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-premium lg:col-span-12 animate-in fade-in duration-700">
          <div className="flex items-center justify-between gap-3 mb-4">
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
              Average Grade
            </p>
            <span className="text-[10px] font-black uppercase tracking-widest text-brand-500">Students %</span>
          </div>

          <div className="h-64 sm:h-72 lg:h-80">
            {fetchError ? (
               <div className="w-full h-full flex flex-col items-center justify-center text-red-500 text-sm font-semibold p-4 text-center">
                 <p>Error loading grades:</p>
                 <p className="text-xs opacity-80 mt-1">{fetchError}</p>
               </div>
            ) : classAverages.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={classAverages} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="grade" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 700 }} />
                  <YAxis
                    domain={[0, 100]}
                    tickFormatter={(value) => `${value}%`}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: '#64748b', fontSize: 12, fontWeight: 700 }}
                  />
                  <Tooltip formatter={(value: any) => [`${value}%`, 'Average']} cursor={{ fill: 'rgba(99, 102, 241, 0.08)' }} />
                  <Bar dataKey="percentage" fill="#5b7be3" radius={[6, 6, 0, 0]} maxBarSize={44} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
               <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 text-sm font-semibold">
                 <p>No numeric grade data available</p>
                 <p className="font-normal text-xs mt-1">Please ensure grades contain numbers (e.g. "95", "100")</p>
               </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
});

export default Dashboard;
