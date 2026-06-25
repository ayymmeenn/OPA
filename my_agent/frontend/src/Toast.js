import React, { useState, useCallback, createContext, useContext, useEffect } from 'react';

const ToastCtx = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts(t => t.filter(x => x.id !== id));
  }, []);

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, message, type }]);
    if (duration > 0) setTimeout(() => removeToast(id), duration);
    return id;
  }, [removeToast]);

  return (
    <ToastCtx.Provider value={{ addToast, removeToast }}>
      {children}
      <div style={styles.container}>
        {toasts.map(t => (
          <Toast key={t.id} toast={t} onClose={() => removeToast(t.id)} />
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

function Toast({ toast, onClose }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { setTimeout(() => setVisible(true), 10); }, []);

  const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
  const colors = {
    success: '#3fb950',
    error:   '#f85149',
    warning: '#d29922',
    info:    '#58a6ff',
  };

  return (
    <div style={{
      ...styles.toast,
      borderLeft: `3px solid ${colors[toast.type] || colors.info}`,
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateX(0)' : 'translateX(100%)',
    }}>
      <span style={{ color: colors[toast.type], fontWeight: 600, marginRight: 8 }}>
        {icons[toast.type]}
      </span>
      <span style={{ flex: 1, fontSize: 13 }}>{toast.message}</span>
      <button onClick={onClose} style={styles.close}>×</button>
    </div>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}

const styles = {
  container: {
    position: 'fixed', bottom: 20, right: 20,
    display: 'flex', flexDirection: 'column', gap: 10, zIndex: 9999,
    maxWidth: 380,
  },
  toast: {
    background: '#1c2128',
    border: '1px solid #30363d',
    borderRadius: 8,
    padding: '12px 16px',
    display: 'flex', alignItems: 'flex-start', gap: 4,
    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
    transition: 'all 0.3s ease',
    minWidth: 280,
  },
  close: {
    background: 'none', border: 'none', color: '#8b949e',
    fontSize: 18, lineHeight: 1, cursor: 'pointer', padding: '0 0 0 8px',
  },
};
