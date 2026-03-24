import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

interface CreateSchoolPageProps {
  onCreated: (schoolId: string) => void;
}

const slugify = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const hashPassword = async (value: string) => {
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

type AccessMode = 'lookup' | 'set-password' | 'enter-password';

const CreateSchoolPage: React.FC<CreateSchoolPageProps> = ({ onCreated }) => {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [password, setPassword] = useState('');
  const [accessMode, setAccessMode] = useState<AccessMode>('lookup');
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolvedSchoolId, setResolvedSchoolId] = useState<string | null>(null);

  const handleNameChange = (value: string) => {
    setName(value);
    if (!slugManuallyEdited) {
      setSlug(slugify(value));
    }
  };

  const handleSlugChange = (value: string) => {
    setSlugManuallyEdited(true);
    setSlug(value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
  };

  const resetLookup = () => {
    setAccessMode('lookup');
    setPassword('');
    setError(null);
  };

  const ensureSession = async () => {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      throw new Error(sessionError.message || 'Failed to check your session.');
    }

    if (session?.user) {
      return session.user;
    }

    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) {
      throw new Error(
        error.message || 'Anonymous sign-in is not enabled. Enable it in Supabase Auth > Providers > Anonymous sign-ins.'
      );
    }

    if (!data.user) {
      throw new Error('Could not create a session for school access.');
    }

    return data.user;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    const trimmedSlug = slug.trim();
    const trimmedPassword = password.trim();

    if (!trimmedName) {
      setError('School name is required.');
      return;
    }
    if (!trimmedSlug) {
      setError('School slug is required.');
      return;
    }
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(trimmedSlug) && trimmedSlug.length > 1) {
      setError('Slug must be lowercase letters, numbers, and hyphens only (no leading/trailing hyphens).');
      return;
    }

    setLoading(true);
    try {
      await ensureSession();

      if (accessMode === 'lookup') {
        const { data, error: statusError } = await supabase.rpc('school_access_status', {
          p_name: trimmedName,
          p_slug: trimmedSlug,
        });

        if (statusError) {
          throw new Error(statusError.message || 'Failed to check school access.');
        }

        const school = Array.isArray(data) ? data[0] : null;
        if (!school?.school_id) {
          throw new Error('School not found. Ask the administrator to create it in Supabase first.');
        }

        setResolvedSchoolId(school.school_id);
        setAccessMode(school.password_set ? 'enter-password' : 'set-password');
        setPassword('');
        return;
      }

      if (!trimmedPassword) {
        throw new Error('School password is required.');
      }

      if (trimmedPassword.length < 8) {
        throw new Error('School password must be at least 8 characters long.');
      }

      const passwordHash = await hashPassword(trimmedPassword);
      const { error: accessError } = await supabase.rpc('school_access_enter', {
        p_name: trimmedName,
        p_slug: trimmedSlug,
        p_password_hash: passwordHash,
      });

      if (accessError) {
        throw new Error(accessError.message || 'Failed to access the school.');
      }

      if (resolvedSchoolId) {
        onCreated(resolvedSchoolId);
      } else {
        // Fallback: try to resolve again if needed, but lookup should have it
        onCreated(''); 
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl p-8 space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            School Login
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Enter your school name and slug to continue.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
              School Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. Greenwood Academy"
              disabled={loading}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-60"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
              Slug <span className="font-normal normal-case tracking-normal text-slate-400">(unique URL identifier)</span>
            </label>
            <input
              type="text"
              value={slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              placeholder="e.g. greenwood-academy"
              disabled={loading}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-mono placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-60"
            />
            <p className="text-xs text-slate-400">Lowercase letters, numbers, and hyphens only.</p>
          </div>

          {accessMode !== 'lookup' && (
            <div className="space-y-1">
              <label className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                {accessMode === 'set-password' ? 'Set School Password' : 'School Password'}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                disabled={loading}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-60"
              />
              <p className="text-xs text-slate-400">
                {accessMode === 'set-password'
                  ? 'This school has no password yet. Set it now to continue.'
                  : 'Enter the existing school password to continue.'}
              </p>
            </div>
          )}

          {error && (
            <div className="rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 px-4 py-3">
              <p className="text-xs font-bold text-rose-600 dark:text-rose-400">{error}</p>
            </div>
          )}

          <div className="flex gap-3">
            {accessMode !== 'lookup' && (
              <button
                type="button"
                onClick={resetLookup}
                disabled={loading}
                className="flex-1 py-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-black text-sm uppercase tracking-widest transition-all disabled:opacity-60"
              >
                Back
              </button>
            )}
            <button
              type="submit"
              disabled={loading || !name.trim() || !slug.trim() || (accessMode !== 'lookup' && !password.trim())}
              className="flex-1 py-3.5 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white disabled:text-slate-400 font-black text-sm uppercase tracking-widest transition-all"
            >
              {loading
                ? 'Please wait...'
                : accessMode === 'lookup'
                  ? 'Continue'
                  : accessMode === 'set-password'
                    ? 'Set Password And Enter'
                    : 'Enter School'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateSchoolPage;
