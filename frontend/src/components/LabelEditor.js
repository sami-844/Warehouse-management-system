import React, { useState, useEffect } from 'react';
import { labelAPI } from '../services/api';
import { loadLabels } from '../utils/labels';
import { PERMISSIONS } from '../constants/permissions';
import { Tag, RotateCcw, Save, Search } from 'lucide-react';

const GROUP_ORDER = ['navigation'];
const GROUP_DISPLAY = { navigation: 'Navigation Labels' };

const _role = (localStorage.getItem('userRole') || '').toLowerCase();
const _perms = (() => { try { return JSON.parse(localStorage.getItem('userPermissions') || '[]'); } catch { return []; } })();
const can = (perm) => _role === 'admin' || _perms.includes(perm);

function LabelEditor() {
  const [labels, setLabels] = useState([]);
  const [edits, setEdits] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});
  const [search, setSearch] = useState('');
  const [msg, setMsg] = useState('');
  const canEdit = can(PERMISSIONS.ADMIN.RENAME_LABELS);

  const fetchLabels = async () => {
    setLoading(true);
    try {
      const data = await labelAPI.getAll();
      const arr = Array.isArray(data) ? data : (data?.items || []);
      setLabels(arr);
    } catch (e) {
      console.error('Failed to load labels', e);
    }
    setLoading(false);
  };

  useEffect(() => { fetchLabels(); }, []);

  const handleEdit = (id, value) => {
    setEdits(prev => ({ ...prev, [id]: value }));
  };

  const handleSave = async (lbl) => {
    const newValue = (edits[lbl.id] ?? lbl.value).trim();
    if (!newValue) return;
    setSaving(prev => ({ ...prev, [lbl.id]: true }));
    try {
      await labelAPI.update(lbl.id, newValue);
      setLabels(prev => prev.map(l => l.id === lbl.id ? { ...l, value: newValue } : l));
      setEdits(prev => { const n = { ...prev }; delete n[lbl.id]; return n; });
      await loadLabels();
      flash('Saved');
    } catch (e) {
      flash('Save failed');
    }
    setSaving(prev => ({ ...prev, [lbl.id]: false }));
  };

  const handleResetAll = async () => {
    if (!window.confirm('Reset ALL labels to their defaults? This cannot be undone.')) return;
    try {
      await labelAPI.resetAll();
      await fetchLabels();
      await loadLabels();
      setEdits({});
      flash('All labels reset to defaults');
    } catch (e) {
      flash('Reset failed');
    }
  };

  const flash = (text) => { setMsg(text); setTimeout(() => setMsg(''), 2500); };

  const filtered = labels.filter(l => {
    if (!search) return true;
    const s = search.toLowerCase();
    return l.key.toLowerCase().includes(s) || l.value.toLowerCase().includes(s) || l.default.toLowerCase().includes(s);
  });

  const grouped = {};
  filtered.forEach(l => {
    const g = l.group || 'other';
    if (!grouped[g]) grouped[g] = [];
    grouped[g].push(l);
  });

  const sortedGroups = Object.keys(grouped).sort((a, b) => {
    const ai = GROUP_ORDER.indexOf(a);
    const bi = GROUP_ORDER.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Loading labels...</div>
    );
  }

  return (
    <div style={{ padding: '24px 28px', maxWidth: 960 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="header-icon" style={{ width: 36, height: 36, background: '#EEF2FF', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Tag size={18} color="#4F46E5" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1a2332' }}>Label Editor</h2>
            <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>Rename navigation items and page titles</p>
          </div>
        </div>
        {canEdit && (
          <button onClick={handleResetAll} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
            background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6,
            color: '#64748b', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>
            <RotateCcw size={14} /> Reset All to Defaults
          </button>
        )}
      </div>

      {/* Toast */}
      {msg && (
        <div style={{
          position: 'fixed', top: 20, right: 20, background: '#16a34a', color: '#fff',
          padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, zIndex: 999,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}>{msg}</div>
      )}

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 20, maxWidth: 360 }}>
        <Search size={15} style={{ position: 'absolute', left: 10, top: 10, color: '#94a3b8' }} />
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search labels..."
          style={{
            width: '100%', padding: '9px 12px 9px 32px', border: '1px solid #e2e8f0',
            borderRadius: 6, fontSize: 13, outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Groups */}
      {sortedGroups.map(group => (
        <div key={group} style={{ marginBottom: 28 }}>
          <h3 style={{
            fontSize: 13, fontWeight: 700, color: '#475569', textTransform: 'uppercase',
            letterSpacing: '0.05em', marginBottom: 10, paddingBottom: 6, borderBottom: '2px solid #e2e8f0',
          }}>
            {GROUP_DISPLAY[group] || group}
          </h3>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ ...th, width: '30%' }}>Key</th>
                <th style={{ ...th, width: '25%' }}>Default</th>
                <th style={{ ...th, width: '30%' }}>Current Value</th>
                <th style={{ ...th, width: '15%', textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {grouped[group].map(lbl => {
                const editVal = edits[lbl.id];
                const isDirty = editVal !== undefined && editVal !== lbl.value;
                const isCustom = lbl.value !== lbl.default;
                return (
                  <tr key={lbl.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ ...td, color: '#64748b', fontFamily: 'monospace', fontSize: 12 }}>
                      {lbl.key}
                    </td>
                    <td style={{ ...td, color: '#94a3b8' }}>{lbl.default}</td>
                    <td style={td}>
                      <input
                        value={editVal ?? lbl.value}
                        onChange={e => canEdit && handleEdit(lbl.id, e.target.value)}
                        onKeyDown={e => { if (canEdit && e.key === 'Enter') handleSave(lbl); }}
                        readOnly={!canEdit}
                        style={{
                          width: '100%', padding: '6px 8px', border: '1px solid',
                          borderColor: isDirty ? '#3b82f6' : (isCustom ? '#f59e0b' : '#e2e8f0'),
                          borderRadius: 4, fontSize: 13, outline: 'none', boxSizing: 'border-box',
                          background: !canEdit ? '#f8fafc' : (isCustom && !isDirty ? '#FFFBEB' : '#fff'),
                          cursor: canEdit ? 'text' : 'default',
                        }}
                      />
                    </td>
                    <td style={{ ...td, textAlign: 'center' }}>
                      {isDirty && (
                        <button
                          onClick={() => handleSave(lbl)}
                          disabled={saving[lbl.id]}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '5px 12px', background: '#3b82f6', color: '#fff',
                            border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600,
                            cursor: saving[lbl.id] ? 'not-allowed' : 'pointer',
                            opacity: saving[lbl.id] ? 0.6 : 1,
                          }}
                        >
                          <Save size={12} /> Save
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', color: '#94a3b8', padding: 40 }}>
          No labels match your search.
        </div>
      )}
    </div>
  );
}

const th = {
  padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#475569',
  fontSize: 12, borderBottom: '1px solid #e2e8f0',
};
const td = { padding: '8px 10px', verticalAlign: 'middle' };

export default LabelEditor;
