import React, { useState, useEffect, useCallback } from 'react';
import { returnsAPI, customerAPI, productAPI, salesAPI } from '../services/api';

function ReturnsManager() {
  const [activeTab, setActiveTab] = useState('returns');
  const [returns, setReturns] = useState([]);
  const [creditNotes, setCreditNotes] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState(null);
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
    <div style={{ padding: '20px 24px', maxWidth: 1100, margin: '0 auto' }}>
      <h2 style={{ color: '#0d7a3e', marginBottom: 4 }}>🔄 Returns & Credit Notes</h2>
      <p style={{ color: '#666', fontSize: 13, marginBottom: 16 }}>Handle customer returns, restocking, and credit notes</p>

      {error && <div style={err}>{error} <button onClick={() => setError('')} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button></div>}
      {success && <div style={ok}>{success}</div>}

      {/* Summary */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 20 }}>
          <SCard label="Pending Returns" value={summary.pending_returns} sub={`OMR ${fmt(summary.pending_value)}`} color="#e67e22" />
          <SCard label="Processed" value={summary.processed_returns} sub={`OMR ${fmt(summary.processed_value)}`} color="#27ae60" />
          <SCard label="Open Credit Notes" value={summary.open_credit_notes} sub={`OMR ${fmt(summary.open_credit_value)}`} color="#3498db" />
        </div>
      )}

      {/* Tabs + Create Button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 2, borderBottom: '2px solid #e5e5e5' }}>
          {[{ id: 'returns', label: '🔄 Returns' }, { id: 'credits', label: '📄 Credit Notes' }].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
              padding: '9px 18px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: activeTab === t.id ? '#0d7a3e' : 'transparent',
              color: activeTab === t.id ? '#fff' : '#555', borderRadius: '8px 8px 0 0',
            }}>{t.label}</button>
          ))}
        </div>
        <button onClick={() => setShowCreateForm(true)} style={btnGreen}>+ New Return</button>
      </div>

      {/* ── Create Return Form ── */}
      {showCreateForm && (
        <div style={{ background: '#f8f8f8', borderRadius: 10, padding: 20, marginBottom: 20, border: '1px solid #e5e5e5' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: 15 }}>New Return</h3>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <div style={{ flex: '1 1 200px' }}>
              <label style={lbl}>Customer *</label>
              <select value={formCustomerId} onChange={e => setFormCustomerId(e.target.value)} style={inp}>
                <option value="">Select...</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div style={{ flex: '0 0 140px' }}>
              <label style={lbl}>Type</label>
              <select value={formType} onChange={e => setFormType(e.target.value)} style={inp}>
                <option value="credit">Credit Note</option>
                <option value="refund">Refund</option>
                <option value="replacement">Replacement</option>
              </select>
            </div>
            <div style={{ flex: '1 1 200px' }}>
              <label style={lbl}>Reason</label>
              <input value={formReason} onChange={e => setFormReason(e.target.value)} style={inp} placeholder="Reason for return" />
            </div>
          </div>

          <h4 style={{ fontSize: 13, marginBottom: 8 }}>Items</h4>
          {formItems.map((item, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 6, flexWrap: 'wrap', alignItems: 'end' }}>
              <div style={{ flex: '1 1 180px' }}>
                {idx === 0 && <label style={lbl}>Product *</label>}
                <select value={item.product_id} onChange={e => updateItem(idx, 'product_id', e.target.value)} style={inp}>
                  <option value="">Select...</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                </select>
              </div>
              <div style={{ flex: '0 0 80px' }}>
                {idx === 0 && <label style={lbl}>Qty</label>}
                <input type="number" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} style={inp} min="0.001" step="0.001" />
              </div>
              <div style={{ flex: '0 0 90px' }}>
                {idx === 0 && <label style={lbl}>Price</label>}
                <input type="number" value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', e.target.value)} style={inp} min="0" step="0.001" />
              </div>
              <div style={{ flex: '0 0 100px' }}>
                {idx === 0 && <label style={lbl}>Condition</label>}
                <select value={item.condition} onChange={e => updateItem(idx, 'condition', e.target.value)} style={inp}>
                  <option value="good">Good</option>
                  <option value="damaged">Damaged</option>
                  <option value="expired">Expired</option>
                </select>
              </div>
              <div style={{ flex: '0 0 70px' }}>
                {idx === 0 && <label style={lbl}>Restock</label>}
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, padding: '8px 0' }}>
                  <input type="checkbox" checked={item.restock} onChange={e => updateItem(idx, 'restock', e.target.checked)} /> Yes
                </label>
              </div>
              <button onClick={() => removeItem(idx)} style={{ background: '#e74c3c', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 12, alignSelf: 'end', marginBottom: 2 }}>✕</button>
            </div>
          ))}
          <button onClick={addItem} style={{ background: '#eee', border: 'none', padding: '6px 14px', borderRadius: 4, cursor: 'pointer', fontSize: 12, marginTop: 4 }}>+ Add Item</button>

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button onClick={submitReturn} style={btnGreen}>Create Return</button>
            <button onClick={() => setShowCreateForm(false)} style={{ ...btnGreen, background: '#888' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── Returns List ── */}
      {activeTab === 'returns' && (
        loading ? <div style={{ padding: 20, color: '#888' }}>Loading...</div> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={tbl}>
              <thead>
                <tr style={{ background: '#0d7a3e', color: '#fff' }}>
                  <th style={th}>Return #</th><th style={th}>Date</th><th style={th}>Customer</th>
                  <th style={th}>Type</th><th style={th}>Items</th><th style={{ ...th, textAlign: 'right' }}>Amount</th>
                  <th style={th}>Status</th><th style={th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {returns.length === 0 ? (
                  <tr><td colSpan={8} style={{ padding: 20, textAlign: 'center', color: '#888' }}>No returns yet</td></tr>
                ) : returns.map((r, i) => (
                  <tr key={r.id} style={{ background: i % 2 === 0 ? '#fff' : '#f9f9f9', borderBottom: '1px solid #eee' }}>
                    <td style={{ ...td, fontFamily: 'monospace', fontWeight: 600 }}>{r.return_number}</td>
                    <td style={td}>{r.return_date}</td>
                    <td style={td}>{r.customer_name}</td>
                    <td style={td}>{r.return_type}</td>
                    <td style={td}>{r.item_count}</td>
                    <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace' }}>{fmt(r.total_amount)}</td>
                    <td style={td}><span style={{ background: statusColor(r.status) + '20', color: statusColor(r.status), padding: '2px 10px', borderRadius: 10, fontSize: 11, fontWeight: 600 }}>{r.status}</span></td>
                    <td style={td}>
                      {r.status === 'pending' && (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => processReturn(r.id)} style={actionBtn}>✅ Process</button>
                          <button onClick={() => rejectReturn(r.id)} style={{ ...actionBtn, background: '#e74c3c' }}>✕ Reject</button>
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

      {/* ── Credit Notes List ── */}
      {activeTab === 'credits' && (
        <div style={{ overflowX: 'auto' }}>
          <table style={tbl}>
            <thead>
              <tr style={{ background: '#3498db', color: '#fff' }}>
                <th style={th}>CN #</th><th style={th}>Date</th><th style={th}>Customer</th>
                <th style={th}>Return #</th><th style={{ ...th, textAlign: 'right' }}>Amount</th>
                <th style={th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {creditNotes.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center', color: '#888' }}>No credit notes yet</td></tr>
              ) : creditNotes.map((cn, i) => (
                <tr key={cn.id} style={{ background: i % 2 === 0 ? '#fff' : '#f9f9f9', borderBottom: '1px solid #eee' }}>
                  <td style={{ ...td, fontFamily: 'monospace', fontWeight: 600 }}>{cn.credit_note_number}</td>
                  <td style={td}>{cn.issue_date}</td>
                  <td style={td}>{cn.customer_name}</td>
                  <td style={{ ...td, fontFamily: 'monospace' }}>{cn.return_number || '—'}</td>
                  <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{fmt(cn.total_amount)}</td>
                  <td style={td}><span style={{ background: statusColor(cn.status) + '20', color: statusColor(cn.status), padding: '2px 10px', borderRadius: 10, fontSize: 11, fontWeight: 600 }}>{cn.status}</span></td>
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
    <div style={{ background: '#fff', borderRadius: 10, padding: '12px 16px', borderLeft: `4px solid ${color}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{sub}</div>
    </div>
  );
}

const th = { padding: '8px 10px', textAlign: 'left', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.3 };
const td = { padding: '8px 10px', fontSize: 12 };
const tbl = { width: '100%', borderCollapse: 'collapse', fontSize: 12 };
const lbl = { display: 'block', marginBottom: 3, fontWeight: 600, fontSize: 11, color: '#444' };
const inp = { width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #ccc', fontSize: 12, boxSizing: 'border-box' };
const btnGreen = { background: '#0d7a3e', color: '#fff', border: 'none', padding: '8px 18px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const actionBtn = { background: '#0d7a3e', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: 4, fontSize: 11, cursor: 'pointer' };
const err = { background: '#fce4e4', color: '#c0392b', padding: '10px 16px', borderRadius: 8, marginBottom: 12, fontSize: 13 };
const ok = { background: '#e8f8e8', color: '#0d7a3e', padding: '10px 16px', borderRadius: 8, marginBottom: 12, fontSize: 13 };

export default ReturnsManager;
