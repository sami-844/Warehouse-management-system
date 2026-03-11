import LoadingSpinner from './LoadingSpinner';
import React, { useState, useEffect } from 'react';
import { brandAPI } from '../services/api';
import './AdminPanel.css';
import { Tag, Plus, Edit2, Trash2 } from 'lucide-react';

function ProductBrands() {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', status: 'active' });

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const d = await brandAPI.list();
      setBrands(d?.brands || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', status: 'active' });
    setShowModal(true);
  };

  const openEdit = (b) => {
    setEditing(b);
    setForm({ name: b.name, status: b.status || 'active' });
    setShowModal(true);
  };

  const save = async () => {
    if (!form.name.trim()) return;
    try {
      if (editing) {
        await brandAPI.update(editing.id, form);
      } else {
        await brandAPI.create(form);
      }
      setShowModal(false);
      load();
    } catch (e) {
      alert(e.response?.data?.detail || 'Error saving brand');
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Deactivate this brand?')) return;
    try {
      await brandAPI.remove(id);
      load();
    } catch (e) {
      alert(e.response?.data?.detail || 'Error');
    }
  };

  const activeBrands = brands.filter(b => b.status === 'active').length;

  return (
    <div className="admin-container">
      <div className="page-header">
        <div className="header-content">
          <div className="header-icon"><Tag size={20} /></div>
          <div><h1>Product Brands</h1><p>Total Brands: {brands.length} ({activeBrands} active)</p></div>
        </div>
        <button className="action-btn primary" onClick={openCreate}>
          <Plus size={14} /> Brand
        </button>
      </div>

      {loading ? <LoadingSpinner text="Loading brands..." /> : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th><th>Name</th>
                <th style={{ textAlign: 'center' }}>Products</th>
                <th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {brands.length === 0 ? (
                <tr><td colSpan="5" className="no-data">No brands found</td></tr>
              ) : brands.map((b, i) => (
                <tr key={b.id}>
                  <td>{i + 1}</td>
                  <td style={{ fontWeight: 500 }}>{b.name}</td>
                  <td style={{ textAlign: 'center', fontFamily: 'var(--ds-font-mono)' }}>{b.product_count || 0}</td>
                  <td>
                    <span style={{
                      background: b.status === 'active' ? '#16a34a' : '#6b7280', color: '#fff',
                      padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                    }}>{b.status}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => openEdit(b)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6' }}><Edit2 size={14} /></button>
                      {b.status === 'active' && (
                        <button onClick={() => remove(b.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}><Trash2 size={14} /></button>
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
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 380, maxWidth: '90vw' }}>
            <h3 style={{ margin: '0 0 16px' }}>{editing ? 'Edit Brand' : 'New Brand'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Brand Name *</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  className="filter-input" style={{ width: '100%' }} placeholder="Brand name" />
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

export default ProductBrands;
