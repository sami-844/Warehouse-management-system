import LoadingSpinner from './LoadingSpinner';
import React, { useState, useEffect, useCallback } from 'react';
import { returnsAPI, customerAPI, productAPI } from '../services/api';
import './Sales.css';
import { RotateCcw } from 'lucide-react';

function ReturnsManager() {
  const [activeTab, setActiveTab] = useState('returns');
  const [returns, setReturns] = useState([]);
  const [creditNotes, setCreditNotes] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [, setSelectedReturn] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Create form state
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [formCustomerId, setFormCustomerId] = useState('');
  const [formReason, setFormReason] = useState('');
  const [formType, setFormType] = useState('credit');
  const [formItems, setFormItems] = useState([{ product_id: '', quantity: 1, unit_price: 0, reason: '', condition: 'good', restock: true }]);

  const loadData = useCallback(() => {
    setLoading(true);
    Promise.all([
      returnsAPI.listReturns(),
      returnsAPI.listCreditNotes(),
      returnsAPI.summary(),
    ]).then(([retRes, cnRes, sumRes]) => {
      setReturns(retRes.returns || []);
      setCreditNotes(cnRes.credit_notes || []);
      setSummary(sumRes);
      setLoading(false);
    }).catch(() => { setError('Failed to load'); setLoading(false); });
  }, []);

  useEffect(() => {
    loadData();
    customerAPI.list({ limit: 500 }).then(r => setCustomers(Array.isArray(r) ? r : r.customers || [])).catch(() => {});
    productAPI.getAll({ limit: 500 }).then(r => setProducts(Array.isArray(r?.data) ? r.data : (r?.data?.products || []))).catch(() => {});
  }, [loadData]);

  // ── Create Return ──
  const addItem = () => setFormItems([...formItems, { product_id: '', quantity: 1, unit_price: 0, reason: '', condition: 'good', restock: true }]);
  const removeItem = (idx) => setFormItems(formItems.filter((_, i) => i !== idx));
  const updateItem = (idx, field, val) => {
    const updated = [...formItems];
    updated[idx][field] = val;
    setFormItems(updated);
  };

  const submitReturn = () => {
    if (!formCustomerId) { setError('Select a customer'); return; }
    const validItems = formItems.filter(i => i.product_id && i.quantity > 0);
    if (validItems.length === 0) { setError('Add at least one item'); return; }

    setError(''); setSuccess('');
    returnsAPI.createReturn({
      customer_id: parseInt(formCustomerId),
      return_type: formType,
      reason: formReason,
      items: validItems.map(i => ({ ...i, product_id: parseInt(i.product_id), quantity: parseFloat(i.quantity), unit_price: parseFloat(i.unit_price || 0) })),
    }).then(res => {
      setSuccess(res.message);
      setShowCreateForm(false);
      setFormCustomerId(''); setFormReason(''); setFormType('credit');
      setFormItems([{ product_id: '', quantity: 1, unit_price: 0, reason: '', condition: 'good', restock: true }]);
      loadData();
    }).catch(e => setError(e.response?.data?.detail || 'Failed to create return'));
  };

  // ── Process / Reject Return ──
  const processReturn = (id) => {
    if (!window.confirm('Process this return? Items will be restocked and a credit note generated.')) return;
    returnsAPI.processReturn(id)
      .then(res => { setSuccess(res.message); loadData(); setSelectedReturn(null); })
      .catch(e => setError(e.response?.data?.detail || 'Failed'));
  };

  const rejectReturn = (id) => {
    const reason = window.prompt('Rejection reason:');
    if (reason === null) return;
    returnsAPI.rejectReturn(id, reason)
      .then(() => { setSuccess('Return rejected'); loadData(); setSelectedReturn(null); })
      .catch(e => setError(e.response?.data?.detail || 'Failed'));
  };

  const fmt = (n) => Number(n || 0).toFixed(3);
  const statusColor = (s) => ({ pending: '#e67e22', processed: '#27ae60', rejected: '#c0392b', issued: '#3498db', applied: '#27ae60' }[s] || '#888');

  return (
    <div className="sales-container">
      <div className="page-header">
        <div className="header-content">
          <div className="header-icon returns"><RotateCcw size={20} /></div>
          <div><h1>Returns & Credit Notes</h1><p>Handle customer returns, restocking, and credit notes</p></div>
        </div>
        <button className="action-btn primary" onClick={() => setShowCreateForm(true)}>+ New Return</button>
      </div>

      {error && <div className="message error">{error} <button onClick={() => setError('')} className="edit-btn" style={{ float: 'right' }}>✕</button></div>}
      {success && <div className="message success">{success}</div>}

      {/* Summary Cards */}
      {summary && (
        <div className="so-summary-cards">
          <SCard label="Pending Returns" value={summary.pending_returns} sub={`OMR ${fmt(summary.pending_value)}`} color="#e67e22" />
          <SCard label="Processed" value={summary.processed_returns} sub={`OMR ${fmt(summary.processed_value)}`} color="#27ae60" />
          <SCard label="Open Credit Notes" value={summary.open_credit_notes} sub={`OMR ${fmt(summary.open_credit_value)}`} color="#3498db" />
        </div>
      )}

      {/* Tabs */}
      <div className="tab-bar">
        {[{ id: 'returns', label: 'Returns' }, { id: 'credits', label: 'Credit Notes' }].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} className={`tab-btn ${activeTab === t.id ? 'active' : ''}`}>{t.label}</button>
        ))}
      </div>

      {/* Create Return Form */}
      {showCreateForm && (
        <div className="form-card">
          <h3>New Return</h3>
          <div className="form-row-3">
            <div className="form-group">
              <label>Customer *</label>
              <select value={formCustomerId} onChange={e => setFormCustomerId(e.target.value)}>
                <option value="">Select...</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Type</label>
              <select value={formType} onChange={e => setFormType(e.target.value)}>
                <option value="credit">Credit Note</option>
                <option value="refund">Refund</option>
                <option value="replacement">Replacement</option>
              </select>
            </div>
            <div className="form-group">
              <label>Reason</label>
              <input value={formReason} onChange={e => setFormReason(e.target.value)} placeholder="Reason for return" />
            </div>
          </div>

          <div className="line-items-section">
            <h4>Return Items</h4>
            {formItems.map((item, idx) => (
              <div key={idx} className="add-item-row">
                <select value={item.product_id} onChange={e => updateItem(idx, 'product_id', e.target.value)} style={{ minWidth: 200 }}>
                  <option value="">Product *</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                </select>
                <input type="number" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} min="0.001" step="0.001" placeholder="Qty" style={{ width: 80 }} />
                <input type="number" value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', e.target.value)} min="0" step="0.001" placeholder="Price" style={{ width: 90 }} />
                <select value={item.condition} onChange={e => updateItem(idx, 'condition', e.target.value)} style={{ width: 110 }}>
                  <option value="good">Good</option>
                  <option value="damaged">Damaged</option>
                  <option value="expired">Expired</option>
                </select>
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--ds-text-sm)', whiteSpace: 'nowrap' }}>
                  <input type="checkbox" checked={item.restock} onChange={e => updateItem(idx, 'restock', e.target.checked)} /> Restock
                </label>
                <button onClick={() => removeItem(idx)} className="remove-btn">✕</button>
              </div>
            ))}
            <button onClick={addItem} className="action-btn" style={{ marginTop: 'var(--ds-sp-2)' }}>+ Add Item</button>
          </div>

          <div style={{ display: 'flex', gap: 'var(--ds-sp-3)', marginTop: 'var(--ds-sp-4)' }}>
            <button onClick={submitReturn} className="action-btn primary">Create Return</button>
            <button onClick={() => setShowCreateForm(false)} className="cancel-btn">Cancel</button>
          </div>
        </div>
      )}

      {/* Returns Table */}
      {activeTab === 'returns' && (
        loading ? <LoadingSpinner /> : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Return #</th><th>Date</th><th>Customer</th>
                  <th>Type</th><th>Items</th><th>Amount</th>
                  <th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {returns.length === 0 ? (
                  <tr><td colSpan={8} className="no-data">No returns yet</td></tr>
                ) : returns.map(r => (
                  <tr key={r.id}>
                    <td className="code">{r.return_number}</td>
                    <td>{r.return_date}</td>
                    <td>{r.customer_name}</td>
                    <td>{r.return_type}</td>
                    <td className="center">{r.item_count}</td>
                    <td className="value">{fmt(r.total_amount)}</td>
                    <td><span className="status-pill" style={{ background: statusColor(r.status) }}>{r.status}</span></td>
                    <td>
                      {r.status === 'pending' && (
                        <div className="action-cell">
                          <button onClick={() => processReturn(r.id)} className="complete-btn small">Process</button>
                          <button onClick={() => rejectReturn(r.id)} className="remove-btn">✕ Reject</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Credit Notes Table */}
      {activeTab === 'credits' && (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>CN #</th><th>Date</th><th>Customer</th>
                <th>Return #</th><th>Amount</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {creditNotes.length === 0 ? (
                <tr><td colSpan={6} className="no-data">No credit notes yet</td></tr>
              ) : creditNotes.map(cn => (
                <tr key={cn.id}>
                  <td className="code">{cn.credit_note_number}</td>
                  <td>{cn.issue_date}</td>
                  <td>{cn.customer_name}</td>
                  <td className="code">{cn.return_number || '—'}</td>
                  <td className="value">{fmt(cn.total_amount)}</td>
                  <td><span className="status-pill" style={{ background: statusColor(cn.status) }}>{cn.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SCard({ label, value, sub, color }) {
  return (
    <div className="summary-card" style={{ borderLeft: `4px solid ${color}` }}>
      <div className="sc-label">{label}</div>
      <div className="sc-value" style={{ color }}>{value}</div>
      <div style={{ fontSize: 'var(--ds-text-xs)', color: 'var(--ds-text-muted)', marginTop: 'var(--ds-sp-1)' }}>{sub}</div>
    </div>
  );
}

export default ReturnsManager;
