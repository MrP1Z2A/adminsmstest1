
import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, UserCircle, Bell, LogOut, 
  Menu, X, School, ChevronRight, CreditCard, ChevronLeft,
  LayoutGrid
} from 'lucide-react';
import Dashboard from './components/Dashboard';
import StudentHub from './components/StudentHub';
import InstitutionHub from './components/InstitutionHub';
import logoIem from '../sms/src/LOGO_IEM.png';
import Communications from './components/Communications';
import Finance from './components/Finance';
import LoginPage from './components/LoginPage';
import NoticeDetail from './components/NoticeDetail';

type ParentView = 'dashboard' | 'student' | 'institution' | 'news' | 'finance' | 'notice-detail';

interface ParentAppProps {
  onSwitch?: () => void;
  schoolId?: string;
  schoolName?: string;
}

// ─────────────────────────────────────────────
// Sidebar
// ─────────────────────────────────────────────
const Sidebar = ({
  isOpen, onClose, onLogout, currentView, setView,
}: {
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
  currentView: ParentView;
  setView: (v: ParentView) => void;
}) => {
  const navItems = [
    { id: 'dashboard' as ParentView, name: 'Dashboard',      icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: 'student'   as ParentView, name: 'Student Hub',    icon: <UserCircle className="w-5 h-5" /> },
    { id: 'institution' as ParentView, name: 'Institution',  icon: <School className="w-5 h-5" /> },
    { id: 'news'      as ParentView, name: 'Notices & News', icon: <Bell className="w-5 h-5" /> },
    { id: 'finance'   as ParentView, name: 'Payments',       icon: <CreditCard className="w-5 h-5" /> },
  ];

  return (
    <>
      {/* Sidebar panel */}
      <aside
        className={`
          fixed md:relative inset-y-0 left-0 z-[100] md:z-0 flex flex-col bg-slate-900 text-white border-r border-slate-800
          transition-all duration-300 ease-in-out overflow-hidden h-screen
          ${isOpen ? 'w-72 translate-x-0' : 'w-0 -translate-x-full md:translate-x-0'}
        `}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800/60 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-white p-1 rounded-xl shadow-lg shadow-emerald-600/20 overflow-hidden">
              <img src={logoIem} alt="IEM Logo" className="w-full h-full object-contain" />
            </div>
            <span className="text-lg font-black bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
              EduParent
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-4 py-5 space-y-1.5 overflow-y-auto">
          {navItems.map(item => {
            const active = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { setView(item.id); if (window.innerWidth < 768) onClose(); }}
                className={`
                  w-full group flex items-center justify-between px-4 py-3.5 rounded-xl
                  transition-all duration-200 text-sm font-bold whitespace-nowrap
                  ${active
                    ? 'bg-emerald-600 text-white shadow-xl shadow-emerald-600/20'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'}
                `}
              >
                <div className="flex items-center space-x-3">
                  <span className="transition-transform duration-200 group-hover:scale-110">{item.icon}</span>
                  <span>{item.name}</span>
                </div>
                {active && <ChevronRight className="w-4 h-4 opacity-50" />}
              </button>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="px-4 pb-5 border-t border-slate-800/60 shrink-0 pt-4">
          <button
            onClick={onLogout}
            className="w-full flex items-center space-x-3 px-4 py-3.5 text-slate-500 hover:text-rose-400 rounded-xl hover:bg-rose-400/10 transition-all font-bold text-sm"
          >
            <LogOut className="w-5 h-5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Overlay (mobile) */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[90] bg-slate-900/50 backdrop-blur-sm md:hidden"
          onClick={onClose}
        />
      )}
    </>
  );
};

// ─────────────────────────────────────────────
// Header
// ─────────────────────────────────────────────
const Header = ({
  onMenuClick, sidebarOpen, parentData
}: {
  onMenuClick: () => void;
  sidebarOpen: boolean;
  parentData: any;
}) => (
  <header className="bg-white/90 backdrop-blur-xl border-b border-slate-100 h-18 min-h-[4.5rem] flex items-center justify-between px-4 md:px-6 sticky top-0 z-40 shadow-sm">
    <div className="flex items-center gap-3">
      {/* Toggle button visible on ALL screen sizes */}
      <button
        onClick={onMenuClick}
        title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
        className="p-2.5 bg-slate-50 hover:bg-emerald-50 rounded-xl text-slate-500 hover:text-emerald-600 border border-slate-100 hover:border-emerald-100 active:scale-95 transition-all shadow-sm"
      >
        {sidebarOpen ? <ChevronLeft className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Switch Environment Button */}
      <button
        onClick={() => { (window as any).switchEnvironment?.() }}
        title="Switch Environment"
        className="p-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-400 hover:text-white border border-slate-700 active:scale-95 transition-all shadow-md flex items-center gap-2"
      >
        <LayoutGrid className="w-5 h-5" />
        <span className="text-[10px] font-black uppercase tracking-widest hidden lg:block">Platform Hub</span>
      </button>

      <div>
        <h2 className="text-base font-black text-slate-800 tracking-tight">Academic Portal</h2>
        <p className="text-[10px] text-emerald-600 font-black uppercase tracking-[0.2em] hidden sm:block">Parental Monitoring Gateway</p>
      </div>
    </div>

    <div className="flex items-center gap-3 md:gap-5">
      <div className="relative cursor-pointer">
        <div className="p-2.5 hover:bg-slate-50 rounded-xl transition-colors">
          <Bell className="w-5 h-5 text-slate-400" />
        </div>
        <span className="absolute top-2 right-2 bg-rose-500 text-white text-[9px] font-bold w-3.5 h-3.5 flex items-center justify-center rounded-full border-2 border-white">3</span>
      </div>

      <div className="flex items-center gap-3 border-l border-slate-100 pl-4">
        <div className="hidden md:block text-right">
          <p className="text-sm font-black text-slate-800">{parentData?.email?.split('@')[0] || 'Parent'}</p>
          <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Active Session</p>
        </div>
        <div className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-700 font-black text-base border-2 border-white shadow-md">
          {parentData?.email?.[0]?.toUpperCase() || 'P'}
        </div>
      </div>
    </div>
  </header>
);

// ─────────────────────────────────────────────
// ParentApp
// ─────────────────────────────────────────────
const PARENT_SESSION_KEY = 'iem_parent_session';

const ParentApp: React.FC<ParentAppProps> = ({ onSwitch }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true); // open by default on desktop
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return localStorage.getItem(PARENT_SESSION_KEY) === 'true';
  });
  const [parentData, setParentData] = useState<any>(() => {
    const saved = localStorage.getItem('iem_parent_data');
    return saved ? JSON.parse(saved) : null;
  });
  const [currentView, setCurrentView] = useState<ParentView>('dashboard');
  const [selectedNotice, setSelectedNotice] = useState<any>(null);

  // Expose onSwitch to window so Header can call it
  useEffect(() => {
    (window as any).switchEnvironment = onSwitch;
    return () => { delete (window as any).switchEnvironment; };
  }, [onSwitch]);

  const handleLogin = (data: any) => {
    setParentData(data);
    setIsLoggedIn(true);
    localStorage.setItem(PARENT_SESSION_KEY, 'true');
    localStorage.setItem('iem_parent_data', JSON.stringify(data));
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setParentData(null);
    setSidebarOpen(false);
    localStorage.removeItem(PARENT_SESSION_KEY);
    localStorage.removeItem('iem_parent_data');
    if (onSwitch) onSwitch();
  };

  if (!isLoggedIn) return <LoginPage onLogin={handleLogin} />;

  const renderContent = () => {
    const ids = parentData?.studentIds;
    const names = parentData?.studentNames;
    const keyStr = ids?.join(',') || 'empty';

    switch (currentView) {
      case 'dashboard':     return <Dashboard key={keyStr} parentEmail={parentData?.email} studentNames={names} studentIds={ids} schoolId={parentData?.schoolId} onNoticeClick={(n: any) => { setSelectedNotice(n); setCurrentView('notice-detail'); }} />;
      case 'student':       return <StudentHub key={keyStr} studentNames={names} studentIds={ids} schoolId={parentData?.schoolId} />;
      case 'institution':   return <InstitutionHub schoolId={parentData?.schoolId} />;
      case 'news':          return <Communications schoolId={parentData?.schoolId} />;
      case 'finance':       return <Finance key={keyStr} studentIds={ids} schoolId={parentData?.schoolId} />;
      case 'notice-detail': return <NoticeDetail notice={selectedNotice} onBack={() => setCurrentView('dashboard')} />;
      default:              return <Dashboard key={keyStr} studentNames={names} studentIds={ids} schoolId={parentData?.schoolId} />;
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onLogout={handleLogout}
        currentView={currentView}
        setView={setCurrentView}
      />
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-auto">
        <Header
          onMenuClick={() => setSidebarOpen(prev => !prev)}
          sidebarOpen={sidebarOpen}
          parentData={parentData}
        />
        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto w-full">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
};

export default ParentApp;
