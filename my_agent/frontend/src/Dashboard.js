import React, { useState, useEffect, useCallback } from 'react';
import { api } from './api';
import { useToast } from './Toast';

const EXAMPLES = [
  'Only allow GET requests to /public/* paths without authentication',
  'Users with the role "admin" can read and write all resources; other users can only read',
  'Deny access if the request originates from outside the EU region',
  'Allow a user to update their own profile but not others',
];

export default function Dashboard({ user, onLogout }) {
  const [nl, setNl]           = useState('');
  const [title, setTitle]     = useState('');
  const [regoCode, setRegoCode] = useState('');
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [policies, setPolicies] = useState([]);
  const [loadingPolicies, setLoadingPolicies] = useState(true);
  const [selected, setSelected] = useState(null);
  const [stats, setStats]     = useState(null);
  const [tab, setTab]         = useState('editor'); // 'editor' | 'saved' | 'admin'
  const [errors, setErrors]   = useState({});
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [copied, setCopied]   = useState(false);
  const { addToast } = useToast();

  const loadPolicies = useCallback(async () => {
    setLoadingPolicies(true);
    try {
      const data = await api.getPolicies();
      setPolicies(data);
    } catch (err) {
      addToast('Failed to load policies', 'error');
    } finally {
      setLoadingPolicies(false);
    }
  }, [addToast]);

  const loadStats = useCallback(async () => {
    if (user.role !== 'admin') return;
    try {
      const data = await api.adminStats();
      setStats(data);
    } catch {}
  }, [user.role]);

  useEffect(() => {
    loadPolicies();
    loadStats();
  }, [loadPolicies, loadStats]);

  function validate() {
    const e = {};
    if (!nl.trim() || nl.trim().length < 10) e.nl = 'Please describe the policy in at least 10 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleGenerate() {
    if (!validate()) return;
    setGenerating(true);
    setRegoCode('');
    try {
      const { rego_code } = await api.generate(nl);
      setRegoCode(rego_code);
      if (!title) setTitle(nl.slice(0, 60).trim());
      addToast('Rego policy generated!', 'success');
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave() {
    if (!regoCode) { addToast('Generate a policy first', 'warning'); return; }
    if (!title.trim() || title.trim().length < 3) {
      setErrors(e => ({ ...e, title: 'Title must be at least 3 characters' }));
      addToast('Enter a valid title (min 3 chars)', 'warning');
      return;
    }
    setSaving(true);
    try {
      if (selected) {
        await api.updatePolicy(selected.id, { title, natural_language: nl, rego_code: regoCode });
        addToast('Policy updated', 'success');
      } else {
        await api.savePolicy({ title, natural_language: nl, rego_code: regoCode });
        addToast('Policy saved to database', 'success');
      }
      await loadPolicies();
      await loadStats();
      handleNew();
      setTab('saved');
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  function handleNew() {
    setNl(''); setTitle(''); setRegoCode(''); setSelected(null); setErrors({});
  }

  function handleEdit(p) {
    setSelected(p); setNl(p.natural_language); setTitle(p.title);
    setRegoCode(p.rego_code); setTab('editor');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleDelete(id) {
    try {
      await api.deletePolicy(id);
      addToast('Policy deleted', 'success');
      setPolicies(prev => prev.filter(p => p.id !== id));
      await loadStats();
      setDeleteConfirm(null);
    } catch (err) {
      addToast(err.message, 'error');
    }
  }

  async function handleLogout() {
    await api.logout().catch(() => {});
    onLogout();
  }

  function copyRego() {
    navigator.clipboard.writeText(regoCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      addToast('Copied to clipboard', 'success');
    });
  }

  return (
    <div style={s.layout}>
      {/* Sidebar */}
      <aside style={s.sidebar}>
        <div style={s.sideTop}>
          <div style={s.brand}>
            <svg width="28" height="28" viewBox="0 0 36 36" fill="none">
              <rect width="36" height="36" rx="8" fill="#3fb950" fillOpacity="0.15"/>
              <path d="M10 14h16M10 18h12M10 22h8" stroke="#3fb950" strokeWidth="2" strokeLinecap="round"/>
              <circle cx="27" cy="22" r="4" fill="#3fb950"/>
            </svg>
            <span style={s.brandText}>PolicyForge</span>
          </div>

          <nav style={s.nav}>
            {[
              { id: 'editor', label: 'Policy Editor', icon: '✦' },
              { id: 'saved',  label: `Saved Policies${policies.length ? ` (${policies.length})` : ''}`, icon: '◫' },
              ...(user.role === 'admin' ? [{ id: 'admin', label: 'Admin Panel', icon: '⬡' }] : []),
            ].map(item => (
              <button key={item.id} onClick={() => setTab(item.id)}
                style={{ ...s.navItem, ...(tab === item.id ? s.navActive : {}) }}>
                <span style={s.navIcon}>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        <div style={s.sideBottom}>
          <div style={s.userBadge}>
            <div style={s.avatar}>{user.username[0].toUpperCase()}</div>
            <div>
              <div style={s.userName}>{user.username}</div>
              <div style={s.userRole}>{user.role === 'admin' ? '⬡ Admin' : '◯ User'}</div>
            </div>
          </div>
          <button onClick={handleLogout} style={s.logoutBtn}>Sign out</button>
        </div>
      </aside>

      {/* Main content */}
      <main style={s.main}>

        {/* ── EDITOR TAB ─────────────────────────────────── */}
        {tab === 'editor' && (
          <div style={s.content}>
            <div style={s.pageHeader}>
              <div>
                <h1 style={s.pageTitle}>
                  {selected ? `Editing: ${selected.title}` : 'Policy Editor'}
                </h1>
                <p style={s.pageSub}>Describe your access policy in plain English — AI converts it to Rego</p>
              </div>
              {selected && (
                <button onClick={handleNew} style={s.newBtn}>+ New Policy</button>
              )}
            </div>

            {/* Examples */}
            {!nl && (
              <div style={s.examples}>
                <div style={s.exLabel}>Try an example:</div>
                <div style={s.exGrid}>
                  {EXAMPLES.map((ex, i) => (
                    <button key={i} onClick={() => setNl(ex)} style={s.exChip}>{ex}</button>
                  ))}
                </div>
              </div>
            )}

            {/* NL input */}
            <div style={s.card}>
              <label style={s.cardLabel}>Policy Description</label>
              <textarea
                style={{ ...s.textarea, ...(errors.nl ? { borderColor: '#f85149' } : {}) }}
                value={nl}
                onChange={e => { setNl(e.target.value); setErrors({}); }}
                placeholder="e.g. Only admin users can delete resources. Regular users can only read."
                rows={5}
              />
              {errors.nl && <span style={s.fieldErr}>{errors.nl}</span>}
              <div style={s.charCount}>{nl.length} / 2000</div>

              <div style={s.row}>
                <input
                  style={{ ...s.titleInput, ...(errors.title ? { borderColor: '#f85149' } : {}) }}
                  value={title}
                  onChange={e => { setTitle(e.target.value); setErrors(e2 => ({ ...e2, title: undefined })); }}
                  placeholder="Policy title (e.g. Admin Delete Guard)"
                />
                {errors.title && <span style={s.fieldErr}>{errors.title}</span>}

                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  style={{ ...s.genBtn, opacity: generating ? 0.7 : 1 }}>
                  {generating ? (
                    <><span style={s.spinner} />Generating…</>
                  ) : '⚡ Generate Rego'}
                </button>
              </div>
            </div>

            {/* Rego output */}
            {(regoCode || generating) && (
              <div style={s.card}>
                <div style={s.codeHeader}>
                  <div>
                    <label style={s.cardLabel}>Generated Rego Policy</label>
                    <span style={s.regoTag}>OPA / Rego</span>
                  </div>
                  <div style={s.codeActions}>
                    <button onClick={copyRego} style={s.copyBtn}>
                      {copied ? '✓ Copied' : '⎘ Copy'}
                    </button>
                    <button onClick={handleSave} disabled={saving} style={s.saveBtn}>
                      {saving ? 'Saving…' : selected ? '↑ Update' : '✦ Save Policy'}
                    </button>
                  </div>
                </div>
                {generating ? (
                  <div style={s.generating}>
                    <div style={s.pulse} />
                    <span>Generating your Rego policy…</span>
                  </div>
                ) : (
                  <textarea
                    style={s.codeEdit}
                    value={regoCode}
                    onChange={e => setRegoCode(e.target.value)}
                    spellCheck={false}
                    rows={14}
                  />
                )}
              </div>
            )}
          </div>
        )}

        {/* ── SAVED TAB ─────────────────────────────────── */}
        {tab === 'saved' && (
          <div style={s.content}>
            <div style={s.pageHeader}>
              <div>
                <h1 style={s.pageTitle}>Saved Policies</h1>
                <p style={s.pageSub}>{policies.length} {policies.length === 1 ? 'policy' : 'policies'} stored in database</p>
              </div>
              <button onClick={() => setTab('editor')} style={s.newBtn}>+ New Policy</button>
            </div>

            {loadingPolicies ? (
              <div style={s.empty}>Loading…</div>
            ) : policies.length === 0 ? (
              <div style={s.emptyCard}>
                <div style={s.emptyIcon}>◫</div>
                <div style={s.emptyTitle}>No policies yet</div>
                <div style={s.emptySub}>Generate and save your first Rego policy</div>
                <button onClick={() => setTab('editor')} style={s.genBtn}>+ Create Policy</button>
              </div>
            ) : (
              <div style={s.policyList}>
                {policies.map(p => (
                  <div key={p.id} style={s.policyCard}>
                    <div style={s.policyTop}>
                      <div>
                        <div style={s.policyTitle}>{p.title}</div>
                        <div style={s.policyMeta}>
                          {user.role === 'admin' && <span style={s.createdBy}>by {p.created_by} · </span>}
                          {new Date(p.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                      </div>
                      <div style={s.policyActions}>
                        <button onClick={() => handleEdit(p)} style={s.editBtn}>Edit</button>
                        <button onClick={() => setDeleteConfirm(p.id)} style={s.delBtn}>Delete</button>
                      </div>
                    </div>
                    <div style={s.policyNL}>{p.natural_language}</div>
                    <pre style={s.policyCode}><code>{p.rego_code}</code></pre>

                    {deleteConfirm === p.id && (
                      <div style={s.confirmBox}>
                        <span style={{ color: '#f85149' }}>⚠ Delete this policy?</span>
                        <button onClick={() => handleDelete(p.id)} style={s.confirmDel}>Yes, delete</button>
                        <button onClick={() => setDeleteConfirm(null)} style={s.confirmCancel}>Cancel</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── ADMIN TAB ─────────────────────────────────── */}
        {tab === 'admin' && user.role === 'admin' && (
          <div style={s.content}>
            <div style={s.pageHeader}>
              <div>
                <h1 style={s.pageTitle}>Admin Panel</h1>
                <p style={s.pageSub}>System overview and policy management</p>
              </div>
              <button onClick={loadStats} style={s.newBtn}>↻ Refresh</button>
            </div>

            {stats && (
              <>
                <div style={s.statsGrid}>
                  {[
                    { label: 'Total Policies', value: stats.total_policies, color: '#58a6ff' },
                    { label: 'Active Policies', value: stats.active_policies, color: '#3fb950' },
                    { label: 'Total Users', value: stats.total_users, color: '#d29922' },
                  ].map(st => (
                    <div key={st.label} style={s.statCard}>
                      <div style={{ ...s.statValue, color: st.color }}>{st.value}</div>
                      <div style={s.statLabel}>{st.label}</div>
                    </div>
                  ))}
                </div>

                {stats.policies_by_user.length > 0 && (
                  <div style={s.card}>
                    <label style={s.cardLabel}>Policies by User</label>
                    {stats.policies_by_user.map(u => (
                      <div key={u.created_by} style={s.userRow}>
                        <span style={s.userName2}>{u.created_by}</span>
                        <div style={s.barWrap}>
                          <div style={{
                            ...s.bar,
                            width: `${Math.min(100, (u.count / stats.total_policies) * 100)}%`,
                          }} />
                        </div>
                        <span style={s.barLabel}>{u.count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            <div style={s.card}>
              <label style={s.cardLabel}>All Policies</label>
              <div style={s.policyList}>
                {policies.map(p => (
                  <div key={p.id} style={s.policyCard}>
                    <div style={s.policyTop}>
                      <div>
                        <div style={s.policyTitle}>{p.title}</div>
                        <div style={s.policyMeta}>by {p.created_by} · {new Date(p.created_at).toLocaleDateString()}</div>
                      </div>
                      <div style={s.policyActions}>
                        <button onClick={() => handleEdit(p)} style={s.editBtn}>Edit</button>
                        <button onClick={() => setDeleteConfirm(p.id)} style={s.delBtn}>Delete</button>
                      </div>
                    </div>
                    {deleteConfirm === p.id && (
                      <div style={s.confirmBox}>
                        <span style={{ color: '#f85149' }}>⚠ Delete this policy?</span>
                        <button onClick={() => handleDelete(p.id)} style={s.confirmDel}>Yes, delete</button>
                        <button onClick={() => setDeleteConfirm(null)} style={s.confirmCancel}>Cancel</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

const s = {
  layout: { display: 'flex', height: '100vh', overflow: 'hidden' },

  sidebar: {
    width: 220, background: '#161b22', borderRight: '1px solid #21262d',
    display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
    flexShrink: 0, padding: '20px 0',
  },
  sideTop: { padding: '0 12px' },
  brand: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32, paddingLeft: 4 },
  brandText: { fontSize: 16, fontWeight: 700, color: '#e6edf3' },
  nav: { display: 'flex', flexDirection: 'column', gap: 4 },
  navItem: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
    background: 'none', border: 'none', color: '#8b949e', borderRadius: 6,
    fontSize: 13, fontWeight: 500, textAlign: 'left', transition: 'all 0.15s',
    cursor: 'pointer',
  },
  navActive: { background: 'rgba(63,185,80,0.1)', color: '#3fb950' },
  navIcon: { fontSize: 12, width: 16, textAlign: 'center' },
  sideBottom: { padding: '0 12px' },
  userBadge: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, padding: '10px 8px' },
  avatar: {
    width: 32, height: 32, borderRadius: '50%', background: 'rgba(63,185,80,0.2)',
    color: '#3fb950', fontSize: 13, fontWeight: 700, display: 'flex',
    alignItems: 'center', justifyContent: 'center',
  },
  userName: { fontSize: 13, fontWeight: 600, color: '#e6edf3' },
  userRole: { fontSize: 11, color: '#8b949e', marginTop: 1 },
  logoutBtn: {
    width: '100%', padding: '8px 12px', background: 'none',
    border: '1px solid #30363d', borderRadius: 6, color: '#8b949e',
    fontSize: 12, fontWeight: 500, transition: 'all 0.2s', cursor: 'pointer',
  },

  main: { flex: 1, overflow: 'auto', background: '#0d1117' },
  content: { maxWidth: 820, margin: '0 auto', padding: '32px 24px' },

  pageHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 },
  pageTitle: { fontSize: 22, fontWeight: 700, color: '#e6edf3', marginBottom: 4 },
  pageSub: { color: '#8b949e', fontSize: 13 },
  newBtn: {
    padding: '8px 16px', background: 'rgba(63,185,80,0.1)', border: '1px solid rgba(63,185,80,0.3)',
    borderRadius: 6, color: '#3fb950', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },

  examples: { marginBottom: 20 },
  exLabel: { fontSize: 11, color: '#8b949e', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 },
  exGrid: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  exChip: {
    padding: '6px 12px', background: '#161b22', border: '1px solid #30363d',
    borderRadius: 20, color: '#8b949e', fontSize: 12, cursor: 'pointer',
    transition: 'all 0.15s', textAlign: 'left',
  },

  card: {
    background: '#161b22', border: '1px solid #21262d', borderRadius: 10,
    padding: 20, marginBottom: 16,
  },
  cardLabel: {
    display: 'block', fontSize: 11, fontWeight: 700, color: '#8b949e',
    textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 12,
  },
  textarea: {
    width: '100%', padding: '12px 14px', background: '#0d1117',
    border: '1px solid #30363d', borderRadius: 6, color: '#e6edf3',
    fontSize: 14, resize: 'vertical', outline: 'none', lineHeight: 1.7,
    transition: 'border-color 0.2s', boxSizing: 'border-box',
  },
  fieldErr: { display: 'block', color: '#f85149', fontSize: 12, marginTop: 4 },
  charCount: { fontSize: 11, color: '#8b949e', textAlign: 'right', marginTop: 4 },

  row: { display: 'flex', gap: 10, marginTop: 14, alignItems: 'flex-start', flexWrap: 'wrap' },
  titleInput: {
    flex: 1, minWidth: 160, padding: '10px 14px', background: '#0d1117',
    border: '1px solid #30363d', borderRadius: 6, color: '#e6edf3', fontSize: 14, outline: 'none',
  },
  genBtn: {
    padding: '10px 20px', background: '#3fb950', border: 'none',
    borderRadius: 6, color: '#0d1117', fontSize: 13, fontWeight: 700,
    display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', cursor: 'pointer',
  },
  spinner: {
    display: 'inline-block', width: 12, height: 12,
    border: '2px solid rgba(0,0,0,0.3)', borderTopColor: '#0d1117',
    borderRadius: '50%', animation: 'spin 0.8s linear infinite',
  },

  codeHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 },
  regoTag: {
    background: 'rgba(88,166,255,0.1)', color: '#58a6ff', borderRadius: 4,
    padding: '2px 8px', fontSize: 11, fontWeight: 600, marginLeft: 8,
  },
  codeActions: { display: 'flex', gap: 8 },
  copyBtn: {
    padding: '6px 14px', background: 'none', border: '1px solid #30363d',
    borderRadius: 6, color: '#8b949e', fontSize: 12, fontWeight: 500, cursor: 'pointer',
  },
  saveBtn: {
    padding: '6px 16px', background: '#3fb950', border: 'none',
    borderRadius: 6, color: '#0d1117', fontSize: 12, fontWeight: 700, cursor: 'pointer',
  },
  codeEdit: {
    width: '100%', background: '#0d1117', border: '1px solid #21262d', borderRadius: 6,
    padding: '16px', fontSize: 13, lineHeight: 1.7, color: '#e6edf3',
    fontFamily: "'JetBrains Mono', monospace", resize: 'vertical', outline: 'none',
    boxSizing: 'border-box',
  },
  generating: {
    display: 'flex', alignItems: 'center', gap: 12, padding: '20px',
    color: '#8b949e', fontSize: 13,
  },
  pulse: {
    width: 10, height: 10, borderRadius: '50%', background: '#3fb950',
    animation: 'pulse 1.2s ease-in-out infinite',
  },

  empty: { textAlign: 'center', padding: '80px 0', color: '#8b949e' },
  emptyCard: {
    textAlign: 'center', padding: '60px 24px', background: '#161b22',
    border: '1px dashed #30363d', borderRadius: 10,
  },
  emptyIcon: { fontSize: 36, color: '#30363d', marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: 600, color: '#e6edf3', marginBottom: 6 },
  emptySub: { color: '#8b949e', fontSize: 13, marginBottom: 20 },

  policyList: { display: 'flex', flexDirection: 'column', gap: 12 },
  policyCard: {
    background: '#161b22', border: '1px solid #21262d', borderRadius: 10, padding: 18,
  },
  policyTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  policyTitle: { fontSize: 15, fontWeight: 600, color: '#e6edf3', marginBottom: 4 },
  policyMeta: { fontSize: 11, color: '#8b949e' },
  createdBy: { color: '#58a6ff' },
  policyNL: { color: '#8b949e', fontSize: 13, marginBottom: 10, fontStyle: 'italic' },
  policyCode: {
    background: '#0d1117', border: '1px solid #21262d', borderRadius: 6,
    padding: '10px 14px', fontSize: 12, color: '#e6edf3', overflowX: 'auto',
    fontFamily: "'JetBrains Mono', monospace", maxHeight: 180, overflow: 'auto',
  },
  policyActions: { display: 'flex', gap: 8, flexShrink: 0 },
  editBtn: {
    padding: '5px 14px', background: 'none', border: '1px solid #30363d',
    borderRadius: 5, color: '#8b949e', fontSize: 12, fontWeight: 500, cursor: 'pointer',
  },
  delBtn: {
    padding: '5px 14px', background: 'none', border: '1px solid rgba(248,81,73,0.3)',
    borderRadius: 5, color: '#f85149', fontSize: 12, fontWeight: 500, cursor: 'pointer',
  },
  confirmBox: {
    marginTop: 12, padding: '10px 14px', background: 'rgba(248,81,73,0.08)',
    border: '1px solid rgba(248,81,73,0.2)', borderRadius: 6,
    display: 'flex', alignItems: 'center', gap: 10, fontSize: 13,
  },
  confirmDel: {
    padding: '4px 12px', background: '#f85149', border: 'none',
    borderRadius: 4, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
  },
  confirmCancel: {
    padding: '4px 12px', background: 'none', border: '1px solid #30363d',
    borderRadius: 4, color: '#8b949e', fontSize: 12, cursor: 'pointer',
  },

  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 },
  statCard: {
    background: '#161b22', border: '1px solid #21262d', borderRadius: 10,
    padding: '20px', textAlign: 'center',
  },
  statValue: { fontSize: 36, fontWeight: 700, lineHeight: 1 },
  statLabel: { color: '#8b949e', fontSize: 12, marginTop: 6, fontWeight: 500 },

  userRow: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 },
  userName2: { width: 90, fontSize: 13, color: '#e6edf3', fontWeight: 500 },
  barWrap: { flex: 1, background: '#21262d', borderRadius: 4, height: 8 },
  bar: { height: '100%', background: '#3fb950', borderRadius: 4, transition: 'width 0.5s ease' },
  barLabel: { fontSize: 12, color: '#8b949e', width: 24 },
};
