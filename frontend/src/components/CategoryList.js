import LoadingSpinner from './LoadingSpinner';
import React, { useState, useEffect } from 'react';
import { categoryAPI, productAPI } from '../services/api';
import './AdminPanel.css';
import { Layers, Plus, Edit2, Trash2 } from 'lucide-react';

function CategoryList() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', parent_id: null, is_active: true });
  const [productCounts, setProductCounts] = useState({});

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const d = await categoryAPI.getAll();
      const list = Array.isArray(d) ? d : (d?.data || d?.items || []);
      setCategories(list);

      // Get product counts per category
      const prods = await productAPI.getAll();
      const prodList = Array.isArray(prods) ? prods : (prods?.data || prods?.items || []);
      const counts = {};
      prodList.forEach(p => {
        if (p.category_id) counts[p.category_id] = (counts[p.category_id] || 0) + 1;
      });
      setProductCounts(counts);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const openCreate = (parentId = null) => {
    setEditing(null);
    setForm({ name: '', description: '', parent_id: parentId, is_active: true });
    setShowModal(true);
  };

  const openEdit = (cat) => {
    setEditing(cat);
    setForm({ name: cat.name, description: cat.description || '', parent_id: cat.parent_id || null, is_active: cat.is_active !== false });
    setShowModal(true);
  };

  const save = async () => {
    if (!form.name.trim()) return;
    try {
      if (editing) {
        await categoryAPI.update(editing.id, form);
      } else {
        await categoryAPI.create(form);
      }
      setShowModal(false);
      load();
    } catch (e) {
      alert(e.response?.data?.detail || 'Error saving category');
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Deactivate this category?')) return;
    try {
      await categoryAPI.delete(id);
      load();
    } catch (e) {
      alert(e.response?.data?.detail || 'Error deleting category');
    }
  };

  const parents = categories.filter(c => !c.parent_id && c.is_active !== false);

  // Build sorted list: parent, then children indented
  const sortedList = [];
  parents.forEach(p => {
    sortedList.push({ ...p, isParent: true });
    categories.filter(c => c.parent_id === p.id).forEach(c => {
      sortedList.push({ ...c, isParent: false });
    });
  });
  // Orphan categories (no parent, no children)
  categories.filter(c => c.parent_id && !categories.find(p => p.id === c.parent_id)).forEach(c => {
    sortedList.push({ ...c, isParent: false });
  });

  return (
    <div className="admin-container">
      <div className="page-header">
        <div className="header-content">
          <div className="header-icon"><Layers size={20} /></div>
          <div><h1>Product Categories</h1><p>Manage categories and sub-categories</p></div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="action-btn primary" onClick={() => openCreate(null)}>
            <Plus size={14} /> Category
          </button>
          <button className="action-btn" onClick={() => openCreate(null)} style={{ background: '#7c3aed', color: '#fff' }}>
            <Plus size={14} /> Sub-Category
          </button>
        </div>
      </div>

      {loading ? <LoadingSpinner text="Loading categories..." /> : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th><th>Name</th><th>Parent</th><th>Description</th>
                <th style={{ textAlign: 'center' }}>Products</th>
                <th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedList.length === 0 ? (
                <tr><td colSpan="7" className="no-data">No categories found</td></tr>
              ) : sortedList.map((c, i) => (
                <tr key={c.id} style={{ background: c.isParent ? '#f8fafc' : '#fff' }}>
                  <td>{i + 1}</td>
                  <td style={{ fontWeight: c.isParent ? 600 : 400 }}>
                    {!c.isParent && <span style={{ color: '#9ca3af', marginRight: 6 }}>─</span>}
                    {c.name}
                  </td>
                  <td style={{ color: '#6b7280', fontSize: 12 }}>
                    {c.parent_id ? categories.find(p => p.id === c.parent_id)?.name || '' : '—'}
                  </td>
                  <td style={{ color: '#6b7280', fontSize: 12 }}>{c.description || ''}</td>
                  <td style={{ textAlign: 'center', fontFamily: 'var(--ds-font-mono)' }}>
                    {productCounts[c.id] || 0}
                  </td>
                  <td>
                    <span style={{
                      background: c.is_active !== false ? '#16a34a' : '#6b7280', color: '#fff',
                      padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                    }}>{c.is_active !== false ? 'ACTIVE' : 'INACTIVE'}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => openEdit(c)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6' }}><Edit2 size={14} /></button>
                      <button onClick={() => remove(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 420, maxWidth: '90vw' }}>
            <h3 style={{ margin: '0 0 16px' }}>{editing ? 'Edit Category' : 'New Category'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Name *</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  className="filter-input" style={{ width: '100%' }} placeholder="Category name" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Parent Category</label>
                <select value={form.parent_id || ''} onChange={e => setForm({ ...form, parent_id: e.target.value ? parseInt(e.target.value) : null })}
                  className="filter-input" style={{ width: '100%' }}>
                  <option value="">— None (Top Level) —</option>
                  {parents.filter(p => !editing || p.id !== editing.id).map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Description</label>
                <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  className="filter-input" style={{ width: '100%' }} placeholder="Optional description" />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} />
                <label style={{ fontSize: 13 }}>Active</label>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <button className="action-btn" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="action-btn primary" onClick={save}>
                {editing ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CategoryList;
