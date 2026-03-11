import LoadingSpinner from './LoadingSpinner';
import React, { useState, useEffect, useCallback } from 'react';
import { purchaseReturnsAPI, supplierAPI, productAPI } from '../services/api';
import './Sales.css';
import { RotateCcw } from 'lucide-react';

function PurchaseReturnList() {
  const [activeTab, setActiveTab] = useState('returns');
  const [returns, setReturns] = useState([]);
  const [debitNotes, setDebitNotes] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Create form state
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [formSupplierId, setFormSupplierId] = useState('');
  const [formReason, setFormReason] = useState('');
  const [formItems, setFormItems] = useState([{ product_id: '', quantity: 1, unit_price: 0, condition: 'good' }]);

  const loadData = useCallback(() => {
    setLoading(true);
    Promise.all([
      purchaseReturnsAPI.list(),
      purchaseReturnsAPI.listDebitNotes(),
      purchaseReturnsAPI.summary(),
    ]).then(([retRes, dnRes, sumRes]) => {
      setReturns(retRes.returns || []);
      setDebitNotes(dnRes.debit_notes || []);
      setSummary(sumRes);
      setLoading(false);
    }).catch(() => { setError('Failed to load'); setLoading(false); });
  }, []);

  useEffect(() => {
    loadData();
    supplierAPI.list({ limit: 500 }).then(r => setSuppliers(Array.isArray(r) ? r : r.suppliers || [])).catch(() => {});
    productAPI.getAll({ limit: 500 }).then(r => setProducts(Array.isArray(r?.data) ? r.data : (r?.data?.products || []))).catch(() => {});
  }, [loadData]);

  // ── Create Return ──
  const addItem = () => setFormItems([...formItems, { product_id: '', quantity: 1, unit_price: 0, condition: 'good' }]);
  const removeItem = (idx) => setFormItems(formItems.filter((_, i) => i !== idx));
  const updateItem = (idx, field, val) => {
    const updated = [...formItems];
    updated[idx][field] = val;
    setFormItems(updated);
  };

  const submitReturn = () => {
    if (!formSupplierId) { setError('Select a supplier'); return; }
    const validItems = formItems.filter(i => i.product_id && i.quantity > 0);
    if (validItems.length === 0) { setError('Add at least one item'); return; }

    setError(''); setSuccess('');
    purchaseReturnsAPI.create({
      supplier_id: parseInt(formSupplierId),
      reason: formReason,
      items: validItems.map(i => ({ ...i, product_id: parseInt(i.product_id), quantity: parseFloat(i.quantity), unit_price: parseFloat(i.unit_price || 0) })),
    }).then(res => {
      setSuccess(res.message);
      setShowCreateForm(false);
      setFormSupplierId(''); setFormReason('');
      setFormItems([{ product_id: '', quantity: 1, unit_price: 0, condition: 'good' }]);
      loadData();
    }).catch(e => setError(e.response?.data?.detail || 'Failed to create purchase return'));
  };

  // ── Process / Reject Return ──
  const processReturn = (id) => {
    if (!window.confirm('Process this purchase return? Items will be de-stocked and a debit note generated.')) return;
    purchaseReturnsAPI.process(id)
      .then(res => { setSuccess(res.message); loadData(); })
      .catch(e => setError(e.response?.data?.detail || 'Failed'));
  };

  const rejectReturn = (id) => {
    const reason = window.prompt('Rejection reason:');
    if (reason === null) return;
    purchaseReturnsAPI.reject(id, reason)
      .then(() => { setSuccess('Purchase return rejected'); loadData(); })
      .catch(e => setError(e.response?.data?.detail || 'Failed'));
  };

  const fmt = (n) => Number(n || 0).toFixed(3);
  const statusColor = (s) => ({ pending: '#e67e22', processed: '#27ae60', rejected: '#c0392b', issued: '#3498db', applied: '#27ae60' }[s] || '#888');

  return (
    <div className="sales-container">
      <div className="page-header">
        <div className="header-content">
          <div className="header-icon returns"><RotateCcw size={20} /></div>
          <div><h1>Purchase Returns & Debit Notes</h1><p>Handle supplier returns, de-stocking, and debit notes</p></div>
        </div>
        <button className="action-btn primary" onClick={() => setShowCreateForm(true)}>+ New Purchase Return</button>
      </div>

      {error && <div className="message error">{error} <button onClick={() => setError('')} className="edit-btn" style={{ float: 'right' }}>x</button></div>}
      {success && <div className="message success">{success}</div>}

      {/* Summary Cards */}
      {summary && (
        <div className="so-summary-cards">
          <SCard label="Pending Returns" value={summary.pending_returns} sub={`OMR ${fmt(summary.pending_value)}`} color="#e67e22" />
          <SCard label="Processed" value={summary.processed_returns} sub={`OMR ${fmt(summary.processed_value)}`} color="#27ae60" />
          <SCard label="Open Debit Notes" value={summary.open_debit_notes} sub={`OMR ${fmt(summary.open_debit_value)}`} color="#3498db" />
        </div>
      )}

      {/* Tabs */}
      <div className="tab-bar">
        {[{ id: 'returns', label: 'Purchase Returns' }, { id: 'debits', label: 'Debit Notes' }].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} className={`tab-btn ${activeTab === t.id ? 'active' : ''}`}>{t.label}</button>
        ))}
      </div>

      {/* Create Return Form */}
      {showCreateForm && (
        <div className="form-card">
          <h3>New Purchase Return</h3>
          <div className="form-row-3">
            <div className="form-group">
              <label>Supplier *</label>
              <select value={formSupplierId} onChange={e => setFormSupplierId(e.target.value)}>
                <option value="">Select...</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
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
                <button onClick={() => removeItem(idx)} className="remove-btn">x</button>
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
                  <th>Return #</th><th>Date</th><th>Supplier</th>
                  <th>Items</th><th>Amount</th>
                  <th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {returns.length === 0 ? (
                  <tr><td colSpan={7} className="no-data">No purchase returns yet</td></tr>
                ) : returns.map(r => (
                  <tr key={r.id}>
                    <td className="code">{r.return_number}</td>
                    <td>{r.return_date}</td>
                    <td>{r.supplier_name}</td>
                    <td className="center">{r.item_count}</td>
                    <td className="value">{fmt(r.total_amount)}</td>
                    <td><span className="status-pill" style={{ background: statusColor(r.status) }}>{r.status}</span></td>
                    <td>
                      {r.status === 'pending' && (
                        <div className="action-cell">
                          <button onClick={() => processReturn(r.id)} className="complete-btn small">Process</button>
                          <button onClick={() => rejectReturn(r.id)} className="remove-btn">x Reject</button>
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

      {/* Debit Notes Table */}
      {activeTab === 'debits' && (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>DN #</th><th>Date</th><th>Supplier</th>
                <th>Return #</th><th>Amount</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {debitNotes.length === 0 ? (
                <tr><td colSpan={6} className="no-data">No debit notes yet</td></tr>
              ) : debitNotes.map(dn => (
                <tr key={dn.id}>
                  <td className="code">{dn.debit_note_number}</td>
                  <td>{dn.issue_date}</td>
                  <td>{dn.supplier_name}</td>
                  <td className="code">{dn.return_number || '--'}</td>
                  <td className="value">{fmt(dn.total_amount)}</td>
                  <td><span className="status-pill" style={{ background: statusColor(dn.status) }}>{dn.status}</span></td>
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

export default PurchaseReturnList;
