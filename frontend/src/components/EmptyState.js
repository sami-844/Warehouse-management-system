import React from 'react';

function EmptyState({ title = 'No items found', hint = '', colSpan }) {
  const content = (
    <div style={{ textAlign: 'center', padding: 60, color: '#ADB5BD' }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: '#6C757D' }}>{title}</div>
      {hint && <div style={{ fontSize: 13, marginTop: 4, color: '#ADB5BD' }}>{hint}</div>}
    </div>
  );
  if (colSpan) return <tr><td colSpan={colSpan}>{content}</td></tr>;
  return content;
}

export default EmptyState;
