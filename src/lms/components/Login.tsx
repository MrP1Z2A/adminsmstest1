// Import React and required hooks for local state, lifecycle effects, and DOM refs.
import React, { useState, useEffect, useRef } from 'react';
// Import role enum used to route user access after login.
import { UserRole } from '../types';
// Import Supabase client and configuration flag for authentication checks.
import { isSupabaseConfigured, supabase } from '../src/supabaseClient';
import logoIem from '../../sms/src/LOGO_IEM.png';

// Define props accepted by the Login component.
interface LoginProps {
  // Callback used after successful auth for STUDENT or TEACHER roles.
  onLogin: (role: Exclude<UserRole, UserRole.PARENT>, email: string, schoolId?: string, recordId?: string, authUserId?: string) => void;
}

// Create a typed functional component and extract onLogin from props.
const Login: React.FC<LoginProps> = ({ onLogin }) => {
  // Track name or email typed by the user.
  const [identifier, setIdentifier] = useState('');
  // Track password typed by the user.
  const [password, setPassword] = useState('');
  // Toggle password input between hidden and visible modes.
  const [passwordVisible, setPasswordVisible] = useState(false);
  // Store auth errors and success-like feedback messages.
  const [error, setError] = useState('');
  // Disable actions and show waiting text while auth request is running.
  const [loading, setLoading] = useState(false);

  // Keep a reference to the glow overlay so CSS variables can be updated on mouse move.
  const glowRef = useRef<HTMLDivElement>(null);

  // Register a global mousemove listener once to drive the background glow effect.
  useEffect(() => {
    // Capture current mouse position from browser events.
    const handleMouseMove = (e: MouseEvent) => {
      // Only update styles if the glow element is mounted.
      if (glowRef.current) {
        // Set CSS custom property --x to horizontal cursor position.
        glowRef.current.style.setProperty('--x', `${e.clientX}px`);
        // Set CSS custom property --y to vertical cursor position.
        glowRef.current.style.setProperty('--y', `${e.clientY}px`);
      }
    };
    // Attach the listener on mount.
    window.addEventListener('mousemove', handleMouseMove);
    // Remove the listener on unmount to avoid leaks.
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Handle both registration and sign-in based on current mode.
  const handleAuth = async () => {
    // Clear any previous message before new request.
    setError('');
    // Set loading state so UI can prevent duplicate submissions.
    setLoading(true);

    try {
      // Guard against missing backend configuration.
      if (!supabase || !isSupabaseConfigured) {
        throw new Error('Authentication service is not configured. ');
      }

      // --------------------
      // SIGN IN
      // --------------------
      // Fetch matching student credentials from students table.
      const { data: student, error: studentError } = await supabase
        .from('students')
        .select('id, auth_user_id, name, email, temp_password, school_id')
        .or(`name.eq.${identifier},email.eq.${identifier}`)
        .eq('temp_password', password)
        .maybeSingle();

      // Stop if query fails.
      if (studentError) throw studentError;

      // Successful match logs in as student.
      if (student) {
        onLogin(UserRole.STUDENT, student.email || student.name, student.school_id || undefined, student.id, student.auth_user_id || undefined);
        return;
      }

      // If no student found, try matching teacher credentials from teachers table.
      const { data: teacher, error: teacherError } = await supabase
        .from('teachers')
        .select('id, auth_user_id, name, email, temp_password, school_id')
        .or(`name.eq.${identifier},email.eq.${identifier}`)
        .eq('temp_password', password)
        .maybeSingle();

      if (teacherError) throw teacherError;

      if (teacher) {
        onLogin(UserRole.TEACHER, teacher.email || teacher.name, teacher.school_id || undefined, teacher.id, teacher.auth_user_id || undefined);
        return;
      }

      // Reject when no matching student or teacher record exists.
      throw new Error('Invalid name/email or temporary password');
    } catch (err: any) {
      // Display known error message or fallback generic auth error.
      setError(err.message || 'Authentication failed');
    } finally {
      // Always end loading state after auth attempt completes.
      setLoading(false);
    }
  };

  // Render login/register page UI.
  return (
    // Full-screen wrapper with centered card and hidden overflow.
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden font-['Segoe_UI',sans-serif]">
      {/* Background image layer with dark gradient overlay for contrast */}
      <div
        className="fixed inset-0 z-0 bg-cover bg-center"
        style={{
          backgroundImage:
            "linear-gradient(to bottom, rgba(15, 38, 36, 0.9), rgba(10, 26, 25, 0.95)), url('https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=1920')",
        }}
      />

      {/* Mouse-follow glow overlay controlled by CSS variables --x and --y */}
      <div
        ref={glowRef}
        className="fixed inset-0 z-1 pointer-events-none opacity-50"
        style={{
          background:
            'radial-gradient(circle at var(--x, 50%) var(--y, 50%), rgba(78, 165, 157, 0.3), transparent 35%)',
        }}
      />

      {/* Main centered content container */}
      <div className="relative z-10 w-full max-w-[400px] px-6">
        {/* Brand block with icon, title, and subtitle */}
        <div className="flex flex-col items-center mb-10 text-center">
          <div className="w-24 h-24 bg-white rounded-[32px] flex items-center justify-center p-2 shadow-2xl mb-6 overflow-hidden">
            <img src={logoIem} alt="IEM Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-5xl font-black tracking-tighter text-white uppercase ">
            IEM
          </h1>
          <p className="text-[#4ea59d] text-sm font-bold uppercase tracking-[0.3em] mt-2">
            NextGen Learning Portal
          </p>
        </div>

        {/* Auth card containing form controls and actions */}
        <div className="bg-white p-8 rounded-[32px] shadow-[0_40px_100px_rgba(0,0,0,0.5)]">
          {/* Heading updates based on current auth mode */}
          <h2 className="text-center text-xl font-black mb-8 text-[#0f2624] uppercase">
            Authenticate Account
          </h2>

          {/* Show configuration warning when Supabase is unavailable */}
          {!isSupabaseConfigured && (
            <p className="text-amber-600 text-xs text-center mb-4">
              Auth backend is not configured for this deployment.
            </p>
          )}

          {/* Name or email input field */}
          <div className="mb-4">
            <input
              type="text"
              placeholder="Name or Email"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl border bg-[#f8fafc] text-black caret-black"
            />
          </div>

          {/* Password input with visibility toggle button */}
          <div className="mb-4 relative">
            <input
              type={passwordVisible ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl border bg-[#f8fafc] text-black caret-black"
            />
            {/* Toggle password visibility icon */}
            <button
              onClick={() => setPasswordVisible(!passwordVisible)}
              className="absolute right-4 top-1/2 -translate-y-1/2"
            >
              <i className={`fa-solid ${passwordVisible ? 'fa-eye-slash' : 'fa-eye'}`}></i>
            </button>
          </div>

          {/* Show error or status feedback */}
          {error && (
            <p className="text-red-500 text-xs text-center mb-3">{error}</p>
          )}

          {/* Submit button for both register and sign-in actions */}
          <button
            onClick={handleAuth}
            disabled={loading}
            className="w-full py-4 bg-[#4ea59d] text-white rounded-2xl font-black uppercase"
          >
            {loading ? 'Please wait...' : 'Sign In'}
          </button>
        </div>

        {/* Bottom copyright notice */}
        <p className="mt-10 text-center text-white/40 text-[10px] font-bold uppercase tracking-[0.3em]">
          © 2025 IEM Global Academy
        </p>
      </div>
    </div>
  );
};

// Export component as default for use in app entry flow.
export default Login;
