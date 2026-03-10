// Toast.js — Phase 15: Global toast notification system
import React, { useState, useEffect, useCallback } from 'react';

let _addToast = null;

export function showToast(message, type = 'info', duration = 3500) {
  if (_addToast) _addToast(message, type, duration);
}

const ICONS = { success: '✓', error: '✕', warning: '!', info: 'i' };
const BG = { success: '#16a34a', error: '#dc2626', warning: '#d97706', info: '#2563eb' };

export default function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 3500) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  useEffect(() => {
    _addToast = addToast;
    return () => { _addToast = null; };
  }, [addToast]);

  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      display: 'flex', flexDirection: 'column', gap: 10,
      maxWidth: 360,
    }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: BG[t.type] || BG.info,
          color: '#fff', borderRadius: 8,
          padding: '12px 16px', boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
          fontSize: 14, fontFamily: 'Figtree, Inter, sans-serif',
          animation: 'slideIn 0.2s ease',
        }}>
          <span style={{
            width: 20, height: 20, background: 'rgba(255,255,255,0.25)',
            borderRadius: '50%', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 12, fontWeight: 800, flexShrink: 0,
          }}>
            {ICONS[t.type] || 'i'}
          </span>
          <span style={{ flex: 1 }}>{t.message}</span>
          <button
            onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 0, flexShrink: 0 }}
          >
            ×
          </button>
        </div>
      ))}
      <style>{`@keyframes slideIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}
