import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const DEMOS = [
  { label: 'Manager — Vikram Nair',    email: 'manager@mednova.com', role: 'manager' },
  { label: 'SP 1 — Arjun Mehta',       email: 'sp1@mednova.com',     role: 'sp' },
  { label: 'SP 2 — Priya Sharma',      email: 'sp2@mednova.com',     role: 'sp' },
];

export default function Login() {
  const { login } = useAuth();
  const navigate  = useNavigate();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [busy, setBusy]         = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      const p = await login(email, password);
      navigate(p.role === 'manager' ? '/manager' : '/sp');
    } catch {
      setError('Invalid email or password.');
    }
    setBusy(false);
  };

  return (
    <div style={s.page}>
      <div style={s.card}>
        {/* Brand */}
        <div style={s.brand}>
          <div style={s.logo}>P</div>
          <div>
            <div style={s.appName}>PharmaFlow</div>
            <div style={s.company}>MedNova Pharmaceuticals</div>
          </div>
        </div>

        <h2 style={s.title}>Sign in</h2>

        {error && <div style={s.error}>{error}</div>}

        <form onSubmit={submit} style={s.form}>
          <div style={s.field}>
            <label style={s.label}>Email</label>
            <input style={s.input} type="email" value={email}
              onChange={e => setEmail(e.target.value)} required
              placeholder="your@mednova.com" />
          </div>
          <div style={s.field}>
            <label style={s.label}>Password</label>
            <input style={s.input} type="password" value={password}
              onChange={e => setPassword(e.target.value)} required
              placeholder="••••••••" />
          </div>
          <button style={{ ...s.btn, opacity: busy ? 0.7 : 1 }} disabled={busy}>
            {busy ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        {/* Demo quick-fill */}
        <div style={s.divider}>Quick access</div>
        <div style={s.demos}>
          {DEMOS.map(d => (
            <button key={d.email} style={s.demoBtn}
              onClick={() => { setEmail(d.email); setPassword('mednova123'); setError(''); }}>
              <span style={{ ...s.roleTag, background: d.role === 'manager' ? '#92400e' : '#065f46' }}>
                {d.role === 'manager' ? 'MGR' : 'SP'}
              </span>
              <span style={s.demoLabel}>{d.label}</span>
            </button>
          ))}
        </div>
        <div style={s.hint}>Password: <code style={s.code}>mednova123</code></div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0f172a; font-family: 'Inter', sans-serif; }
        input::placeholder { color: #64748b; }
      `}</style>
    </div>
  );
}

const s = {
  page:      { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: '#0f172a' },
  card:      { background: '#1e293b', border: '1px solid #334155', borderRadius: 16, padding: '36px 32px', width: '100%', maxWidth: 420 },
  brand:     { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 },
  logo:      { width: 40, height: 40, borderRadius: 10, background: '#d97706', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700 },
  appName:   { fontSize: 18, fontWeight: 600, color: '#f1f5f9' },
  company:   { fontSize: 11, color: '#d97706', letterSpacing: '0.08em', textTransform: 'uppercase' },
  title:     { fontSize: 22, fontWeight: 600, color: '#f1f5f9', marginBottom: 20 },
  error:     { background: '#450a0a', border: '1px solid #7f1d1d', borderRadius: 8, padding: '10px 14px', color: '#fca5a5', fontSize: 13, marginBottom: 16 },
  form:      { display: 'flex', flexDirection: 'column', gap: 16 },
  field:     { display: 'flex', flexDirection: 'column', gap: 6 },
  label:     { fontSize: 12, color: '#94a3b8', fontWeight: 500 },
  input:     { background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '11px 14px', fontSize: 14, color: '#f1f5f9', outline: 'none', width: '100%' },
  btn:       { background: '#d97706', border: 'none', borderRadius: 8, padding: '12px', fontSize: 14, fontWeight: 600, color: '#fff', cursor: 'pointer', marginTop: 4 },
  divider:   { textAlign: 'center', fontSize: 11, color: '#475569', margin: '24px 0 12px', textTransform: 'uppercase', letterSpacing: '0.08em' },
  demos:     { display: 'flex', flexDirection: 'column', gap: 8 },
  demoBtn:   { display: 'flex', alignItems: 'center', gap: 10, background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '10px 12px', cursor: 'pointer', textAlign: 'left', width: '100%' },
  roleTag:   { fontSize: 10, fontWeight: 600, color: '#fff', padding: '2px 7px', borderRadius: 4, flexShrink: 0 },
  demoLabel: { fontSize: 13, color: '#cbd5e1' },
  hint:      { fontSize: 12, color: '#475569', textAlign: 'center', marginTop: 14 },
  code:      { background: '#0f172a', padding: '2px 6px', borderRadius: 4, color: '#94a3b8', fontFamily: 'monospace' },
};
