import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { login, register } from './api';
import { useAuth } from './AuthContext';

export default function Login() {
  const { isAuthenticated, signIn } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ email: '', username: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/chat" replace />;
  }

  function updateField(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);

    try {
      const authResult = mode === 'login'
        ? await login({ email: form.email, password: form.password })
        : await register(form);
      signIn(authResult);
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-on-surface flex items-center justify-center px-6">
      <form onSubmit={handleSubmit} className="w-full max-w-md bg-surface-container-low border border-outline-variant/30 rounded-xl p-8 shadow-2xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-11 h-11 bg-primary-container rounded-xl flex items-center justify-center">
            <span className="material-symbols-outlined text-on-primary-container" style={{fontVariationSettings:"'FILL' 1"}}>psychology</span>
          </div>
          <div>
            <h1 className="text-[24px] font-semibold">DocMind AI</h1>
            <p className="text-[11px] text-primary/70 tracking-widest uppercase">Secure Workspace</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 bg-surface-container-high rounded-lg p-1 mb-6">
          <button type="button" onClick={() => setMode('login')} className={`py-2 rounded-md text-[12px] uppercase font-semibold ${mode === 'login' ? 'bg-primary text-on-primary' : 'text-on-surface-variant'}`}>Login</button>
          <button type="button" onClick={() => setMode('register')} className={`py-2 rounded-md text-[12px] uppercase font-semibold ${mode === 'register' ? 'bg-primary text-on-primary' : 'text-on-surface-variant'}`}>Register</button>
        </div>

        <label className="block text-[11px] uppercase tracking-wider text-on-surface-variant mb-2">Email</label>
        <input name="email" type="email" value={form.email} onChange={updateField} required className="w-full mb-4 px-4 py-3 bg-surface-container-high border border-outline-variant/30 rounded-lg outline-none focus:border-primary" />

        {mode === 'register' && (
          <>
            <label className="block text-[11px] uppercase tracking-wider text-on-surface-variant mb-2">Username</label>
            <input name="username" value={form.username} onChange={updateField} minLength={3} maxLength={32} required className="w-full mb-4 px-4 py-3 bg-surface-container-high border border-outline-variant/30 rounded-lg outline-none focus:border-primary" />
          </>
        )}

        <label className="block text-[11px] uppercase tracking-wider text-on-surface-variant mb-2">Password</label>
        <input name="password" type="password" value={form.password} onChange={updateField} minLength={mode === 'register' ? 8 : undefined} required className="w-full mb-5 px-4 py-3 bg-surface-container-high border border-outline-variant/30 rounded-lg outline-none focus:border-primary" />

        {error && <div className="mb-4 text-[13px] text-red-300 bg-red-950/30 border border-red-800/40 rounded-lg p-3">{error}</div>}

        <button disabled={busy} className="w-full py-3 bg-primary text-on-primary font-semibold rounded-lg hover:opacity-90 disabled:opacity-60 transition-all">
          {busy ? 'Please wait...' : mode === 'login' ? 'Login' : 'Create Account'}
        </button>
      </form>
    </div>
  );
}
