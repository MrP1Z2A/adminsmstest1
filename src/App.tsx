import React, { useState, useEffect } from 'react';
import SMSApp from './sms/App';
import LMSApp from './lms/App';
import { supabase } from './sms/supabaseClient';

const APP_MODE_KEY = 'iem_app_mode';

export default function Portal() {
  const [appMode, setAppMode] = useState<'portal' | 'sms' | 'lms'>(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem(APP_MODE_KEY);
      if (saved === 'sms' || saved === 'lms') return saved;
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
    if (newName) setSchoolName(newName);
    
    if (typeof window !== 'undefined') {
      if (newId) {
        const raw = window.localStorage.getItem('iem_user');
        let user = {};
        try { if (raw) user = JSON.parse(raw); } catch {}
        window.localStorage.setItem('iem_user', JSON.stringify({ 
          ...user, 
          schoolId: newId, 
          school_id: newId,
          schoolName: newName || (user as any).schoolName 
        }));
      } else {
        window.localStorage.removeItem('iem_user');
        setSchoolName(undefined);
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

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-brand-500/20 rounded-full blur-[100px]"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-blue-500/20 rounded-full blur-[100px]"></div>

      <div className="z-10 text-center max-w-4xl p-8 animate-fadeIn">
        <h1 className="text-5xl md:text-6xl font-black mb-4 bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent">
          IEM Platform
        </h1>
        <p className="text-slate-400 text-lg md:text-xl mb-12 max-w-2xl mx-auto">
          Select the application environment you wish to enter.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 justify-center items-center">

          <div
            onClick={() => setAppMode('sms')}
            className="group cursor-pointer bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-8 hover:-translate-y-2 hover:bg-white/10 hover:border-sky-400/50 hover:shadow-[0_10px_30px_-10px_rgba(56,189,248,0.3)] transition-all duration-300 flex flex-col items-center text-center"
          >
            <div className="w-20 h-20 rounded-full bg-sky-500/20 flex items-center justify-center mb-6 text-4xl group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
              🏫
            </div>
            <h2 className="text-2xl font-bold mb-2">School Management</h2>
            <p className="text-slate-400">Access administrative tools, attendance, and school operations.</p>
          </div>

          <div
            onClick={() => setAppMode('lms')}
            className="group cursor-pointer bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-8 hover:-translate-y-2 hover:bg-white/10 hover:border-brand-500/50 hover:shadow-[0_10px_30px_-10px_rgba(78,165,157,0.3)] transition-all duration-300 flex flex-col items-center text-center"
          >
            <div className="w-20 h-20 rounded-full bg-brand-500/20 flex items-center justify-center mb-6 text-4xl group-hover:scale-110 group-hover:-rotate-6 transition-all duration-300">
              🎓
            </div>
            <h2 className="text-2xl font-bold mb-2">Learning Management</h2>
            <p className="text-slate-400">Access course materials, virtual classrooms, and academic resources.</p>
          </div>

        </div>
      </div>
    </div>
  );
}
