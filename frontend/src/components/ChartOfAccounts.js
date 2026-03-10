import LoadingSpinner from './LoadingSpinner';
import React, { useState, useEffect } from 'react';
import { accountingAPI } from '../services/api';
import './AdminPanel.css';
import { BookOpen } from 'lucide-react';

const ACCOUNT_TYPES = ['Asset', 'Liability', 'Equity', 'Income', 'COGS', 'Expense'];

function ChartOfAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [filterType, setFilterType] = useState('');
  const [message, setMessage] = useState({ text: '', type: '' });
  const [form, setForm] = useState({ code: '', name: '', account_type: 'Asset', parent_id: '', balance: '0', notes: '' });

  useEffect(() => { load(); }, [filterType]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterType) params.account_type = filterType;
      const data = await accountingAPI.listAccounts(params);
      setAccounts(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = { ...form, balance: parseFloat(form.balance) || 0 };
      if (data.parent_id) data.parent_id = parseInt(data.parent_id); else delete data.parent_id;
      if (editingId) {
        await accountingAPI.updateAccount(editingId, data);
        setMessage({ text: 'Account updated!', type: 'success' });
      } else {
        await accountingAPI.createAccount(data);
        setMessage({ text: 'Account created!', type: 'success' });
      }
      setShowForm(false); setEditingId(null); resetForm(); load();
    } catch (e) { setMessage({ text: e.response?.data?.detail || e.message, type: 'error' }); }
  };

  const editAccount = (a) => {
    setForm({ code: a.code, name: a.name, account_type: a.account_type, parent_id: a.parent_id || '', balance: a.balance || '0', notes: a.notes || '' });
    setEditingId(a.id); setShowForm(true);
  };

  const resetForm = () => setForm({ code: '', name: '', account_type: 'Asset', parent_id: '', balance: '0', notes: '' });

  const seedDefaults = async () => {
    try {
      const res = await accountingAPI.seedAccounts();
      setMessage({ text: res.message, type: 'success' });
      load();
    } catch (e) { setMessage({ text: e.response?.data?.detail || e.message, type: 'error' }); }
  };

  const typeColor = (t) => {
    const map = { Asset: '#0369a1', Liability: '#b91c1c', Equity: '#7c3aed', Income: '#15803d', COGS: '#c2410c', Expense: '#dc2626' };
    return map[t] || '#475569';
  };

  // Group by type for summary
  const summary = {};
  accounts.forEach(a => {
    if (!summary[a.account_type]) summary[a.account_type] = { count: 0, total: 0 };
    summary[a.account_type].count++;
    summary[a.account_type].total += Number(a.balance) || 0;
  });

  return (
    <div className="admin-container">
      <div className="page-header">
        <div className="header-content">
          <div className="header-icon accounting"><BookOpen size={20} /></div>
          <div><h1>Chart of Accounts</h1><p>Manage your accounting structure</p></div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {accounts.length === 0 && !loading && (
            <button className="action-btn" onClick={seedDefaults} style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d' }}>
              Seed Default Accounts
            </button>
          )}
          <button className="action-btn primary" onClick={() => { resetForm(); setEditingId(null); setShowForm(!showForm); }}>
            {showForm ? 'Cancel' : '+ New Account'}
          </button>
        </div>
      </div>

      {message.text && <div className={`message ${message.type}`}>{message.text}</div>}

      {/* Summary cards */}
      {Object.keys(summary).length > 0 && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          {ACCOUNT_TYPES.filter(t => summary[t]).map(t => (
            <div key={t} style={{ padding: '12px 20px', background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', minWidth: 140, cursor: 'pointer', borderLeft: `4px solid ${typeColor(t)}` }}
              onClick={() => setFilterType(filterType === t ? '' : t)}>
              <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>{t}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: typeColor(t) }}>{(summary[t].total).toFixed(3)}</div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>{summary[t].count} accounts</div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="form-card" style={{ marginBottom: 16 }}>
          <h3>{editingId ? 'Edit Account' : 'New Account'}</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-row-3">
              <div className="form-group"><label>Account Code *</label>
                <input value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} required placeholder="1110" disabled={!!editingId} /></div>
              <div className="form-group"><label>Account Name *</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required placeholder="Cash on Hand" /></div>
              <div className="form-group"><label>Type *</label>
                <select value={form.account_type} onChange={e => setForm(p => ({ ...p, account_type: e.target.value }))}>
                  {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select></div>
            </div>
            <div className="form-row-3">
              <div className="form-group"><label>Parent Account</label>
                <select value={form.parent_id} onChange={e => setForm(p => ({ ...p, parent_id: e.target.value }))}>
                  <option value="">None (Top Level)</option>
                  {accounts.filter(a => a.id !== editingId).map(a => (
                    <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                  ))}
                </select></div>
              <div className="form-group"><label>Opening Balance (OMR)</label>
                <input type="number" step="0.001" value={form.balance} onChange={e => setForm(p => ({ ...p, balance: e.target.value }))} /></div>
              <div className="form-group"><label>Notes</label>
                <input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Optional" /></div>
            </div>
            <button type="submit" className="submit-btn">{editingId ? 'Update' : 'Create Account'}</button>
          </form>
        </div>
      )}

      <div className="filter-bar">
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="filter-select">
          <option value="">All Types</option>
          {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {loading ? <LoadingSpinner /> : (
        <div className="table-container"><table className="data-table">
          <thead><tr><th>Code</th><th>Account Name</th><th>Type</th><th>Parent</th><th>Balance (OMR)</th><th></th></tr></thead>
          <tbody>
            {accounts.length === 0 ? <tr><td colSpan="6" className="no-data">No accounts found. Click "Seed Default Accounts" to get started.</td></tr> :
              accounts.map(a => (
                <tr key={a.id} className={!a.is_active ? 'inactive' : ''}>
                  <td className="code">{a.code}</td>
                  <td className="name">{a.name}</td>
                  <td><span className="type-badge" style={{ background: typeColor(a.account_type) + '18', color: typeColor(a.account_type), border: `1px solid ${typeColor(a.account_type)}40` }}>{a.account_type}</span></td>
                  <td style={{ fontSize: 12, color: '#64748b' }}>{a.parent_name || '-'}</td>
                  <td className={`value ${a.balance < 0 ? 'negative' : ''}`}>{(Number(a.balance) || 0).toFixed(3)}</td>
                  <td><button className="edit-btn" onClick={() => editAccount(a)}>Edit</button></td>
                </tr>
              ))
            }
          </tbody>
        </table></div>
      )}
    </div>
  );
}

export default ChartOfAccounts;
