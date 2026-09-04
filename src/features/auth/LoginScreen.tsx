import React, { useEffect, useState } from 'react';
import { Building2, LockKeyhole, LogIn, ShieldCheck, UserPlus } from 'lucide-react';

type AuthMode = 'login' | 'signup';

interface LoginScreenProps {
  onLogin: (email: string, password: string) => Promise<void>;
  onSignUp: (labName: string, name: string, email: string, password: string) => Promise<void>;
  onOfflineUnlock?: (email: string, password: string) => Promise<void>;
  offlineAvailable?: boolean;
  error?: string | null;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLogin,
  onSignUp,
  onOfflineUnlock,
  offlineAvailable = false,
  error: externalError,
}) => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [labName, setLabName] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [offlineLoading, setOfflineLoading] = useState(false);
  const [error, setError] = useState<string | null>(externalError || null);

  useEffect(() => setError(externalError || null), [externalError]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (mode === 'signup') {
        if (password.length < 12) throw new Error('The password must contain at least 12 characters.');
        if (password !== confirmPassword) throw new Error('The passwords do not match.');
        await onSignUp(labName, name, email, password);
      } else {
        await onLogin(email, password);
      }
    } catch (reason: unknown) {
      setError(reason instanceof Error
        ? reason.message
        : mode === 'signup' ? 'Unable to create the laboratory.' : 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  };

  const handleOfflineUnlock = async () => {
    if (!onOfflineUnlock) return;
    setOfflineLoading(true);
    setError(null);
    try {
      await onOfflineUnlock(email, password);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Unable to unlock the offline workspace.');
    } finally {
      setOfflineLoading(false);
    }
  };

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setError(null);
    setPassword('');
    setConfirmPassword('');
  };

  const isSignup = mode === 'signup';

  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-xl bg-teal-700 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900">LabPulse India</h1>
            <p className="text-xs text-slate-500">Secure diagnostic reporting</p>
          </div>
        </div>

        <h2 className="text-base font-bold text-slate-900">
          {isSignup ? 'Create your laboratory account' : 'Sign in to your laboratory'}
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          {isSignup ? 'Set up a new laboratory and become its owner.' : 'Use the owner or staff account configured for this lab.'}
        </p>

        {error && <div role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800">{error}</div>}

        {isSignup && (
          <>
            <label className="block mt-5 text-xs font-bold text-slate-700">
              Laboratory name
              <div className="relative mt-1">
                <Building2 className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  required
                  autoComplete="organization"
                  value={labName}
                  onChange={(event) => setLabName(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm font-medium text-slate-900 outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>
            </label>

            <label className="block mt-4 text-xs font-bold text-slate-700">
              Owner name
              <input
                type="text"
                required
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:ring-2 focus:ring-teal-600"
              />
            </label>
          </>
        )}

        <label className="block mt-5 text-xs font-bold text-slate-700">
          Email
          <input
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:ring-2 focus:ring-teal-600"
          />
        </label>

        <label className="block mt-4 text-xs font-bold text-slate-700">
          Password
          <div className="relative mt-1">
            <LockKeyhole className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
            <input
              type="password"
              required
              minLength={isSignup ? 12 : undefined}
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm font-medium text-slate-900 outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>
          {isSignup && <span className="mt-1 block text-[11px] font-medium text-slate-500">Use at least 12 characters.</span>}
        </label>

        {isSignup && (
          <label className="block mt-4 text-xs font-bold text-slate-700">
            Repeat password
            <div className="relative mt-1">
              <LockKeyhole className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              <input
                type="password"
                required
                minLength={12}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm font-medium text-slate-900 outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>
          </label>
        )}

        <button type="submit" disabled={loading} className="mt-6 w-full flex items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-teal-800 disabled:cursor-wait disabled:opacity-60">
          {isSignup ? <UserPlus className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
          {loading ? isSignup ? 'Creating account...' : 'Signing in...' : isSignup ? 'Create laboratory account' : 'Sign in'}
        </button>

        {!isSignup && offlineAvailable && onOfflineUnlock && (
          <button type="button" disabled={loading || offlineLoading} onClick={() => void handleOfflineUnlock()} className="mt-3 w-full rounded-lg border border-teal-200 bg-teal-50 px-4 py-2.5 text-sm font-bold text-teal-800 transition hover:bg-teal-100 disabled:cursor-wait disabled:opacity-60">
            {offlineLoading ? 'Unlocking cached workspace...' : 'Unlock cached workspace offline'}
          </button>
        )}

        <div className="mt-5 text-center text-xs text-slate-500">
          {isSignup ? 'Already have an account?' : 'New to LabPulse?'}{' '}
          <button
            type="button"
            onClick={() => switchMode(isSignup ? 'login' : 'signup')}
            className="font-bold text-teal-700 hover:text-teal-900"
          >
            {isSignup ? 'Sign in' : 'Create a laboratory account'}
          </button>
        </div>
      </form>
    </main>
  );
};
