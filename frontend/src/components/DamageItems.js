import LoadingSpinner from './LoadingSpinner';
import React, { useState, useEffect } from 'react';
import { damageItemsAPI, productAPI } from '../services/api';
import './AdminPanel.css';
import { AlertTriangle, Plus } from 'lucide-react';

function DamageItems() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fromDate, setFromDate] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10));
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));
  const [form, setForm] = useState({
    product_id: '', quantity: '', reason: '', date: new Date().toISOString().slice(0, 10),
  });

  useEffect(() => { load(); loadProducts(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [fromDate, toDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = async () => {
    setLoading(true);
    try {
      const d = await damageItemsAPI.list({ from_date: fromDate, to_date: toDate });
      setData(d);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const loadProducts = async () => {
    try {
      const d = await productAPI.getAll();
      const list = Array.isArray(d) ? d : (d?.data || d?.items || []);
      setProducts(list.filter(p => p.is_active !== false));
    } catch (e) { console.error(e); }
  };

  const fmt = (v) => (Number(v) || 0).toFixed(3);

  const openCreate = () => {
    setForm({ product_id: '', quantity: '', reason: '', date: new Date().toISOString().slice(0, 10) });
    setShowModal(true);
  };

  const save = async () => {
    if (!form.product_id || !form.quantity || Number(form.quantity) <= 0) {
      alert('Product and quantity are required');
      return;
    }
    setSaving(true);
    try {
      await damageItemsAPI.create({
        ...form,
        product_id: parseInt(form.product_id),
        quantity: parseFloat(form.quantity),
      });
      setShowModal(false);
      load();
    } catch (e) {
      alert(e.response?.data?.detail || 'Error recording damage');
    }
    finally { setSaving(false); }
  };

  return (
    <div className="admin-container">
      <div className="page-header">
        <div className="header-content">
          <div className="header-icon" style={{ background: '#fef2f2', color: '#dc2626' }}><AlertTriangle size={20} /></div>
          <div><h1>Damage Items</h1><p>Track damaged and written-off goods</p></div>
        </div>
        <button className="action-btn primary" onClick={openCreate} style={{ background: '#dc2626' }}>
          <Plus size={14} /> Record Damage
        </button>
      </div>

      <div className="filter-bar" style={{ marginBottom: 16 }}>
        <label>From:</label>
        <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="filter-input" />
        <label>To:</label>
        <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="filter-input" />
        <button className="action-btn primary" onClick={load}>Refresh</button>
      </div>

      {loading ? <LoadingSpinner text="Loading damage records..." /> : !data ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>No data available</div>
      ) : (
        <>
          {/* KPI Cards */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            <div style={{ padding: '12px 20px', background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca', flex: 1, minWidth: 160 }}>
              <div style={{ fontSize: 11, color: '#dc2626', fontWeight: 600 }}>Total Items Damaged</div>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--ds-font-mono)', color: '#991b1b' }}>{data.total} records</div>
              <div style={{ fontSize: 11, color: '#6b7280' }}>Qty: {fmt(data.total_qty)}</div>
            </div>
            <div style={{ padding: '12px 20px', background: '#fff7ed', borderRadius: 8, border: '1px solid #fed7aa', flex: 1, minWidth: 160 }}>
              <div style={{ fontSize: 11, color: '#c2410c', fontWeight: 600 }}>Total Value Lost</div>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--ds-font-mono)', color: '#9a3412' }}>{fmt(data.total_value)} OMR</div>
            </div>
          </div>

          {/* Table */}
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th><th>Date</th><th>Product</th><th>SKU</th><th>Warehouse</th>
                  <th style={{ textAlign: 'right' }}>Qty</th>
                  <th style={{ textAlign: 'right' }}>Value</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {data.items?.length === 0 ? (
                  <tr><td colSpan="8" className="no-data">No damage records for this period</td></tr>
                ) : data.items?.map((r, i) => (
                  <tr key={r.id || i}>
                    <td>{i + 1}</td>
                    <td>{String(r.date).slice(0, 10)}</td>
                    <td style={{ fontWeight: 500 }}>{r.product_name}</td>
                    <td style={{ fontFamily: 'var(--ds-font-mono)', fontSize: 11 }}>{r.sku}</td>
                    <td style={{ color: '#6b7280', fontSize: 12 }}>{r.warehouse_name || '—'}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)', color: '#dc2626', fontWeight: 600 }}>{fmt(r.quantity)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)' }}>{fmt(r.total_value)}</td>
                    <td style={{ color: '#6b7280', fontSize: 12, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.reason || '—'}</td>
                  </tr>
                ))}
                {data.items?.length > 0 && (
                  <tr style={{ fontWeight: 700, background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
                    <td colSpan="5" style={{ textAlign: 'right' }}>Totals:</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)', color: '#dc2626' }}>{fmt(data.total_qty)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)' }}>{fmt(data.total_value)}</td>
                    <td></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Record Damage Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 440, maxWidth: '90vw' }}>
            <h3 style={{ margin: '0 0 16px', color: '#dc2626' }}>Record Damage</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Product *</label>
                <select value={form.product_id} onChange={e => setForm({ ...form, product_id: e.target.value })}
                  className="filter-input" style={{ width: '100%' }}>
                  <option value="">-- Select Product --</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Quantity *</label>
                <input type="number" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })}
                  className="filter-input" style={{ width: '100%' }} placeholder="0" min="0" step="0.001" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Date</label>
                <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                  className="filter-input" style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Reason</label>
                <textarea value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })}
                  className="filter-input" style={{ width: '100%', minHeight: 60 }} placeholder="Describe the damage..." />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <button className="action-btn" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="action-btn primary" onClick={save} disabled={saving}
                style={{ background: '#dc2626' }}>
                {saving ? 'Saving...' : 'Record Damage'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DamageItems;
