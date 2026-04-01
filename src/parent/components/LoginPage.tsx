
import React, { useState } from 'react';
import { Mail, ShieldCheck, AlertCircle, Info } from 'lucide-react';
import { supabase } from '../../sms/supabaseClient';
import logoIem from '../../sms/src/LOGO_IEM.png';

interface LoginPageProps {
  onLogin: (parentData: { email: string; studentIds: string[]; studentNames: string[]; schoolId: string }) => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setError(null);

    try {
      let { data, error: fetchError } = await supabase
        .from('students')
        .select('id, name, parent_email, secondary_parent_email, school_id')
        .or(`parent_email.eq.${email.trim()},secondary_parent_email.eq.${email.trim()}`);

      if (fetchError) throw fetchError;

      if (data && data.length > 0) {
        setLoading(false);
        onLogin({
          email: email.trim(),
          studentIds: data.map(s => s.id),
          studentNames: data.map(s => s.name),
          schoolId: data[0].school_id || ''
        });
      } else {
        setLoading(false);
        setError('No student records found linked to this email address.');
      }
    } catch (err: any) {
      setLoading(false);
      setError(err.message || 'An error occurred during verification.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 relative overflow-hidden font-inter">
      <div className="absolute top-[-10%] left-[-5%] w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-[-10%] right-[-5%] w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl"></div>

      <div className="max-w-md w-full z-10 animate-scaleIn">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-white rounded-[32px] p-2 shadow-2xl mb-6 transform hover:rotate-3 transition-transform overflow-hidden">
            <img src={logoIem} alt="IEM Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter">IEM Parent Portal</h1>
          <p className="text-slate-500 mt-2 font-medium">Your child's academic journey, simplified.</p>
        </div>

        <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl shadow-slate-200 border border-slate-100">
          <div className="mb-8 text-center sm:text-left">
            <h2 className="text-2xl font-bold text-slate-800">Parental Sign In</h2>
            <p className="text-sm text-slate-400 mt-1">Access secure student monitoring</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 animate-fadeIn">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p className="text-xs font-bold">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Registered Parent Email</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:bg-white transition-all placeholder:text-slate-300"
                  placeholder="parent@example.com"
                />
              </div>
            </div>

            <div className="bg-emerald-50 rounded-2xl p-4 flex gap-3 items-start border border-emerald-100">
              <Info className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <div className="text-[11px] text-emerald-800 leading-relaxed font-bold">
                Enter the email address you registered with the school. No password is required for this gateway.
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-emerald-600/20 hover:bg-emerald-700 transition-all flex items-center justify-center gap-3 disabled:opacity-70"
            >
              {loading ? (
                <div className="w-6 h-6 border-[3px] border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <ShieldCheck className="w-5 h-5" />
                  Access Dashboard
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-100 text-center">
            <p className="text-[10px] text-slate-400 font-medium tracking-widest uppercase">
              Secure Parental Gateway v1.0
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
