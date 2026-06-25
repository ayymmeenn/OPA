import React, { useState, useEffect } from 'react';
import { api } from './api';
import LoginPage from './LoginPage';
import Dashboard from './Dashboard';

export default function App() {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.me().then(setUser).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ textAlign: 'center', marginTop: 80, color: '#8b949e' }}>Loading…</p>;
  if (!user)   return <LoginPage onLogin={setUser} />;
  return <Dashboard user={user} onLogout={() => setUser(null)} />;
}
