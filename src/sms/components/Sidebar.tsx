import React, { useEffect, useRef, useState } from 'react';
import { PageId } from '../types';
import logoIem from '../src/LOGO_IEM.png';

interface SidebarProps {
  currentPage: PageId;
  setCurrentPage: (page: PageId) => void;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
  isCollapsed?: boolean;
  onCollapse?: () => void;
  onSwitch?: () => void;
  schoolName?: string;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  currentPage, 
  setCurrentPage, 
  isMobileMenuOpen, 
  setIsMobileMenuOpen,
  isCollapsed,
  onCollapse,
  onSwitch,
  schoolName
}) => {
  const [openDropdowns, setOpenDropdowns] = useState<Record<string, boolean>>({});
  const navRef = useRef<HTMLElement | null>(null);
  const sidebarScrollTopRef = useRef(0);

  useEffect(() => {
    const navElement = navRef.current;
    if (!navElement) return;

    navElement.scrollTop = sidebarScrollTopRef.current;
  }, [currentPage, openDropdowns, isMobileMenuOpen]);

  const SidebarMenuItem = ({ id, icon, label, activePage, hasDropdown, children }: any) => {
    const isOpen = openDropdowns[label];
    const isParentActive = children && React.Children.toArray(children).some((child: any) => (child as any).props.id === activePage);
    const isActive = id && activePage === id;
    
    return (
      <div className="w-full">
        <button
          onClick={() => { 
            if (hasDropdown) setOpenDropdowns(prev => ({ ...prev, [label]: !prev[label] }));
            else if (id) { setCurrentPage(id); setIsMobileMenuOpen(false); }
          }}
          className={`w-full flex items-center justify-between ${isCollapsed ? 'px-0' : 'px-8'} py-3.5 transition-all duration-300 group
            ${(isActive || (hasDropdown && isParentActive && !isOpen)) ? 'bg-brand-500/10 text-white border-r-4 border-brand-500' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
        >
          <div className={`flex items-center ${isCollapsed ? 'justify-center w-full' : 'gap-4'}`}>
            {icon && <i className={`fas ${icon} w-5 text-sm transition-colors ${isActive || isParentActive ? 'text-brand-400' : 'opacity-60 group-hover:opacity-100'}`}></i>}
            {!isCollapsed && <span className="text-[13px] font-bold tracking-tight">{label}</span>}
          </div>
          {!isCollapsed && hasDropdown && <i className={`fas fa-chevron-down text-[10px] transition-transform duration-300 ${isOpen ? 'rotate-180 text-brand-400' : 'opacity-40 group-hover:opacity-100'}`}></i>}
        </button>
        {hasDropdown && isOpen && !isCollapsed && <div className="bg-black/10 py-1 animate-in slide-in-from-top-2 duration-300">{children}</div>}
      </div>
    );
  };

  const SidebarSubItem = ({ id, label, activePage }: any) => (
    <button
      onClick={() => { setCurrentPage(id); setIsMobileMenuOpen(false); }}
      className={`w-full flex items-center gap-4 pl-16 pr-8 py-2.5 transition-all duration-300 group
        ${activePage === id ? 'text-brand-400 font-bold' : 'text-slate-500 hover:text-slate-300 font-semibold'}`}
    >
      <div className={`w-1.5 h-1.5 rounded-full transition-all ${activePage === id ? 'bg-brand-500 scale-125' : 'bg-slate-700'}`}></div>
      <span className="text-[12px]">{label}</span>
    </button>
  );

  return (
    <aside className={`fixed lg:sticky lg:top-0 lg:h-screen bg-[#0f172a] text-white z-50 lg:z-0 flex flex-col transition-all duration-300 ${isMobileMenuOpen ? 'translate-x-0 shadow-2xl w-64' : '-translate-x-full lg:translate-x-0'} ${isCollapsed ? 'lg:w-20' : 'lg:w-64'} ${!isMobileMenuOpen ? 'lg:w-0' : ''}`}>
      <div className={`p-8 pb-10 flex items-center shrink-0 ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
        <div className="w-10 h-10 bg-brand-500 rounded-2xl flex items-center justify-center shadow-lg shadow-brand-500/30 overflow-hidden shrink-0">
          <img src={logoIem} alt="IEM" className="w-full h-full object-cover" />
        </div>
        {!isCollapsed && <span className="text-xl font-black tracking-tighter truncate max-w-[150px]">{schoolName || 'IEM'}</span>}
      </div>

      <div className="hidden lg:flex justify-end px-4 mb-2">
        <button 
          onClick={onCollapse}
          className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-brand-500 transition-all hover:scale-110"
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          <i className="fas fa-bars text-[10px]"></i>
        </button>
      </div>
      <nav
        ref={navRef}
        onScroll={(event) => {
          sidebarScrollTopRef.current = event.currentTarget.scrollTop;
        }}
        className="flex-1 overflow-y-auto no-scrollbar pb-10"
      >
        <SidebarMenuItem id="dashboard" icon="fa-house" label="Dashboard" activePage={currentPage} />
        <SidebarMenuItem id="live-calendar" icon="fa-calendar-days" label="Live Calendar" activePage={currentPage} />
        <SidebarMenuItem icon="fa-user-group" label="Students / Parents" activePage={currentPage} hasDropdown>
            <SidebarSubItem id="students" label="Student Directory" activePage={currentPage} />
          <SidebarSubItem id="parents" label="Parent Directory" activePage={currentPage} />
          <SidebarSubItem id="student-achievements" label="Student Achievement" activePage={currentPage} />
          <SidebarSubItem id="student-register" label="Registration Hub" activePage={currentPage} />
        </SidebarMenuItem>
        <SidebarMenuItem icon="fa-chalkboard-teacher" label="Teachers" activePage={currentPage} hasDropdown>
            <SidebarSubItem id="teachers" label="Teacher Directory" activePage={currentPage} />
            <SidebarSubItem id="teacher-register" label="Registration Hub" activePage={currentPage} />
        </SidebarMenuItem>
        <SidebarMenuItem icon="fa-user-tie" label="Student Service" activePage={currentPage} hasDropdown>
          <SidebarSubItem id="student-service" label="SS Directory" activePage={currentPage} />
          <SidebarSubItem id="student-service-batch" label="Batch Registering" activePage={currentPage} />
        </SidebarMenuItem>
        <SidebarMenuItem id="student-attendance" icon="fa-calendar-check" label="Class Management" activePage={currentPage} />
        <SidebarMenuItem id="homework" icon="fa-book-open" label="Homework" activePage={currentPage} />
        <SidebarMenuItem id="report-card" icon="fa-file-lines" label="Report Card" activePage={currentPage} />
        <SidebarMenuItem icon="fa-bullhorn" label="Announcement" activePage={currentPage} hasDropdown>
          <SidebarSubItem id="notice" label="Notice Board" activePage={currentPage} />
          <SidebarSubItem id="events" label="Events" activePage={currentPage} />
          <SidebarSubItem id="student-activities" label="Student Activities" activePage={currentPage} />
          <SidebarSubItem id="announcements-parent" label="Announcements For Parent" activePage={currentPage} />
          <SidebarSubItem id="live-intel" label="Live Intel" activePage={currentPage} />
        </SidebarMenuItem>
        <SidebarMenuItem icon="fa-money-bill-wave" label="Payment" activePage={currentPage} hasDropdown>
            <SidebarSubItem id="payment" label="Payment" activePage={currentPage} />
          <SidebarSubItem id="payment-assign" label="Assign Payment" activePage={currentPage} />
            <SidebarSubItem id="payment-history" label="Payment History" activePage={currentPage} />
            <SidebarSubItem id="student-finance-status" label="Student Finance Status" activePage={currentPage} />
        </SidebarMenuItem>
        <SidebarMenuItem id="exam" icon="fa-clipboard-check" label="Exam Management" activePage={currentPage} />
        <SidebarMenuItem id="about-school" icon="fa-circle-info" label="About School" activePage={currentPage} />
        <SidebarMenuItem id="security" icon="fa-user-shield" label="Security Permission" activePage={currentPage} />

        
        <div className="mt-auto px-8 mb-8 space-y-4">
          <button 
            onClick={onSwitch}
            className={`w-full flex items-center justify-center ${isCollapsed ? 'px-0' : 'gap-3 px-5'} py-3 rounded-2xl bg-brand-500/10 border border-brand-500/20 text-brand-500 hover:bg-brand-500 hover:text-white transition-all duration-300 group`}
          >
            <i className="fas fa-rotate text-xs group-hover:rotate-180 transition-transform duration-500"></i>
            {!isCollapsed && <span className="font-black text-[10px] uppercase tracking-[0.2em]">Switch Environment</span>}
          </button>
        </div>
      </nav>
    </aside>
  );
};

export default Sidebar;
