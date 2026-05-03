import React, { useState } from 'react';
import { authService } from '../services/authService';

interface StaffLoginProps {
  schoolName?: string;
  onLoginSuccess: () => void;
  onBackToSchoolSelect: () => void;
  onBackToHubs?: () => void;
}

const StaffLogin: React.FC<StaffLoginProps> = ({ schoolName, onLoginSuccess, onBackToSchoolSelect, onBackToHubs }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await authService.signIn(email, password);
      onLoginSuccess();
    } catch (err: any) {
      setError(err.message || 'Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden transition-colors duration-500">
      {/* Background Decor */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-brand-500/5 rounded-full blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-sky-500/5 rounded-full blur-[120px] animate-pulse delay-700"></div>

      <div className="z-10 w-full max-w-md animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="bg-white dark:bg-slate-900 rounded-[48px] border border-slate-100 dark:border-slate-800 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] p-8 sm:p-12 relative overflow-hidden">
          {/* Top Brand Line */}
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-brand-500 via-sky-400 to-brand-500"></div>

          <div className="text-center mb-10">
            <div className="w-20 h-20 rounded-[28px] bg-gradient-to-br from-brand-500 to-sky-400 text-white flex items-center justify-center text-3xl mx-auto mb-6 shadow-xl shadow-brand-500/20">
              <i className="fas fa-user-tie"></i>
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-500 mb-2">Authenticated Access</p>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white uppercase leading-tight">
              Staff Login
            </h1>
            {schoolName && (
              <p className="mt-2 text-sm font-bold text-slate-400 uppercase tracking-tighter">
                {schoolName}
              </p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-4">Corporate Email</label>
              <div className="relative group">
                <i className="fas fa-envelope absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-brand-500 transition-colors"></i>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@school.edu"
                  disabled={loading}
                  className="w-full pl-14 pr-6 py-5 bg-slate-50 dark:bg-slate-800/50 border-2 border-transparent focus:border-brand-500 rounded-[28px] text-sm font-bold placeholder:text-slate-300 dark:placeholder:text-slate-600 outline-none transition-all shadow-inner"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-4">Secure Password</label>
              <div className="relative group">
                <i className="fas fa-lock absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-brand-500 transition-colors"></i>
                <input
                  required
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  disabled={loading}
                  className="w-full pl-14 pr-6 py-5 bg-slate-50 dark:bg-slate-800/50 border-2 border-transparent focus:border-brand-500 rounded-[28px] text-sm font-bold placeholder:text-slate-300 dark:placeholder:text-slate-600 outline-none transition-all shadow-inner"
                />
              </div>
            </div>

            {error && (
              <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900 rounded-3xl p-4 animate-in fade-in zoom-in duration-300">
                <p className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-3">
                  <i className="fas fa-circle-exclamation text-sm"></i>
                  {error}
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-5 bg-brand-500 text-white font-black rounded-[28px] text-sm uppercase tracking-[0.2em] shadow-xl shadow-brand-500/20 hover:bg-brand-600 active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-70"
            >
              {loading ? (
                <>
                  <i className="fas fa-circle-notch fa-spin"></i>
                  Authenticating...
                </>
              ) : (
                <>
                  Verify & Enter
                  <i className="fas fa-arrow-right"></i>
                </>
              )}
            </button>
          </form>

          <div className="mt-10 pt-8 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-4">
            <button
              type="button"
              onClick={onBackToSchoolSelect}
              className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-brand-500 transition-colors flex items-center justify-center gap-2"
            >
              <i className="fas fa-arrow-left"></i>
              Switch School Instance
            </button>
            {onBackToHubs && (
              <button
                type="button"
                onClick={onBackToHubs}
                className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-brand-500 transition-colors flex items-center justify-center gap-2"
              >
                <i className="fas fa-grid-2"></i>
                Back To Hubs
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mt-12 text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 z-10 opacity-50">
        IEM UNIFIED • SECURE SESSION GATEWAY
      </div>
    </div>
  );
};

export default StaffLogin;
