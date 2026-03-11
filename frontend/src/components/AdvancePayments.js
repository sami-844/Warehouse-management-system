import LoadingSpinner from './LoadingSpinner';
import React, { useState, useEffect, useCallback } from 'react';
import { advancePaymentsAPI, customerAPI, salesAPI } from '../services/api';
import './Sales.css';
import { Wallet } from 'lucide-react';

function AdvancePayments() {
  const [advances, setAdvances] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [applyingAdvance, setApplyingAdvance] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Lookups
  const [customers, setCustomers] = useState([]);
  const [invoices, setInvoices] = useState([]);

  // Create form
  const [form, setForm] = useState({
    customer_id: '', amount: '', payment_date: new Date().toISOString().slice(0, 10),
    payment_method: 'cash', reference: '', notes: ''
  });

  // Apply form
  const [applyInvoiceId, setApplyInvoiceId] = useState('');
  const [applyAmount, setApplyAmount] = useState('');

  const loadData = useCallback(() => {
    setLoading(true);
    const params = statusFilter ? { status: statusFilter } : {};
    Promise.all([
      advancePaymentsAPI.list(params),
      advancePaymentsAPI.summary(),
    ]).then(([advRes, sumRes]) => {
      setAdvances(advRes.advances || []);
      setSummary(sumRes);
      setLoading(false);
    }).catch(() => { setError('Failed to load advance payments'); setLoading(false); });
  }, [statusFilter]);

  useEffect(() => {
    loadData();
    customerAPI.list({ limit: 500 }).then(r => setCustomers(Array.isArray(r) ? r : (r?.items || []))).catch(() => {});
  }, [loadData]);

  const submitAdvance = () => {
    if (!form.customer_id) { setError('Select a customer'); return; }
    if (!form.amount || parseFloat(form.amount) <= 0) { setError('Enter a valid amount'); return; }
    setError(''); setSuccess('');
    advancePaymentsAPI.create({
      ...form,
      customer_id: parseInt(form.customer_id),
      amount: parseFloat(form.amount),
    }).then(res => {
      setSuccess(res.message);
      setShowCreate(false);
      setForm({ customer_id: '', amount: '', payment_date: new Date().toISOString().slice(0, 10), payment_method: 'cash', reference: '', notes: '' });
      loadData();
    }).catch(e => setError(e.response?.data?.detail || 'Failed to record advance'));
  };

  const openApply = async (adv) => {
    setApplyingAdvance(adv);
    setApplyAmount('');
    setApplyInvoiceId('');
    try {
      const res = await salesAPI.listInvoices({ customer_id: adv.customer_id });
      const invs = Array.isArray(res) ? res : (res?.invoices || []);
      const unpaid = invs.filter(i => i.status === 'pending' || i.status === 'partial');
      setInvoices(unpaid);
      if (unpaid.length > 0) {
        setApplyInvoiceId(String(unpaid[0].id));
        const due = ((unpaid[0].total_amount || 0) - (unpaid[0].amount_paid || 0));
        setApplyAmount(Math.min(due, parseFloat(adv.balance) || 0).toFixed(3));
      }
    } catch (e) { setInvoices([]); }
  };

  const submitApply = () => {
    if (!applyInvoiceId || !applyAmount || parseFloat(applyAmount) <= 0) { setError('Select invoice and enter amount'); return; }
    setError(''); setSuccess('');
    advancePaymentsAPI.apply(applyingAdvance.id, {
      invoice_id: parseInt(applyInvoiceId),
      amount: parseFloat(applyAmount),
    }).then(res => {
      setSuccess(res.message);
      setApplyingAdvance(null);
      loadData();
    }).catch(e => setError(e.response?.data?.detail || 'Failed to apply'));
  };

  const fmt = (n) => Number(n || 0).toFixed(3);
  const statusColor = (s) => ({ active: '#27ae60', fully_used: '#888' }[s] || '#888');

  return (
    <div className="sales-container">
      <div className="page-header">
        <div className="header-content">
          <div className="header-icon"><Wallet size={20} /></div>
          <div><h1>Advance Payments</h1><p>Customer prepayments and deposits</p></div>
        </div>
        <button className="action-btn primary" onClick={() => setShowCreate(true)}>+ Record Advance</button>
      </div>

      {error && <div className="message error">{error} <button onClick={() => setError('')} className="edit-btn" style={{ float: 'right' }}>x</button></div>}
      {success && <div className="message success">{success}</div>}

      {/* KPI Cards */}
      {summary && (
        <div className="so-summary-cards">
          <SCard label="Total Advances" value={summary.total_advances} color="#3498db" />
          <SCard label="Total Received" value={`OMR ${fmt(summary.total_amount)}`} color="#8e44ad" />
          <SCard label="Available Balance" value={`OMR ${fmt(summary.available_balance)}`} color="#27ae60" />
          <SCard label="Applied" value={`OMR ${fmt(summary.total_applied)}`} color="#e67e22" />
        </div>
      )}

      {/* Filter Tabs */}
      <div className="tab-bar">
        {[{ id: '', label: 'All' }, { id: 'active', label: 'Active' }, { id: 'fully_used', label: 'Fully Used' }].map(t => (
          <button key={t.id} onClick={() => setStatusFilter(t.id)} className={`tab-btn ${statusFilter === t.id ? 'active' : ''}`}>{t.label}</button>
        ))}
      </div>

      {/* Create Advance Form */}
      {showCreate && (
        <div className="form-card">
          <h3>Record Advance Payment</h3>
          <div className="form-row-3">
            <div className="form-group">
              <label>Customer *</label>
              <select value={form.customer_id} onChange={e => setForm({ ...form, customer_id: e.target.value })}>
                <option value="">-- Select Customer --</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Amount (OMR) *</label>
              <input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} min="0.001" step="0.001" placeholder="0.000" />
            </div>
            <div className="form-group">
              <label>Payment Method</label>
              <select value={form.payment_method} onChange={e => setForm({ ...form, payment_method: e.target.value })}>
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>
          </div>
          <div className="form-row-3">
            <div className="form-group">
              <label>Payment Date</label>
              <input type="date" value={form.payment_date} onChange={e => setForm({ ...form, payment_date: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Reference</label>
              <input value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} placeholder="Cheque #, transfer ref..." />
            </div>
          </div>
          <div className="form-group">
            <label>Notes</label>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Additional notes..." />
          </div>
          <div style={{ display: 'flex', gap: 'var(--ds-sp-3, 12px)', marginTop: 'var(--ds-sp-4, 16px)' }}>
            <button onClick={submitAdvance} className="action-btn primary">Record Advance</button>
            <button onClick={() => setShowCreate(false)} className="cancel-btn">Cancel</button>
          </div>
        </div>
      )}

      {/* Apply to Invoice Modal */}
      {applyingAdvance && (
        <div className="form-card" style={{ border: '2px solid #3498db' }}>
          <h3>Apply Advance -- {applyingAdvance.customer_name}</h3>
          <p style={{ margin: '8px 0', color: 'var(--ds-text-muted, #666)' }}>
            Available: <strong style={{ color: '#27ae60' }}>{fmt(applyingAdvance.balance)} OMR</strong>
          </p>
          {invoices.length === 0 ? (
            <p style={{ color: '#888' }}>No unpaid invoices found for this customer.</p>
          ) : (
            <div className="form-row-3">
              <div className="form-group">
                <label>Invoice</label>
                <select value={applyInvoiceId} onChange={e => {
                  setApplyInvoiceId(e.target.value);
                  const inv = invoices.find(i => String(i.id) === e.target.value);
                  if (inv) {
                    const due = (inv.total_amount || 0) - (inv.amount_paid || 0);
                    setApplyAmount(Math.min(due, parseFloat(applyingAdvance.balance) || 0).toFixed(3));
                  }
                }}>
                  {invoices.map(inv => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoice_number} -- Due: {((inv.total_amount || 0) - (inv.amount_paid || 0)).toFixed(3)} OMR
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Amount to Apply (OMR)</label>
                <input type="number" value={applyAmount} onChange={e => setApplyAmount(e.target.value)} min="0.001" step="0.001" />
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 'var(--ds-sp-3, 12px)', marginTop: 'var(--ds-sp-3, 12px)' }}>
            {invoices.length > 0 && <button onClick={submitApply} className="action-btn primary">Apply to Invoice</button>}
            <button onClick={() => setApplyingAdvance(null)} className="cancel-btn">Cancel</button>
          </div>
        </div>
      )}

      {/* Advances Table */}
      {loading ? <LoadingSpinner /> : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer</th><th>Date</th><th>Method</th><th>Reference</th>
                <th>Amount</th><th>Used</th><th>Balance</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {advances.length === 0 ? (
                <tr><td colSpan={9} className="no-data">No advance payments found</td></tr>
              ) : advances.map(a => (
                <tr key={a.id}>
                  <td className="name">{a.customer_name || '--'}</td>
                  <td>{a.payment_date}</td>
                  <td>{a.payment_method}</td>
                  <td>{a.reference || '--'}</td>
                  <td className="value">{fmt(a.amount)}</td>
                  <td className="value">{fmt(a.amount_used)}</td>
                  <td className="value" style={{ fontWeight: 600 }}>{fmt(a.balance)}</td>
                  <td><span className="status-pill" style={{ background: statusColor(a.status) }}>{a.status}</span></td>
                  <td>
                    <div className="action-cell">
                      {a.status === 'active' && parseFloat(a.balance) > 0 && (
                        <button onClick={() => openApply(a)} className="complete-btn small">Apply</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SCard({ label, value, color }) {
  return (
    <div className="summary-card" style={{ borderLeft: `4px solid ${color}` }}>
      <div className="sc-label">{label}</div>
      <div className="sc-value" style={{ color }}>{value}</div>
    </div>
  );
}

export default AdvancePayments;
