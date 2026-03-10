import LoadingSpinner from './LoadingSpinner';
import React, { useState, useEffect } from 'react';
import { accountingAPI } from '../services/api';
import './AdminPanel.css';
import { ArrowRightLeft } from 'lucide-react';

function MoneyTransfer() {
  const [accounts, setAccounts] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [fromDate, setFromDate] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10));
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));
  const [form, setForm] = useState({
    from_account_id: '', to_account_id: '', amount: '', transfer_date: new Date().toISOString().slice(0, 10), reference: '', notes: ''
  });

  useEffect(() => { loadAccounts(); }, []);
  useEffect(() => { loadTransfers(); }, [fromDate, toDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadAccounts = async () => {
    try { const data = await accountingAPI.listAccounts(); setAccounts(Array.isArray(data) ? data : []); } catch (e) { console.error(e); }
  };

  const loadTransfers = async () => {
    setLoading(true);
    try {
      const data = await accountingAPI.listTransfers({ from_date: fromDate, to_date: toDate });
      setTransfers(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.from_account_id === form.to_account_id) {
      setMessage({ text: 'From and To accounts must be different', type: 'error' }); return;
    }
    try {
      const data = { ...form, from_account_id: parseInt(form.from_account_id), to_account_id: parseInt(form.to_account_id), amount: parseFloat(form.amount) };
      const res = await accountingAPI.createTransfer(data);
      setMessage({ text: res.message, type: 'success' });
      setShowForm(false);
      setForm({ from_account_id: '', to_account_id: '', amount: '', transfer_date: new Date().toISOString().slice(0, 10), reference: '', notes: '' });
      loadTransfers(); loadAccounts();
    } catch (e) { setMessage({ text: e.response?.data?.detail || e.message, type: 'error' }); }
  };

  const fmt = (v) => (Number(v) || 0).toFixed(3);

  return (
    <div className="admin-container">
      <div className="page-header">
        <div className="header-content">
          <div className="header-icon transfer"><ArrowRightLeft size={20} /></div>
          <div><h1>Money Transfers</h1><p>Transfer between accounts</p></div>
        </div>
        <button className="action-btn primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ New Transfer'}
        </button>
      </div>

      {message.text && <div className={`message ${message.type}`}>{message.text}</div>}

      {showForm && (
        <div className="form-card" style={{ marginBottom: 16 }}>
          <h3>New Transfer</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-row-2">
              <div className="form-group"><label>Transfer From *</label>
                <select value={form.from_account_id} onChange={e => setForm(p => ({ ...p, from_account_id: e.target.value }))} required>
                  <option value="">Select account...</option>
                  {accounts.filter(a => a.is_active).map(a => (
                    <option key={a.id} value={a.id}>{a.code} - {a.name} ({fmt(a.balance)} OMR)</option>
                  ))}
                </select></div>
              <div className="form-group"><label>Transfer To *</label>
                <select value={form.to_account_id} onChange={e => setForm(p => ({ ...p, to_account_id: e.target.value }))} required>
                  <option value="">Select account...</option>
                  {accounts.filter(a => a.is_active && String(a.id) !== form.from_account_id).map(a => (
                    <option key={a.id} value={a.id}>{a.code} - {a.name} ({fmt(a.balance)} OMR)</option>
                  ))}
                </select></div>
            </div>
            <div className="form-row-3">
              <div className="form-group"><label>Amount (OMR) *</label>
                <input type="number" step="0.001" min="0.001" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} required placeholder="0.000" /></div>
              <div className="form-group"><label>Date *</label>
                <input type="date" value={form.transfer_date} onChange={e => setForm(p => ({ ...p, transfer_date: e.target.value }))} required /></div>
              <div className="form-group"><label>Reference #</label>
                <input value={form.reference} onChange={e => setForm(p => ({ ...p, reference: e.target.value }))} placeholder="TRF-001" /></div>
            </div>
            <div className="form-group"><label>Notes</label>
              <input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Optional" /></div>
            <button type="submit" className="submit-btn">Execute Transfer</button>
          </form>
        </div>
      )}

      <div className="filter-bar">
        <label>From:</label>
        <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="filter-input" />
        <label>To:</label>
        <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="filter-input" />
        <button className="action-btn" onClick={loadTransfers} style={{ background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd' }}>Refresh</button>
      </div>

      {loading ? <LoadingSpinner /> : (
        <div className="table-container"><table className="data-table">
          <thead><tr><th>#</th><th>Date</th><th>From Account</th><th>To Account</th><th>Amount (OMR)</th><th>Reference</th><th>Notes</th></tr></thead>
          <tbody>
            {transfers.length === 0 ? <tr><td colSpan="7" className="no-data">No transfers found</td></tr> :
              transfers.map((t, i) => (
                <tr key={t.id || i}>
                  <td>{i + 1}</td>
                  <td>{t.date}</td>
                  <td>{t.from_account}</td>
                  <td>{t.to_account}</td>
                  <td className="value">{fmt(t.amount)}</td>
                  <td className="code">{t.reference || '-'}</td>
                  <td style={{ fontSize: 12, color: '#64748b' }}>{t.notes || '-'}</td>
                </tr>
              ))
            }
          </tbody>
        </table></div>
      )}
    </div>
  );
}

export default MoneyTransfer;
