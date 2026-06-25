const BASE = process.env.REACT_APP_API_URL || '';

async function apiFetch(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const api = {
  login:          (username, password) => apiFetch('/api/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  logout:         ()                   => apiFetch('/api/logout', { method: 'POST' }),
  me:             ()                   => apiFetch('/api/me'),
  generate:       (natural_language)   => apiFetch('/api/generate', { method: 'POST', body: JSON.stringify({ natural_language }) }),
  getPolicies:    ()                   => apiFetch('/api/policies'),
  savePolicy:     (p)                  => apiFetch('/api/policies', { method: 'POST', body: JSON.stringify(p) }),
  updatePolicy:   (id, p)              => apiFetch(`/api/policies/${id}`, { method: 'PUT', body: JSON.stringify(p) }),
  deletePolicy:   (id)                 => apiFetch(`/api/policies/${id}`, { method: 'DELETE' }),
  adminStats:     ()                   => apiFetch('/api/admin/stats'),
  health:         ()                   => apiFetch('/api/health'),
};
