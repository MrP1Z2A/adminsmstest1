
import React from 'react';
import { View, UserRole } from '../types';

interface SidebarProps {
  currentView: View;
  onViewChange: (view: View) => void;
  onLogout: () => void;
  userRole: UserRole;
  hasNewNotices?: boolean;
  userEmail?: string;
  userName?: string;
  isOpen?: boolean;
  onToggle?: () => void;
  isCollapsed?: boolean;
  onCollapse?: () => void;
  onSwitch?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  currentView, 
  onViewChange, 
  onLogout, 
  userRole, 
  hasNewNotices, 
  userName, 
  isOpen, 
  onToggle,
  isCollapsed,
  onCollapse,
  onSwitch
}) => {
  const handleNavClick = (view: View) => {
    onViewChange(view);
    if (onToggle) onToggle();
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'fa-house', roles: [UserRole.STUDENT] },
    { id: 'notice-board', label: 'Notice Board', icon: 'fa-bullhorn', roles: [UserRole.STUDENT, UserRole.PARENT] },
    { id: 'parent-portal', label: 'Parent Portal', icon: 'fa-clipboard-user', roles: [UserRole.PARENT] },
    { id: 'profile', label: 'User Profile', icon: 'fa-id-card', roles: [UserRole.STUDENT, UserRole.PARENT] },
    { id: 'instruction', label: 'Instruction Page', icon: 'fa-book-open', roles: [UserRole.STUDENT, UserRole.PARENT] },
    { id: 'courses', label: 'Courses', icon: 'fa-graduation-cap', roles: [UserRole.STUDENT] },
    { id: 'activity', label: 'Activity', icon: 'fa-chart-line', roles: [UserRole.STUDENT] },
    { id: 'homework', label: 'Homework', icon: 'fa-tasks', roles: [UserRole.STUDENT] },
    { id: 'timetable', label: 'Time table / Calendar', icon: 'fa-calendar', roles: [UserRole.STUDENT] },
    { id: 'studies', label: 'Grades / Achievement', icon: 'fa-trophy', roles: [UserRole.STUDENT] },
    { id: 'contact', label: 'Messages / Contact', icon: 'fa-comments', roles: [UserRole.STUDENT, UserRole.PARENT] },
  ];

  const filteredNavItems = navItems.filter(item => item.roles.includes(userRole));

  return (
    <>
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[55] md:hidden transition-opacity"
          onClick={onToggle}
        />
      )}
      <aside className={`fixed left-0 top-0 h-screen bg-[#0f2624] border-r border-[#1f4e4a] text-white flex flex-col z-[60] overflow-y-auto custom-scrollbar transition-all duration-300 ${isOpen ? 'translate-x-0 w-72' : '-translate-x-full md:translate-x-0'} ${isCollapsed ? 'md:w-20' : 'md:w-72'}`}>
        <div className={`p-8 flex items-center shrink-0 ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-[#4ea59d] rounded-2xl flex items-center justify-center shadow-xl shadow-[#4ea59d]/20 shrink-0">
              <i className="fa-solid fa-graduation-cap text-xl"></i>
            </div>
            {!isCollapsed && <h1 className="text-xl font-black tracking-tighter text-white uppercase ">IEM</h1>}
          </div>
          <button onClick={onToggle} className="md:hidden text-slate-400 hover:text-white">
            <i className="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>

        <div className="hidden md:flex justify-end px-4 mb-2">
          <button 
            onClick={onCollapse}
            className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-[#4ea59d] transition-all hover:scale-110"
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            <i className="fa-solid fa-bars text-[10px]"></i>
          </button>
        </div>

        <nav className="flex-1 px-4 py-2 space-y-1">
          {filteredNavItems.map((item) => {
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id as View)}
                className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-4 px-5'} py-3 rounded-2xl transition-all duration-300 group ${
                  isActive 
                    ? 'bg-[#4ea59d] text-white shadow-[0_8px_16px_-4px_rgba(78,165,157,0.5)] scale-[1.02]' 
                    : 'text-slate-300 hover:bg-[#1f4e4a] hover:text-[#4ea59d]'
                }`}
              >
                <div className={`flex items-center justify-center w-7 h-7 shrink-0 rounded-lg transition-colors ${isActive ? 'bg-white/20' : 'bg-transparent'}`}>
                  <i className={`fa-solid ${item.icon} text-base`}></i>
                </div>
                {!isCollapsed && (
                  <span className={`font-black text-[11px] uppercase tracking-wider text-left transition-all ${
                    isActive ? 'text-white' : 'text-slate-300 group-hover:text-[#4ea59d]'
                  } flex-1`}>
                    {item.label}
                  </span>
                )}
                {item.id === 'notice-board' && hasNewNotices && (
                  <span className="relative flex h-3 w-3 shrink-0" title="New notices available">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-rose-500"></span>
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-6 mt-auto space-y-4">
          <div className={`bg-[#4ea59d]/5 border border-[#4ea59d]/20 rounded-[24px] p-4 flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
            <div className="w-8 h-8 rounded-full bg-[#4ea59d] flex items-center justify-center text-white shrink-0 shadow-lg shadow-[#4ea59d]/20">
              <i className="fa-solid fa-user text-xs"></i>
            </div>
            {!isCollapsed && (
              <div className="flex-1 overflow-hidden">
                <p className="text-[9px] font-black text-[#4ea59d] uppercase tracking-[0.2em] truncate">{userName || 'Student'}</p>
                <p className="text-[8px] text-slate-500 truncate">{userRole} Account</p>
              </div>
            )}
          </div>
          
          <button 
            onClick={onSwitch}
            className={`w-full flex items-center justify-center ${isCollapsed ? 'px-0' : 'gap-3 px-5'} py-3 rounded-2xl bg-[#4ea59d]/10 border border-[#4ea59d]/20 text-[#4ea59d] hover:bg-[#4ea59d] hover:text-white transition-all duration-300 group`}
          >
            <i className="fa-solid fa-rotate text-xs group-hover:rotate-180 transition-transform duration-500"></i>
            {!isCollapsed && <span className="font-black text-[10px] uppercase tracking-[0.2em]">Switch Environment</span>}
          </button>

          <button 
            onClick={onLogout}
            className={`w-full flex items-center justify-center ${isCollapsed ? 'px-0' : 'gap-3 px-5'} py-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white transition-all duration-300 group`}
          >
            <i className="fa-solid fa-right-from-bracket text-xs group-hover:-translate-x-1 transition-transform"></i>
            {!isCollapsed && <span className="font-black text-[10px] uppercase tracking-[0.2em]">Logout</span>}
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
