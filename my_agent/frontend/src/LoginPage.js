import React, { useState } from 'react';
import { api } from './api';
import { useToast } from './Toast';

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const { addToast } = useToast();

  function validate() {
    const e = {};
    if (!username.trim()) e.username = 'Username is required';
    if (!password)        e.password = 'Password is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const user = await api.login(username, password);
      addToast(`Welcome back, ${user.username}!`, 'success');
      onLogin(user);
    } catch (err) {
      addToast(err.message || 'Login failed', 'error');
      setErrors({ form: err.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.logo}>
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
            <rect width="36" height="36" rx="8" fill="#3fb950" fillOpacity="0.15"/>
            <path d="M10 14h16M10 18h12M10 22h8" stroke="#3fb950" strokeWidth="2" strokeLinecap="round"/>
            <circle cx="27" cy="22" r="4" fill="#3fb950"/>
          </svg>
          <span style={s.logoText}>PolicyForge</span>
        </div>

        <h1 style={s.title}>Sign in</h1>
        <p style={s.sub}>Convert plain language into OPA/Rego policies</p>

        <form onSubmit={handleSubmit} noValidate>
          <div style={s.field}>
            <label style={s.label}>Username</label>
            <input
              style={{ ...s.input, ...(errors.username ? s.inputErr : {}) }}
              value={username}
              onChange={e => { setUsername(e.target.value); setErrors({}); }}
              placeholder="user123 or admin123"
              autoComplete="username"
              autoFocus
            />
            {errors.username && <span style={s.err}>{errors.username}</span>}
          </div>

          <div style={s.field}>
            <label style={s.label}>Password</label>
            <input
              type="password"
              style={{ ...s.input, ...(errors.password ? s.inputErr : {}) }}
              value={password}
              onChange={e => { setPassword(e.target.value); setErrors({}); }}
              placeholder="Enter your password"
              autoComplete="current-password"
            />
            {errors.password && <span style={s.err}>{errors.password}</span>}
          </div>

          {errors.form && (
            <div style={s.formErr}>
              <span style={{ marginRight: 6 }}>✕</span>{errors.form}
            </div>
          )}

          <button type="submit" style={{ ...s.btn, opacity: loading ? 0.7 : 1 }} disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div style={s.hint}>
          <div style={s.cred}><span style={s.tag}>user</span> user123 / password123</div>
          <div style={s.cred}><span style={s.tagAdmin}>admin</span> admin123 / qwerty123</div>
        </div>
      </div>
    </div>
  );
}

const s = {
  page: {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'linear-gradient(135deg, #0d1117 0%, #161b22 100%)',
    padding: 24,
  },
  card: {
    background: '#161b22', border: '1px solid #30363d', borderRadius: 12,
    padding: '40px 36px', width: '100%', maxWidth: 400,
    boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
  },
  logo: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 },
  logoText: { fontSize: 20, fontWeight: 700, color: '#e6edf3', letterSpacing: '-0.5px' },
  title: { fontSize: 24, fontWeight: 700, color: '#e6edf3', marginBottom: 6 },
  sub: { color: '#8b949e', fontSize: 13, marginBottom: 28 },
  field: { marginBottom: 18 },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: '#8b949e', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' },
  input: {
    width: '100%', padding: '10px 14px', background: '#0d1117',
    border: '1px solid #30363d', borderRadius: 6, color: '#e6edf3',
    fontSize: 14, outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box',
  },
  inputErr: { borderColor: '#f85149' },
  err: { display: 'block', color: '#f85149', fontSize: 12, marginTop: 4 },
  formErr: {
    background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.3)',
    borderRadius: 6, padding: '10px 14px', color: '#f85149', fontSize: 13, marginBottom: 16,
    display: 'flex', alignItems: 'center',
  },
  btn: {
    width: '100%', padding: '12px', background: '#3fb950', border: 'none',
    borderRadius: 6, color: '#0d1117', fontSize: 14, fontWeight: 700,
    marginTop: 8, transition: 'all 0.2s', letterSpacing: '0.3px', cursor: 'pointer',
  },
  hint: { marginTop: 28, paddingTop: 20, borderTop: '1px solid #21262d' },
  cred: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 12, color: '#8b949e' },
  tag: {
    background: 'rgba(63,185,80,0.15)', color: '#3fb950', borderRadius: 4,
    padding: '2px 8px', fontSize: 11, fontWeight: 600,
  },
  tagAdmin: {
    background: 'rgba(88,166,255,0.15)', color: '#58a6ff', borderRadius: 4,
    padding: '2px 8px', fontSize: 11, fontWeight: 600,
  },
};
