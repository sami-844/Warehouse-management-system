import LoadingSpinner from './LoadingSpinner';
import React, { useState, useEffect } from 'react';
import { bankAccountsAPI } from '../services/api';
import './AdminPanel.css';
import { Landmark, Banknote, CreditCard, Smartphone, Plus, Edit2 } from 'lucide-react';

const typeIcons = {
  cash: Banknote,
  bank: Landmark,
  credit_card: CreditCard,
  mobile_wallet: Smartphone,
};

const typeColors = {
  cash: { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534' },
  bank: { bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af' },
  credit_card: { bg: '#fdf4ff', border: '#e9d5ff', text: '#7e22ce' },
  mobile_wallet: { bg: '#fff7ed', border: '#fed7aa', text: '#c2410c' },
};

function BankAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({});
  const [message, setMessage] = useState({ text: '', type: '' });

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    account_name: '', account_type: 'bank', bank_name: '',
    account_number: '', iban: '', currency: 'OMR',
    opening_balance: '', notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [acctData, sumData] = await Promise.all([
        bankAccountsAPI.list(),
        bankAccountsAPI.summary(),
      ]);
      setAccounts(acctData.accounts || []);
      setSummary(sumData);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fmt = (v) => (Number(v) || 0).toFixed(3);

  const openCreate = () => {
    setEditing(null);
    setForm({
      account_name: '', account_type: 'bank', bank_name: '',
      account_number: '', iban: '', currency: 'OMR',
      opening_balance: '', notes: '',
    });
    setShowModal(true);
  };

  const openEdit = (acct) => {
    setEditing(acct);
    setForm({
      account_name: acct.account_name || '',
      account_type: acct.account_type || 'bank',
      bank_name: acct.bank_name || '',
      account_number: acct.account_number || '',
      iban: acct.iban || '',
      currency: acct.currency || 'OMR',
      opening_balance: acct.opening_balance || '',
      notes: acct.notes || '',
    });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!form.account_name.trim()) {
      setMessage({ text: 'Account name is required', type: 'error' });
      return;
    }
    setSubmitting(true);
    try {
      if (editing) {
        await bankAccountsAPI.update(editing.id, form);
        setMessage({ text: 'Account updated', type: 'success' });
      } else {
        await bankAccountsAPI.create({
          ...form,
          opening_balance: Number(form.opening_balance) || 0,
        });
        setMessage({ text: 'Account created', type: 'success' });
      }
      setShowModal(false);
      load();
    } catch (e) {
      setMessage({ text: e.response?.data?.detail || 'Failed', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Deactivate this account?')) return;
    try {
      await bankAccountsAPI.remove(id);
      setMessage({ text: 'Account deactivated', type: 'success' });
      load();
    } catch (e) {
      setMessage({ text: e.response?.data?.detail || 'Failed', type: 'error' });
    }
  };

  if (loading) return <div className="admin-container"><LoadingSpinner text="Loading bank accounts..." /></div>;

  return (
    <div className="admin-container">
      <div className="page-header">
        <div className="header-content">
          <div className="header-icon finance"><Landmark size={20} /></div>
          <div><h1>Bank Accounts & Wallets</h1><p>Manage your cash and bank accounts</p></div>
        </div>
        <button onClick={openCreate} className="action-btn primary"
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={16} /> Add Account
        </button>
      </div>

      {message.text && (
        <div className={`message ${message.type}`} style={{ marginBottom: 12 }}
          onClick={() => setMessage({ text: '', type: '' })}>{message.text}</div>
      )}

      {/* Summary Cards */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <div style={{ padding: '14px 24px', background: '#f0f9ff', borderRadius: 8, border: '1px solid #bae6fd', flex: 1, minWidth: 160 }}>
          <div style={{ fontSize: 12, color: '#0369a1', fontWeight: 600 }}>Total Balance</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#0c4a6e' }}>{fmt(summary.total_balance)} OMR</div>
        </div>
        <div style={{ padding: '14px 24px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0', flex: 1, minWidth: 160 }}>
          <div style={{ fontSize: 12, color: '#15803d', fontWeight: 600 }}>Cash Balance</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#166534' }}>{fmt(summary.cash_balance)} OMR</div>
          <div style={{ fontSize: 11, color: '#6b7280' }}>{summary.cash_count || 0} account(s)</div>
        </div>
        <div style={{ padding: '14px 24px', background: '#eff6ff', borderRadius: 8, border: '1px solid #bfdbfe', flex: 1, minWidth: 160 }}>
          <div style={{ fontSize: 12, color: '#1e40af', fontWeight: 600 }}>Bank Balance</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#1e3a5f' }}>{fmt(summary.bank_balance)} OMR</div>
          <div style={{ fontSize: 11, color: '#6b7280' }}>{summary.bank_count || 0} account(s)</div>
        </div>
        <div style={{ padding: '14px 24px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', flex: 1, minWidth: 160 }}>
          <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Active Accounts</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#334155' }}>{summary.total_accounts || 0}</div>
        </div>
      </div>

      {/* Account Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320, 1fr))', gap: 16 }}>
        {accounts.length === 0 ? (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 40, color: '#6b7280' }}>
            No bank accounts found. Click "Add Account" to create one.
          </div>
        ) : accounts.map(acct => {
          const colors = typeColors[acct.account_type] || typeColors.bank;
          const Icon = typeIcons[acct.account_type] || Landmark;
          return (
            <div key={acct.id} style={{
              background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
              padding: 20, display: 'flex', flexDirection: 'column', gap: 12,
              transition: 'box-shadow 0.2s',
            }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10, background: colors.bg,
                    border: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon size={20} color={colors.text} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{acct.account_name}</div>
                    <span style={{
                      fontSize: 10, fontWeight: 700, textTransform: 'uppercase', padding: '2px 8px',
                      borderRadius: 4, background: colors.bg, color: colors.text, border: `1px solid ${colors.border}`,
                    }}>{(acct.account_type || '').replace('_', ' ')}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => openEdit(acct)} style={{
                    background: 'none', border: '1px solid #e2e8f0', borderRadius: 6,
                    padding: '4px 8px', cursor: 'pointer', color: '#6b7280',
                  }}><Edit2 size={14} /></button>
                  {!acct.is_default && (
                    <button onClick={() => handleDelete(acct.id)} style={{
                      background: 'none', border: '1px solid #fecaca', borderRadius: 6,
                      padding: '4px 8px', cursor: 'pointer', color: '#dc2626', fontSize: 12, fontWeight: 700,
                    }}>X</button>
                  )}
                </div>
              </div>

              {/* Balance */}
              <div style={{ textAlign: 'center', padding: '8px 0' }}>
                <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, marginBottom: 2 }}>Current Balance</div>
                <div style={{ fontSize: 24, fontWeight: 800, fontFamily: 'var(--ds-font-mono)', color: '#0c4a6e' }}>
                  {fmt(acct.current_balance)} <span style={{ fontSize: 13, fontWeight: 600 }}>{acct.currency || 'OMR'}</span>
                </div>
              </div>

              {/* Details */}
              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 10, fontSize: 12, color: '#6b7280' }}>
                {acct.bank_name && <div><strong>Bank:</strong> {acct.bank_name}</div>}
                {acct.account_number && <div><strong>Account #:</strong> {acct.account_number}</div>}
                {acct.iban && <div><strong>IBAN:</strong> {acct.iban}</div>}
                {acct.is_default ? (
                  <span style={{ fontSize: 10, background: '#fef3c7', color: '#92400e', padding: '2px 6px', borderRadius: 3, fontWeight: 700 }}>DEFAULT</span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }} onClick={() => setShowModal(false)}>
          <div style={{
            background: 'var(--ds-surface, #fff)', borderRadius: 12, padding: 24,
            width: 520, maxWidth: '90vw', maxHeight: '90vh', overflow: 'auto',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0 }}>{editing ? 'Edit Account' : 'Add Bank Account'}</h3>
              <button onClick={() => setShowModal(false)} style={{
                background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280',
              }}>X</button>
            </div>

            <div style={{ display: 'grid', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Account Name *</label>
                  <input type="text" value={form.account_name}
                    onChange={e => setForm({ ...form, account_name: e.target.value })}
                    className="filter-input" style={{ width: '100%' }} placeholder="e.g. Bank Muscat Main" />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Type</label>
                  <select value={form.account_type}
                    onChange={e => setForm({ ...form, account_type: e.target.value })}
                    className="filter-input" style={{ width: '100%' }}>
                    <option value="cash">Cash</option>
                    <option value="bank">Bank</option>
                    <option value="credit_card">Credit Card</option>
                    <option value="mobile_wallet">Mobile Wallet</option>
                  </select>
                </div>
              </div>

              {(form.account_type === 'bank' || form.account_type === 'credit_card') && (
                <>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Bank Name</label>
                    <input type="text" value={form.bank_name}
                      onChange={e => setForm({ ...form, bank_name: e.target.value })}
                      className="filter-input" style={{ width: '100%' }} placeholder="e.g. Bank Muscat" />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Account Number</label>
                      <input type="text" value={form.account_number}
                        onChange={e => setForm({ ...form, account_number: e.target.value })}
                        className="filter-input" style={{ width: '100%' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>IBAN</label>
                      <input type="text" value={form.iban}
                        onChange={e => setForm({ ...form, iban: e.target.value })}
                        className="filter-input" style={{ width: '100%' }} />
                    </div>
                  </div>
                </>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Currency</label>
                  <select value={form.currency}
                    onChange={e => setForm({ ...form, currency: e.target.value })}
                    className="filter-input" style={{ width: '100%' }}>
                    <option value="OMR">OMR — Omani Rial</option>
                    <option value="USD">USD — US Dollar</option>
                    <option value="AED">AED — UAE Dirham</option>
                    <option value="SAR">SAR — Saudi Riyal</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Opening Balance</label>
                  <input type="number" step="0.001" value={form.opening_balance}
                    onChange={e => setForm({ ...form, opening_balance: e.target.value })}
                    className="filter-input" style={{ width: '100%' }} placeholder="0.000" />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Notes</label>
                <textarea value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  className="filter-input" style={{ width: '100%', minHeight: 60 }} placeholder="Optional notes" />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setShowModal(false)} className="action-btn">Cancel</button>
              <button onClick={handleSubmit} disabled={submitting} className="action-btn primary">
                {submitting ? 'Saving...' : editing ? 'Update Account' : 'Create Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BankAccounts;
