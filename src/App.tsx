import React, { useState, useEffect } from 'react';
import SMSApp from './sms/App';
import LMSApp from './lms/App';
import ParentApp from './parent/App';
import { supabase } from './sms/supabaseClient';

const APP_MODE_KEY = 'iem_app_mode';

export default function Portal() {
  const [appMode, setAppMode] = useState<'portal' | 'sms' | 'lms' | 'parent' | 'student_service'>(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem(APP_MODE_KEY);
      if (saved === 'sms' || saved === 'lms' || saved === 'parent' || saved === 'student_service') return saved as any;
    }
    return 'portal';
  });

  const [schoolId, setSchoolIdState] = useState<string | undefined>(() => {
    if (typeof window !== 'undefined') {
      const raw = window.localStorage.getItem('iem_user');
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          return parsed.schoolId || parsed.school_id;
        } catch {
          return undefined;
        }
      }
    }
    return undefined;
  });

  const [schoolName, setSchoolName] = useState<string | undefined>(() => {
    if (typeof window !== 'undefined') {
      const raw = window.localStorage.getItem('iem_user');
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          return parsed.schoolName;
        } catch {
          return undefined;
        }
      }
    }
    return undefined;
  });

  const updateSchoolId = (newId: string | undefined, newName?: string) => {
    setSchoolIdState(newId);
    setSchoolName(newName); // This clears the old name if a new one is not provided, triggering re-fetch
    
    if (typeof window !== 'undefined') {
      if (newId) {
        const raw = window.localStorage.getItem('iem_user');
        let user = {};
        try { if (raw) user = JSON.parse(raw); } catch {}
        window.localStorage.setItem('iem_user', JSON.stringify({ 
          ...user, 
          schoolId: newId, 
          school_id: newId,
          schoolName: newName 
        }));
      } else {
        window.localStorage.removeItem('iem_user');
      }
    }
  };

  useEffect(() => {
    const fetchSchoolName = async (id: string) => {
      try {
        const { data, error } = await supabase
          .from('schools')
          .select('name')
          .eq('id', id)
          .maybeSingle();
        
        if (!error && data?.name) {
          setSchoolName(data.name);
          // Update localStorage with the fetched name
          const raw = window.localStorage.getItem('iem_user');
          if (raw) {
            try {
              const user = JSON.parse(raw);
              window.localStorage.setItem('iem_user', JSON.stringify({ ...user, schoolName: data.name }));
            } catch {}
          }
        }
      } catch (err) {
        console.error('Failed to fetch school name:', err);
      }
    };

    if (schoolId && !schoolName) {
      fetchSchoolName(schoolId);
    }
  }, [schoolId]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(APP_MODE_KEY, appMode);
    }
    
    // Inject respective body classes for SMS (dark mode capability) or LMS (dark green capability)
    if (appMode === 'lms') {
      document.body.classList.add('lms-mode');
    } else {
      document.body.classList.remove('lms-mode');
    }
  }, [appMode]);

  const handleSwitch = () => {
    setAppMode('portal');
  };

  if (appMode === 'sms') return <SMSApp onSwitch={handleSwitch} schoolId={schoolId} schoolName={schoolName} onSchoolIdChange={updateSchoolId} />;
  if (appMode === 'lms') return <LMSApp onSwitch={handleSwitch} schoolId={schoolId} schoolName={schoolName} onSchoolIdChange={updateSchoolId} />;
  if (appMode === 'parent') return <ParentApp onSwitch={handleSwitch} schoolId={schoolId} schoolName={schoolName} />;
  if (appMode === 'student_service') return <SMSApp onSwitch={handleSwitch} schoolId={schoolId} schoolName={schoolName} onSchoolIdChange={updateSchoolId} isStudentService />;

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white relative overflow-hidden p-6">
      {/* Background Decor */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-blue-500/10 rounded-full blur-[120px] animate-pulse delay-700"></div>

      <div className="z-10 text-center max-w-6xl w-full animate-fadeIn">
        <div className="mb-12">
          <h1 className="text-6xl md:text-7xl font-black mb-6 bg-gradient-to-r from-emerald-400 via-sky-400 to-indigo-400 bg-clip-text text-transparent tracking-tighter uppercase">
            IEM Unified Platform
          </h1>
          <p className="text-slate-400 text-lg md:text-xl font-medium tracking-wide max-w-2xl mx-auto">
            Select your authoritative gateway to access administrative, academic, or parental resources.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch h-full">

          {/* School SMS */}
          <div
            onClick={() => setAppMode('sms')}
            className="group cursor-pointer bg-white/5 border border-white/10 backdrop-blur-2xl rounded-[2.5rem] p-8 hover:-translate-y-3 hover:bg-white/10 hover:border-sky-400/50 hover:shadow-[0_20px_50px_-20px_rgba(56,189,248,0.4)] transition-all duration-500 flex flex-col items-center text-center relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-sky-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="w-20 h-20 rounded-3xl bg-sky-500/20 shadow-inner flex items-center justify-center mb-6 text-4xl group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 border border-sky-500/20">
              🏫
            </div>
            <h2 className="text-2xl font-black mb-3 tracking-tight uppercase">School SMS</h2>
            <p className="text-slate-400 text-xs font-medium leading-relaxed">Authority interface for staff, administrators, and organizational logistics.</p>
            <div className="mt-6 text-sky-400 font-bold text-[10px] uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Initialize Session →</div>
          </div>

          {/* Student Service */}
          <div
            onClick={() => setAppMode('student_service')}
            className="group cursor-pointer bg-white/5 border border-white/10 backdrop-blur-2xl rounded-[2.5rem] p-8 hover:-translate-y-3 hover:bg-white/10 hover:border-cyan-400/50 hover:shadow-[0_20px_50px_-20px_rgba(34,211,238,0.4)] transition-all duration-500 flex flex-col items-center text-center relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="w-20 h-20 rounded-3xl bg-cyan-500/20 shadow-inner flex items-center justify-center mb-6 text-4xl group-hover:scale-110 group-hover:-rotate-6 transition-all duration-500 border border-cyan-500/20">
              🤝
            </div>
            <h2 className="text-2xl font-black mb-3 tracking-tight uppercase">Student Service</h2>
            <p className="text-slate-400 text-xs font-medium leading-relaxed">Support interface for student enrollment, queries, and service coordination.</p>
            <div className="mt-6 text-cyan-400 font-bold text-[10px] uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Initialize Session →</div>
          </div>

          {/* Student LMS */}
          <div
            onClick={() => setAppMode('lms')}
            className="group cursor-pointer bg-white/5 border border-white/10 backdrop-blur-2xl rounded-[2.5rem] p-8 hover:-translate-y-3 hover:bg-white/10 hover:border-emerald-400/50 hover:shadow-[0_20px_50px_-20px_rgba(52,211,153,0.4)] transition-all duration-500 flex flex-col items-center text-center relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="w-20 h-20 rounded-3xl bg-emerald-500/20 shadow-inner flex items-center justify-center mb-6 text-4xl group-hover:scale-110 group-hover:-rotate-6 transition-all duration-500 border border-emerald-500/20">
              🎓
            </div>
            <h2 className="text-2xl font-black mb-3 tracking-tight uppercase">Student LMS</h2>
            <p className="text-slate-400 text-xs font-medium leading-relaxed">Interactive terminal for academic mastery and coursework.</p>
            <div className="mt-6 text-emerald-400 font-bold text-[10px] uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Initialize Session →</div>
          </div>

          {/* Parent Portal */}
          <div
            onClick={() => setAppMode('parent')}
            className="group cursor-pointer bg-white/5 border border-white/10 backdrop-blur-2xl rounded-[2.5rem] p-8 hover:-translate-y-3 hover:bg-white/10 hover:border-indigo-400/50 hover:shadow-[0_20px_50px_-20px_rgba(129,140,248,0.4)] transition-all duration-500 flex flex-col items-center text-center relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="w-20 h-20 rounded-3xl bg-indigo-500/20 shadow-inner flex items-center justify-center mb-6 text-4xl group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 border border-indigo-500/20">
              👪
            </div>
            <h2 className="text-2xl font-black mb-3 tracking-tight uppercase">Parent SMS</h2>
            <p className="text-slate-400 text-xs font-medium leading-relaxed">Secure gateway for parental monitoring and fee management.</p>
            <div className="mt-6 text-indigo-400 font-bold text-[10px] uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Initialize Session →</div>
          </div>

        </div>
      </div>

      <div className="absolute bottom-8 text-[10px] text-slate-600 font-black uppercase tracking-[0.4em] z-10">
        Unified Ecosystem v2.0 • Decentralized Intelligence
      </div>
    </div>
  );
}
