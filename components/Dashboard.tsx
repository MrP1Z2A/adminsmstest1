import React from 'react';

/**
 * Dashboard Component
 * 
 * This component renders the "Institutional Pulse" overview.
 * It displays key metrics like total students, attendance rate, and risk levels.
 */

interface DashboardProps {
  stats: {
    total: number;
    avgAttendance: string;
    atRisk: number;
    activeSubjects: number;
  };
}

const Dashboard: React.FC<DashboardProps> = ({ stats }) => {
  // Configuration for the metric cards
  const metricCards = [
    { label: 'Total Nodes', val: stats.total, icon: 'fa-users', color: 'text-brand-500', bg: 'bg-brand-50' },
  ];

  return (
    <div className="space-y-12 animate-in fade-in duration-700">
      <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tighter">Institutional Pulse</h2>
      
      {/* Grid layout for metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        {metricCards.map((card, i) => (
          <div 
            key={i} 
            className="group p-6 sm:p-8 lg:p-10 rounded-[36px] sm:rounded-[48px] lg:rounded-[56px] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex justify-between items-center gap-4 shadow-premium hover:-translate-y-2 transition-all"
          >
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3 group-hover:text-brand-500 transition-colors">
                {card.label}
              </p>
              <p className="text-3xl sm:text-4xl font-black tracking-tighter break-words">{card.val}</p>
            </div>
            
            {/* Icon container with hover animation */}
            <div className={`w-16 h-16 ${card.bg} ${card.color} rounded-3xl flex items-center justify-center text-3xl shadow-inner group-hover:scale-110 transition-all`}>
              <i className={`fas ${card.icon}`}></i>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
