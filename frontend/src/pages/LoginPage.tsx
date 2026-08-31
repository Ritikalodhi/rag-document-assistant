import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AuthShell } from '@/components/layout/AuthShell';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/dashboard';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await login({ email, password });
      navigate(from, { replace: true });
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { detail?: string } } };
        setError(axiosErr.response?.data?.detail ?? 'Login failed. Please check your credentials.');
      } else {
        setError('Login failed. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell>
      {/* Title section */}
      <div className="mb-7">
        <h1 className="font-display text-[30px] font-semibold tracking-[-0.025em] text-white mb-1.5">
          Welcome back
        </h1>
        <p className="text-[14px] text-white/50">
          Sign in to your research workspace.
        </p>
      </div>

      {/* Error alert */}
      {error && (
        <div className="mb-5 px-4 py-3 rounded-[10px] bg-red-500/10 border border-red-500/20 text-red-300 text-[13.5px] flex items-start gap-2.5" role="alert">
          <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          {error}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="login-email" className="text-[13px] font-semibold text-white/70">
            Email address
          </label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="you@example.com"
            className="w-full px-4 py-2.5 rounded-[10px] bg-white/[0.06] border border-white/[0.1] text-white text-[14px] placeholder-white/25 focus:outline-none focus:border-[rgb(99,138,255)]/60 focus:bg-white/[0.08] focus:ring-2 focus:ring-[rgb(99,138,255)]/20 transition-all duration-200"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="login-password" className="text-[13px] font-semibold text-white/70">
            Password
          </label>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            placeholder="••••••••"
            className="w-full px-4 py-2.5 rounded-[10px] bg-white/[0.06] border border-white/[0.1] text-white text-[14px] placeholder-white/25 focus:outline-none focus:border-[rgb(99,138,255)]/60 focus:bg-white/[0.08] focus:ring-2 focus:ring-[rgb(99,138,255)]/20 transition-all duration-200"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          id="login-submit"
          className="w-full mt-1 py-2.5 px-4 rounded-[11px] text-white font-semibold text-[14px] transition-all duration-150 shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg, rgb(99,138,255) 0%, rgb(99,102,241) 100%)' }}
        >
          {isSubmitting ? (
            <>
              <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span>Signing in...</span>
            </>
          ) : (
            'Sign in'
          )}
        </button>
      </form>

      {/* Footer redirection */}
      <p className="mt-6 text-center text-[13.5px] text-white/40">
        New here?{' '}
        <Link
          to="/register"
          className="font-semibold text-white/80 hover:text-white transition-colors underline underline-offset-2 decoration-white/30 hover:decoration-white"
        >
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}