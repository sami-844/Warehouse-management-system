import LoadingSpinner from './LoadingSpinner';
import React, { useState, useEffect, useCallback } from 'react';
import { billsAPI, supplierAPI, accountingAPI } from '../services/api';
import './Sales.css';
import { FileText } from 'lucide-react';

function BillsList() {
  const [bills, setBills] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [payingBill, setPayingBill] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Lookups
  const [suppliers, setSuppliers] = useState([]);
  const [expenseAccounts, setExpenseAccounts] = useState([]);

  // Create form
  const [form, setForm] = useState({ bill_date: new Date().toISOString().slice(0, 10), due_date: '', vendor_id: '', vendor_name: '', expense_account: '', description: '', amount: '', add_vat: false, notes: '' });

  // Payment form
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');

  const loadData = useCallback(() => {
    setLoading(true);
    const params = statusFilter ? { status: statusFilter } : {};
    Promise.all([
      billsAPI.list(params),
      billsAPI.summary(),
    ]).then(([billsRes, sumRes]) => {
      setBills(billsRes.bills || []);
      setSummary(sumRes);
      setLoading(false);
    }).catch(() => { setError('Failed to load bills'); setLoading(false); });
  }, [statusFilter]);

  useEffect(() => {
    loadData();
    supplierAPI.list({ limit: 500 }).then(r => setSuppliers(Array.isArray(r) ? r : r.suppliers || [])).catch(() => {});
    accountingAPI.listAccounts({ account_type: 'Expense' }).then(r => {
      const accs = Array.isArray(r) ? r : r.accounts || [];
      setExpenseAccounts(accs.filter(a => a.account_type === 'Expense'));
    }).catch(() => {});
  }, [loadData]);

  const submitBill = () => {
    if (!form.description) { setError('Description is required'); return; }
    if (!form.amount || parseFloat(form.amount) <= 0) { setError('Amount is required'); return; }
    setError(''); setSuccess('');
    billsAPI.create({
      ...form,
      vendor_id: form.vendor_id ? parseInt(form.vendor_id) : null,
      amount: parseFloat(form.amount),
    }).then(res => {
      setSuccess(res.message);
      setShowCreate(false);
      setForm({ bill_date: new Date().toISOString().slice(0, 10), due_date: '', vendor_id: '', vendor_name: '', expense_account: '', description: '', amount: '', add_vat: false, notes: '' });
      loadData();
    }).catch(e => setError(e.response?.data?.detail || 'Failed to create bill'));
  };

  const submitPayment = () => {
    if (!payAmount || parseFloat(payAmount) <= 0) { setError('Enter payment amount'); return; }
    setError(''); setSuccess('');
    billsAPI.pay(payingBill.id, { amount: parseFloat(payAmount), payment_method: payMethod })
      .then(res => { setSuccess(res.message); setPayingBill(null); setPayAmount(''); loadData(); })
      .catch(e => setError(e.response?.data?.detail || 'Failed'));
  };

  const deleteBill = (id) => {
    if (!window.confirm('Delete this bill?')) return;
    billsAPI.remove(id)
      .then(() => { setSuccess('Bill deleted'); loadData(); })
      .catch(e => setError(e.response?.data?.detail || 'Failed'));
  };

  const fmt = (n) => Number(n || 0).toFixed(3);
  const statusColor = (s) => ({ unpaid: '#c0392b', partial: '#e67e22', paid: '#27ae60' }[s] || '#888');

  return (
    <div className="sales-container">
      <div className="page-header">
        <div className="header-content">
          <div className="header-icon"><FileText size={20} /></div>
          <div><h1>Bills</h1><p>Expense and service invoices</p></div>
        </div>
        <button className="action-btn primary" onClick={() => setShowCreate(true)}>+ New Bill</button>
      </div>

      {error && <div className="message error">{error} <button onClick={() => setError('')} className="edit-btn" style={{ float: 'right' }}>x</button></div>}
      {success && <div className="message success">{success}</div>}

      {/* KPI Cards */}
      {summary && (
        <div className="so-summary-cards">
          <SCard label="Total Bills" value={summary.total_bills} sub="" color="#3498db" />
          <SCard label="Total Due" value={`OMR ${fmt(summary.total_due)}`} sub="" color="#c0392b" />
          <SCard label="Paid This Month" value={`OMR ${fmt(summary.paid_this_month)}`} sub="" color="#27ae60" />
          <SCard label="Overdue" value={summary.overdue} sub="" color="#e67e22" />
        </div>
      )}

      {/* Status Filter Tabs */}
      <div className="tab-bar">
        {[{ id: '', label: 'All' }, { id: 'unpaid', label: 'Unpaid' }, { id: 'partial', label: 'Partial' }, { id: 'paid', label: 'Paid' }].map(t => (
          <button key={t.id} onClick={() => setStatusFilter(t.id)} className={`tab-btn ${statusFilter === t.id ? 'active' : ''}`}>{t.label}</button>
        ))}
      </div>

      {/* Create Bill Form */}
      {showCreate && (
        <div className="form-card">
          <h3>New Bill</h3>
          <div className="form-row-3">
            <div className="form-group">
              <label>Vendor (optional)</label>
              <select value={form.vendor_id} onChange={e => setForm({ ...form, vendor_id: e.target.value })}>
                <option value="">-- Select or type below --</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Vendor Name (free text)</label>
              <input value={form.vendor_name} onChange={e => setForm({ ...form, vendor_name: e.target.value })} placeholder="e.g. Oman Electricity" />
            </div>
            <div className="form-group">
              <label>Expense Category</label>
              <select value={form.expense_account} onChange={e => setForm({ ...form, expense_account: e.target.value })}>
                <option value="">-- Select --</option>
                {expenseAccounts.map(a => <option key={a.code} value={a.code}>{a.code} - {a.name}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row-3">
            <div className="form-group">
              <label>Bill Date *</label>
              <input type="date" value={form.bill_date} onChange={e => setForm({ ...form, bill_date: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Due Date</label>
              <input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Amount (OMR) *</label>
              <input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} min="0" step="0.001" placeholder="0.000" />
            </div>
          </div>
          <div className="form-row-3">
            <div className="form-group">
              <label>Description *</label>
              <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="e.g. Monthly electricity bill" />
            </div>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 24 }}>
                <input type="checkbox" checked={form.add_vat} onChange={e => setForm({ ...form, add_vat: e.target.checked })} /> Add 5% VAT
              </label>
            </div>
          </div>
          <div className="form-group">
            <label>Notes</label>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Additional notes..." />
          </div>
          <div style={{ display: 'flex', gap: 'var(--ds-sp-3)', marginTop: 'var(--ds-sp-4)' }}>
            <button onClick={submitBill} className="action-btn primary">Create Bill</button>
            <button onClick={() => setShowCreate(false)} className="cancel-btn">Cancel</button>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {payingBill && (
        <div className="form-card" style={{ border: '2px solid #3498db' }}>
          <h3>Record Payment — {payingBill.bill_number}</h3>
          <p style={{ margin: '8px 0', color: 'var(--ds-text-muted)' }}>
            Total: OMR {fmt(payingBill.total_amount)} | Paid: OMR {fmt(payingBill.amount_paid)} | Due: OMR {fmt((payingBill.total_amount || 0) - (payingBill.amount_paid || 0))}
          </p>
          <div className="form-row-3">
            <div className="form-group">
              <label>Amount (OMR)</label>
              <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} min="0.001" step="0.001" placeholder="0.000" />
            </div>
            <div className="form-group">
              <label>Payment Method</label>
              <select value={payMethod} onChange={e => setPayMethod(e.target.value)}>
                <option value="cash">Cash</option>
                <option value="bank">Bank Transfer</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--ds-sp-3)', marginTop: 'var(--ds-sp-3)' }}>
            <button onClick={submitPayment} className="action-btn primary">Record Payment</button>
            <button onClick={() => { setPayingBill(null); setPayAmount(''); }} className="cancel-btn">Cancel</button>
          </div>
        </div>
      )}

      {/* Bills Table */}
      {loading ? <LoadingSpinner /> : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Bill #</th><th>Vendor</th><th>Date</th><th>Due Date</th>
                <th>Amount</th><th>Due</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {bills.length === 0 ? (
                <tr><td colSpan={8} className="no-data">No bills found</td></tr>
              ) : bills.map(b => (
                <tr key={b.id}>
                  <td className="code">{b.bill_number}</td>
                  <td>{b.display_vendor || b.vendor_name || '--'}</td>
                  <td>{b.bill_date}</td>
                  <td>{b.due_date || '--'}</td>
                  <td className="value">{fmt(b.total_amount)}</td>
                  <td className="value">{fmt((b.total_amount || 0) - (b.amount_paid || 0))}</td>
                  <td><span className="status-pill" style={{ background: statusColor(b.status) }}>{b.status}</span></td>
                  <td>
                    <div className="action-cell">
                      {b.status !== 'paid' && (
                        <button onClick={() => { setPayingBill(b); setPayAmount(String(((b.total_amount || 0) - (b.amount_paid || 0)).toFixed(3))); }} className="complete-btn small">Pay</button>
                      )}
                      {b.status === 'unpaid' && (
                        <button onClick={() => deleteBill(b.id)} className="remove-btn">x</button>
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

function SCard({ label, value, sub, color }) {
  return (
    <div className="summary-card" style={{ borderLeft: `4px solid ${color}` }}>
      <div className="sc-label">{label}</div>
      <div className="sc-value" style={{ color }}>{value}</div>
      {sub && <div style={{ fontSize: 'var(--ds-text-xs)', color: 'var(--ds-text-muted)', marginTop: 'var(--ds-sp-1)' }}>{sub}</div>}
    </div>
  );
}

export default BillsList;
