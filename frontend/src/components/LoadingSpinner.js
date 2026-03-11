import React from 'react';

const spinnerKeyframes = `
@keyframes wms-spin {
  to { transform: rotate(360deg); }
}
`;

function LoadingSpinner({ text = 'Loading...', size = 36, color = '#16a34a', rows = 5 }) {
  return (
    <div className="loading-state" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', gap: 12 }}>
      <style>{spinnerKeyframes}</style>
      <div style={{
        width: size, height: size,
        border: `3px solid #e2e8f0`,
        borderTopColor: color,
        borderRadius: '50%',
        animation: 'wms-spin 0.7s linear infinite',
      }} />
      {text && <div style={{ color: '#64748b', fontSize: 13, fontFamily: 'Figtree, sans-serif', fontWeight: 500 }}>{text}</div>}
      <div style={{ width: '100%', maxWidth: 800, marginTop: 16 }}>
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="wms-shimmer" style={{ height: 40, marginBottom: 8, opacity: 1 - i * 0.12 }} />
        ))}
      </div>
    </div>
  );
}

export default LoadingSpinner;
