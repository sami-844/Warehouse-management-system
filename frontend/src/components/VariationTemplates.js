import LoadingSpinner from './LoadingSpinner';
import React, { useState, useEffect } from 'react';
import { variationAPI } from '../services/api';
import './AdminPanel.css';
import { Sliders, Plus, Edit2, Trash2, X } from 'lucide-react';

function VariationTemplates() {
  const [variations, setVariations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', values: [], status: 'active' });
  const [tagInput, setTagInput] = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const d = await variationAPI.list();
      setVariations(d?.variations || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', values: [], status: 'active' });
    setTagInput('');
    setShowModal(true);
  };

  const openEdit = (v) => {
    setEditing(v);
    setForm({ name: v.name, values: [...(v.values || [])], status: v.status || 'active' });
    setTagInput('');
    setShowModal(true);
  };

  const addTag = () => {
    const val = tagInput.trim();
    if (val && !form.values.includes(val)) {
      setForm({ ...form, values: [...form.values, val] });
    }
    setTagInput('');
  };

  const removeTag = (idx) => {
    setForm({ ...form, values: form.values.filter((_, i) => i !== idx) });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addTag(); }
  };

  const save = async () => {
    if (!form.name.trim()) return;
    try {
      if (editing) {
        await variationAPI.update(editing.id, form);
      } else {
        await variationAPI.create(form);
      }
      setShowModal(false);
      load();
    } catch (e) {
      alert(e.response?.data?.detail || 'Error saving variation');
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Deactivate this variation?')) return;
    try {
      await variationAPI.remove(id);
      load();
    } catch (e) {
      alert(e.response?.data?.detail || 'Error');
    }
  };

  const pillColors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#06b6d4', '#6366f1'];

  return (
    <div className="admin-container">
      <div className="page-header">
        <div className="header-content">
          <div className="header-icon"><Sliders size={20} /></div>
          <div><h1>Variation Templates</h1><p>Manage product variation types (Size, Color, Flavor, etc.)</p></div>
        </div>
        <button className="action-btn primary" onClick={openCreate}>
          <Plus size={14} /> Add Variation
        </button>
      </div>

      {loading ? <LoadingSpinner text="Loading variations..." /> : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th><th>Name</th><th>Values</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {variations.length === 0 ? (
                <tr><td colSpan="5" className="no-data">No variations found</td></tr>
              ) : variations.map((v, i) => (
                <tr key={v.id}>
                  <td>{i + 1}</td>
                  <td style={{ fontWeight: 500 }}>{v.name}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {(v.values || []).map((val, vi) => (
                        <span key={vi} style={{
                          background: pillColors[vi % pillColors.length], color: '#fff',
                          padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                        }}>{val}</span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <span style={{
                      background: v.status === 'active' ? '#16a34a' : '#6b7280', color: '#fff',
                      padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                    }}>{v.status}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => openEdit(v)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6' }}><Edit2 size={14} /></button>
                      {v.status === 'active' && (
                        <button onClick={() => remove(v.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}><Trash2 size={14} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 440, maxWidth: '90vw' }}>
            <h3 style={{ margin: '0 0 16px' }}>{editing ? 'Edit Variation' : 'New Variation'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Template Name *</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  className="filter-input" style={{ width: '100%' }} placeholder="e.g. Size, Color, Flavor" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Values (type + Enter to add)</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={handleKeyDown}
                    className="filter-input" style={{ flex: 1 }} placeholder="e.g. Small, Medium, Large" />
                  <button className="action-btn primary" onClick={addTag} style={{ padding: '6px 12px' }}>Add</button>
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
                  {form.values.map((val, vi) => (
                    <span key={vi} style={{
                      background: pillColors[vi % pillColors.length], color: '#fff',
                      padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                      {val}
                      <X size={12} style={{ cursor: 'pointer' }} onClick={() => removeTag(vi)} />
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Status</label>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                  className="filter-input" style={{ width: '100%' }}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <button className="action-btn" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="action-btn primary" onClick={save}>{editing ? 'Update' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default VariationTemplates;
