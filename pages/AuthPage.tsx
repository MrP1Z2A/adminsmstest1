
import React, { useState } from 'react';
import { UserRole } from '../types';
import { authService } from '../services/authService';

interface AuthPageProps {
  onAuthSuccess: (role: UserRole) => void;
}

const AuthPage: React.FC<AuthPageProps> = ({ onAuthSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [selectedRole, setSelectedRole] = useState<UserRole>('student');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (isLogin) {
        await authService.signIn(email, password);
        // Profile fetching and redirection is handled in App.tsx via onAuthStateChange
      } else {
        await authService.signUp(email, password, fullName, selectedRole);
        alert('Registration successful! Please check your email for verification if required.');
        setIsLogin(true);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-6">
      <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl shadow-slate-200 border border-slate-100 w-full max-w-md">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-2xl font-black mx-auto mb-6 shadow-xl shadow-blue-200">T</div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight">{isLogin ? 'Welcome Back' : 'Create Account'}</h2>
          <p className="text-slate-500 mt-3 font-medium">Empowering your future through learning</p>
        </div>

        {/* Role Toggle for demo purpose */}
        <div className="flex bg-slate-100 p-1 rounded-2xl mb-8">
          {(['student', 'teacher', 'parent', 'admin'] as UserRole[]).map((role) => (
            <button 
              key={role}
              onClick={() => setSelectedRole(role)}
              className={`flex-1 py-3 rounded-xl text-[10px] font-bold transition-all capitalize ${selectedRole === role ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {role}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-600 text-xs font-bold rounded-2xl border border-red-100 animate-in fade-in slide-in-from-top-2">
            {error}
          </div>
        )}

        <form className="space-y-6" onSubmit={handleSubmit}>
          {!isLogin && (
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Full Name</label>
              <input 
                type="text" 
                placeholder="John Doe" 
                className="w-full px-5 py-4 rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Email Address</label>
            <input 
              type="email" 
              placeholder="name@email.com" 
              className="w-full px-5 py-4 rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Password</label>
            <input 
              type="password" 
              placeholder="••••••••" 
              className="w-full px-5 py-4 rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            className={`w-full py-5 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 shadow-xl shadow-blue-200 hover:scale-[1.02] active:scale-95 transition-all ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isLoading ? 'Processing...' : (isLogin ? 'Sign In' : 'Get Started')}
          </button>
        </form>

        <div className="mt-8 text-center text-slate-500 text-sm font-medium">
          {isLogin ? "New to TutorFlow?" : "Already a member?"}{' '}
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="text-blue-600 font-bold hover:underline ml-1"
          >
            {isLogin ? 'Create an account' : 'Log in here'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
