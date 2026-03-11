import LoadingSpinner from './LoadingSpinner';
import React, { useState, useEffect } from 'react';
import { accountingAPI } from '../services/api';
import './AdminPanel.css';
import { Wallet, Plus, Minus } from 'lucide-react';

function CashTransactions() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState({ total_in: 0, total_out: 0, net: 0 });
  const [fromDate, setFromDate] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10));
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));
  const [filterType, setFilterType] = useState('');
  const [message, setMessage] = useState({ text: '', type: '' });

  // Cash In/Out modal
  const [showCashModal, setShowCashModal] = useState(null); // 'in' or 'out' or null
  const [cashForm, setCashForm] = useState({
    tx_date: new Date().toISOString().slice(0, 10),
    account_code: '1110',
    category: '',
    amount: '',
    description: '',
    reference: '',
  });
  const [submitting, setSubmitting] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [fromDate, toDate, filterType]);

  const load = async () => {
    setLoading(true);
    try {
      const params = { from_date: fromDate, to_date: toDate };
      if (filterType) params.tx_type = filterType;
      const data = await accountingAPI.cashTransactions(params);
      setTransactions(data.data || []);
      setTotals({ total_in: data.total_in || 0, total_out: data.total_out || 0, net: data.net || 0 });
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fmt = (v) => (Number(v) || 0).toFixed(3);

  const openCashModal = (type) => {
    setCashForm({
      tx_date: new Date().toISOString().slice(0, 10),
      account_code: '1110',
      category: '',
      amount: '',
      description: '',
      reference: '',
    });
    setShowCashModal(type);
  };

  const handleCashSubmit = async () => {
    if (!cashForm.amount || Number(cashForm.amount) <= 0) {
      setMessage({ text: 'Amount must be greater than 0', type: 'error' });
      return;
    }
    setSubmitting(true);
    try {
      const fn = showCashModal === 'in' ? accountingAPI.cashIn : accountingAPI.cashOut;
      const res = await fn({
        ...cashForm,
        amount: Number(cashForm.amount),
      });
      setMessage({ text: res.message || `Cash ${showCashModal} recorded`, type: 'success' });
      setShowCashModal(null);
      load();
    } catch (e) {
      setMessage({ text: e.response?.data?.detail || 'Failed to record transaction', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const categoryOptions = showCashModal === 'in' ? [
    { code: '4110', label: 'Sales Revenue' },
    { code: '4200', label: 'Service Income' },
    { code: '4900', label: 'Other Income' },
    { code: '2120', label: 'Customer Advance' },
    { code: '1210', label: 'Accounts Receivable' },
  ] : [
    { code: '6100', label: 'Rent Expense' },
    { code: '6200', label: 'Utilities' },
    { code: '6300', label: 'Salaries & Wages' },
    { code: '6400', label: 'Transportation' },
    { code: '6500', label: 'Office Supplies' },
    { code: '6600', label: 'Maintenance' },
    { code: '6700', label: 'Insurance' },
    { code: '6800', label: 'Marketing' },
    { code: '6900', label: 'Miscellaneous Expense' },
    { code: '2110', label: 'Accounts Payable' },
    { code: '2210', label: 'VAT Payable' },
  ];

  return (
    <div className="admin-container">
      <div className="page-header">
        <div className="header-content">
          <div className="header-icon cash"><Wallet size={20} /></div>
          <div><h1>Cash Transactions</h1><p>All cash movements in one view</p></div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => openCashModal('in')} className="action-btn primary"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={16} /> Cash In
          </button>
          <button onClick={() => openCashModal('out')} className="action-btn"
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#dc2626', color: '#fff', border: 'none' }}>
            <Minus size={16} /> Cash Out
          </button>
        </div>
      </div>

      {message.text && (
        <div className={`message ${message.type}`} style={{ marginBottom: 12 }}
          onClick={() => setMessage({ text: '', type: '' })}>{message.text}</div>
      )}

      {/* Summary cards */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ padding: '14px 24px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0', flex: 1, minWidth: 160 }}>
          <div style={{ fontSize: 12, color: '#15803d', fontWeight: 600 }}>Total In</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#166534' }}>{fmt(totals.total_in)} OMR</div>
        </div>
        <div style={{ padding: '14px 24px', background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca', flex: 1, minWidth: 160 }}>
          <div style={{ fontSize: 12, color: '#dc2626', fontWeight: 600 }}>Total Out</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#991b1b' }}>{fmt(totals.total_out)} OMR</div>
        </div>
        <div style={{ padding: '14px 24px', background: '#f0f9ff', borderRadius: 8, border: '1px solid #bae6fd', flex: 1, minWidth: 160 }}>
          <div style={{ fontSize: 12, color: '#0369a1', fontWeight: 600 }}>Net Cash Flow</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: totals.net >= 0 ? '#166534' : '#991b1b' }}>{fmt(totals.net)} OMR</div>
        </div>
      </div>

      <div className="filter-bar">
        <label>From:</label>
        <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="filter-input" />
        <label>To:</label>
        <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="filter-input" />
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="filter-select">
          <option value="">All Types</option>
          <option value="sales_payment">Sales Payments</option>
          <option value="purchase_payment">Purchase Payments</option>
          <option value="transfer">Transfers</option>
          <option value="cash_in">Cash In</option>
          <option value="cash_out">Cash Out</option>
        </select>
      </div>

      {loading ? <LoadingSpinner /> : (
        <div className="table-container"><table className="data-table">
          <thead><tr><th>#</th><th>Date</th><th>Type</th><th>Reference</th><th>Description</th><th>In (OMR)</th><th>Out (OMR)</th></tr></thead>
          <tbody>
            {transactions.length === 0 ? <tr><td colSpan="7" className="no-data">No transactions found</td></tr> :
              transactions.map((t, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>{t.date}</td>
                  <td><span className="type-badge" style={{
                    background: t.type === 'cash_in' ? '#dcfce7' : t.type === 'cash_out' ? '#fee2e2' : undefined,
                    color: t.type === 'cash_in' ? '#166534' : t.type === 'cash_out' ? '#991b1b' : undefined,
                  }}>{(t.type || '').replace('_', ' ')}</span></td>
                  <td className="code">{t.reference}</td>
                  <td style={{ fontSize: 13 }}>{t.description}</td>
                  <td className={`value ${t.amount_in > 0 ? 'positive' : ''}`}>{t.amount_in > 0 ? fmt(t.amount_in) : '-'}</td>
                  <td className={`value ${t.amount_out > 0 ? 'negative' : ''}`}>{t.amount_out > 0 ? fmt(t.amount_out) : '-'}</td>
                </tr>
              ))
            }
          </tbody>
          {transactions.length > 0 && (
            <tfoot>
              <tr style={{ fontWeight: 700, background: '#f8fafc' }}>
                <td colSpan="5" style={{ textAlign: 'right' }}>Totals:</td>
                <td className="value positive">{fmt(totals.total_in)}</td>
                <td className="value negative">{fmt(totals.total_out)}</td>
              </tr>
            </tfoot>
          )}
        </table></div>
      )}

      {/* Cash In/Out Modal */}
      {showCashModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }} onClick={() => setShowCashModal(null)}>
          <div style={{
            background: 'var(--ds-surface, #fff)', borderRadius: 12, padding: 24,
            width: 480, maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, color: showCashModal === 'in' ? '#166534' : '#991b1b' }}>
                {showCashModal === 'in' ? 'Record Cash In' : 'Record Cash Out'}
              </h3>
              <button onClick={() => setShowCashModal(null)} style={{
                background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280',
              }}>X</button>
            </div>

            <div style={{ display: 'grid', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Date</label>
                  <input type="date" value={cashForm.tx_date}
                    onChange={e => setCashForm({ ...cashForm, tx_date: e.target.value })}
                    className="filter-input" style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Account</label>
                  <select value={cashForm.account_code}
                    onChange={e => setCashForm({ ...cashForm, account_code: e.target.value })}
                    className="filter-input" style={{ width: '100%' }}>
                    <option value="1110">1110 — Cash on Hand</option>
                    <option value="1120">1120 — Bank Account</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Category</label>
                <select value={cashForm.category}
                  onChange={e => setCashForm({ ...cashForm, category: e.target.value })}
                  className="filter-input" style={{ width: '100%' }}>
                  <option value="">— Select Category —</option>
                  {categoryOptions.map(o => (
                    <option key={o.code} value={o.code}>{o.code} — {o.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Amount (OMR)</label>
                <input type="number" step="0.001" min="0" value={cashForm.amount}
                  onChange={e => setCashForm({ ...cashForm, amount: e.target.value })}
                  className="filter-input" style={{ width: '100%' }} placeholder="0.000" />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Description</label>
                <input type="text" value={cashForm.description}
                  onChange={e => setCashForm({ ...cashForm, description: e.target.value })}
                  className="filter-input" style={{ width: '100%' }} placeholder="What is this transaction for?" />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Reference</label>
                <input type="text" value={cashForm.reference}
                  onChange={e => setCashForm({ ...cashForm, reference: e.target.value })}
                  className="filter-input" style={{ width: '100%' }} placeholder="Optional reference number" />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setShowCashModal(null)} className="action-btn">Cancel</button>
              <button onClick={handleCashSubmit} disabled={submitting}
                className="action-btn primary"
                style={showCashModal === 'out' ? { background: '#dc2626', borderColor: '#dc2626' } : {}}>
                {submitting ? 'Saving...' : showCashModal === 'in' ? 'Record Cash In' : 'Record Cash Out'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CashTransactions;
