import LoadingSpinner from './LoadingSpinner';
import React, { useState, useEffect } from 'react';
import { reportsAPI, accountingAPI } from '../services/api';
import './AdminPanel.css';
import { BookOpen } from 'lucide-react';

function GeneralLedger() {
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fromDate, setFromDate] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10));
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      const d = await accountingAPI.listAccounts();
      const list = Array.isArray(d) ? d : (d?.accounts || []);
      setAccounts(list.sort((a, b) => (a.code || '').localeCompare(b.code || '')));
    } catch (e) { console.error(e); }
  };

  const loadLedger = async () => {
    if (!selectedAccount) return;
    setLoading(true);
    try {
      const d = await reportsAPI.generalLedger({
        account_code: selectedAccount,
        from_date: fromDate,
        to_date: toDate,
      });
      setData(d);
    } catch (e) { console.error(e); setData(null); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (selectedAccount) loadLedger();
  }, [selectedAccount, fromDate, toDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const fmt = (v) => (Number(v) || 0).toFixed(3);

  const refTypeColor = (t) => ({
    SALES_INVOICE: '#16a34a', SALES_PAYMENT: '#059669',
    PURCHASE_INVOICE: '#d97706', PURCHASE_PAYMENT: '#ea580c',
    EXPENSE: '#dc2626', MANUAL: '#6366f1', VAT_PAYMENT: '#8b5cf6',
    CASH_IN: '#16a34a', CASH_OUT: '#dc2626',
    ADVANCE_PAYMENT: '#0891b2', ADVANCE_APPLICATION: '#0d9488',
    SALES_RETURN: '#f59e0b', PURCHASE_RETURN: '#ef4444',
  }[t] || '#6b7280');

  return (
    <div className="admin-container">
      <div className="page-header">
        <div className="header-content">
          <div className="header-icon finance"><BookOpen size={20} /></div>
          <div><h1>General Ledger</h1><p>Transaction history by account</p></div>
        </div>
      </div>

      <div className="filter-bar" style={{ marginBottom: 16 }}>
        <select value={selectedAccount} onChange={e => setSelectedAccount(e.target.value)}
          className="filter-input" style={{ minWidth: 250 }}>
          <option value="">-- Select Account --</option>
          {accounts.map(a => (
            <option key={a.code || a.id} value={a.code}>
              {a.code} — {a.name} ({a.account_type})
            </option>
          ))}
        </select>
        <label>From:</label>
        <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="filter-input" />
        <label>To:</label>
        <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="filter-input" />
        <button className="action-btn primary" onClick={loadLedger}>Load</button>
      </div>

      {!selectedAccount ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#6b7280', fontSize: 14 }}>
          Select an account to view its ledger
        </div>
      ) : loading ? <LoadingSpinner text="Loading ledger..." /> : !data ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>No data available</div>
      ) : (
        <>
          {/* Account header */}
          <div style={{
            padding: '12px 16px', background: '#f8fafc', borderRadius: 8,
            border: '1px solid #e2e8f0', marginBottom: 16, fontSize: 13,
          }}>
            <strong>{data.account?.code} — {data.account?.name}</strong>
            <span style={{ marginLeft: 12, color: '#6b7280' }}>({data.account?.type})</span>
            <span style={{ marginLeft: 12, color: '#6b7280' }}>
              Period: {data.period?.from} to {data.period?.to}
            </span>
          </div>

          {/* Summary cards */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            <div style={{ padding: '12px 20px', background: '#f0f9ff', borderRadius: 8, border: '1px solid #bae6fd', flex: 1, minWidth: 150 }}>
              <div style={{ fontSize: 11, color: '#0369a1', fontWeight: 600 }}>Opening Balance</div>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--ds-font-mono)', color: '#0c4a6e' }}>{fmt(data.opening_balance)}</div>
            </div>
            <div style={{ padding: '12px 20px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0', flex: 1, minWidth: 150 }}>
              <div style={{ fontSize: 11, color: '#15803d', fontWeight: 600 }}>Total Debit</div>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--ds-font-mono)', color: '#166534' }}>{fmt(data.total_debit)}</div>
            </div>
            <div style={{ padding: '12px 20px', background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca', flex: 1, minWidth: 150 }}>
              <div style={{ fontSize: 11, color: '#dc2626', fontWeight: 600 }}>Total Credit</div>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--ds-font-mono)', color: '#991b1b' }}>{fmt(data.total_credit)}</div>
            </div>
            <div style={{ padding: '12px 20px', background: '#eff6ff', borderRadius: 8, border: '1px solid #bfdbfe', flex: 1, minWidth: 150 }}>
              <div style={{ fontSize: 11, color: '#1e40af', fontWeight: 600 }}>Closing Balance</div>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--ds-font-mono)', color: '#1e3a5f' }}>{fmt(data.closing_balance)}</div>
            </div>
          </div>

          {/* Transactions table */}
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Entry #</th><th>Date</th><th>Type</th><th>Description</th>
                  <th style={{ textAlign: 'right' }}>Debit</th>
                  <th style={{ textAlign: 'right' }}>Credit</th>
                  <th style={{ textAlign: 'right' }}>Balance</th>
                </tr>
              </thead>
              <tbody>
                {/* Opening balance row */}
                <tr style={{ background: '#f8fafc', fontWeight: 600 }}>
                  <td colSpan="4">Opening Balance</td>
                  <td style={{ textAlign: 'right' }}>-</td>
                  <td style={{ textAlign: 'right' }}>-</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)' }}>{fmt(data.opening_balance)}</td>
                </tr>
                {data.transactions?.length === 0 ? (
                  <tr><td colSpan="7" className="no-data">No transactions in this period</td></tr>
                ) : data.transactions?.map((t, i) => (
                  <tr key={i}>
                    <td style={{ fontFamily: 'var(--ds-font-mono)', fontSize: 11 }}>{t.entry_number}</td>
                    <td>{t.date}</td>
                    <td>
                      <span style={{
                        background: refTypeColor(t.reference_type), color: '#fff',
                        padding: '2px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700,
                      }}>{(t.reference_type || '').replace(/_/g, ' ')}</span>
                    </td>
                    <td style={{ fontSize: 12 }}>{t.description}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)', color: t.debit > 0 ? '#16a34a' : '#9ca3af' }}>
                      {t.debit > 0 ? fmt(t.debit) : '-'}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)', color: t.credit > 0 ? '#dc2626' : '#9ca3af' }}>
                      {t.credit > 0 ? fmt(t.credit) : '-'}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)', fontWeight: 600 }}>{fmt(t.balance)}</td>
                  </tr>
                ))}
                {/* Closing balance row */}
                <tr style={{ background: '#f8fafc', fontWeight: 700, borderTop: '2px solid #e2e8f0' }}>
                  <td colSpan="4" style={{ textAlign: 'right' }}>Closing Balance</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)', color: '#16a34a' }}>{fmt(data.total_debit)}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)', color: '#dc2626' }}>{fmt(data.total_credit)}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)', color: '#0c4a6e' }}>{fmt(data.closing_balance)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

export default GeneralLedger;
