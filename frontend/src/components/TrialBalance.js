import React, { useState, useEffect } from 'react';
import { reportsAPI } from '../services/api';
import LoadingSpinner from './LoadingSpinner';
import './AdminPanel.css';
import { ClipboardCheck } from 'lucide-react';

const TYPE_ORDER = ['Asset', 'Liability', 'Equity', 'Income', 'Expense', 'COGS'];
const TYPE_COLORS = {
  Asset: '#0369a1', Liability: '#dc2626', Equity: '#7c3aed',
  Income: '#16a34a', Expense: '#d97706', COGS: '#be123c',
};

function TrialBalance() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const today = new Date().toISOString().slice(0, 10);
  const yearStart = today.slice(0, 4) + '-01-01';
  const [fromDate, setFromDate] = useState(yearStart);
  const [toDate, setToDate] = useState(today);

  useEffect(() => { load(); }, [fromDate, toDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = async () => {
    setLoading(true);
    try {
      const d = await reportsAPI.trialBalance({ from_date: fromDate, to_date: toDate });
      setData(d);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fmt = (v) => (Number(v) || 0).toFixed(3);

  // Group accounts by type
  const grouped = {};
  if (data?.accounts) {
    for (const acct of data.accounts) {
      const t = acct.account_type || 'Other';
      if (!grouped[t]) grouped[t] = [];
      grouped[t].push(acct);
    }
  }

  const sortedTypes = TYPE_ORDER.filter(t => grouped[t]).concat(
    Object.keys(grouped).filter(t => !TYPE_ORDER.includes(t))
  );

  return (
    <div className="admin-container">
      <div className="page-header">
        <div className="header-content">
          <div className="header-icon finance"><ClipboardCheck size={20} /></div>
          <div><h1>Trial Balance</h1><p>All accounts with debit and credit totals</p></div>
        </div>
      </div>

      <div className="filter-bar" style={{ marginBottom: 16 }}>
        <label style={{ fontWeight: 600, fontSize: 13 }}>From:</label>
        <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="filter-input" />
        <label style={{ fontWeight: 600, fontSize: 13 }}>To:</label>
        <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="filter-input" />
        <button className="action-btn primary" onClick={load}>Refresh</button>
        <button className="action-btn" onClick={() => window.print()}>Print</button>
      </div>

      {loading ? <LoadingSpinner text="Generating trial balance..." /> : !data ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>No data available</div>
      ) : (
        <>
          {/* Balance indicator */}
          <div style={{
            padding: '10px 16px', borderRadius: 8, marginBottom: 16, fontSize: 13, fontWeight: 600,
            background: data.is_balanced ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${data.is_balanced ? '#bbf7d0' : '#fecaca'}`,
            color: data.is_balanced ? '#166534' : '#991b1b',
          }}>
            {data.is_balanced
              ? `Books are balanced. ${data.account_count} accounts with activity.`
              : `WARNING: Books are NOT balanced! Difference: ${fmt(data.difference)} OMR`}
          </div>

          {/* Grouped account tables */}
          {sortedTypes.map(type => {
            const accounts = grouped[type];
            const color = TYPE_COLORS[type] || '#6b7280';
            const groupDebit = accounts.reduce((s, a) => s + a.debit, 0);
            const groupCredit = accounts.reduce((s, a) => s + a.credit, 0);

            return (
              <div key={type} style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', marginBottom: 16, overflow: 'hidden' }}>
                <div style={{ padding: '10px 16px', background: `${color}08`, borderBottom: `2px solid ${color}30`, fontWeight: 700, fontSize: 14, color }}>
                  {type} Accounts ({accounts.length})
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={thStyle}>Code</th>
                      <th style={thStyle}>Account Name</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Debit (OMR)</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Credit (OMR)</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Net Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map(a => (
                      <tr key={a.code} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ ...tdStyle, fontFamily: 'var(--ds-font-mono)', fontSize: 11, color: '#6b7280' }}>{a.code}</td>
                        <td style={tdStyle}>{a.name}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'var(--ds-font-mono)' }}>{fmt(a.debit)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'var(--ds-font-mono)' }}>{fmt(a.credit)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'var(--ds-font-mono)', fontWeight: 600, color: a.net_balance < 0 ? '#dc2626' : '#0c4a6e' }}>
                          {fmt(a.net_balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: `${color}08`, borderTop: `2px solid ${color}30` }}>
                      <td colSpan={2} style={{ ...tdStyle, fontWeight: 700 }}>Subtotal — {type}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'var(--ds-font-mono)', fontWeight: 700 }}>{fmt(groupDebit)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'var(--ds-font-mono)', fontWeight: 700 }}>{fmt(groupCredit)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'var(--ds-font-mono)', fontWeight: 700 }}>{fmt(groupDebit - groupCredit)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            );
          })}

          {/* Grand totals */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, padding: '16px 20px', background: '#eff6ff', borderRadius: 10, border: '1px solid #bfdbfe', textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: '#0369a1', fontWeight: 600 }}>Total Debits</div>
              <div style={{ fontSize: 24, fontWeight: 800, fontFamily: 'var(--ds-font-mono)', color: '#0c4a6e' }}>{fmt(data.total_debit)} OMR</div>
            </div>
            <div style={{ flex: 1, padding: '16px 20px', background: '#faf5ff', borderRadius: 10, border: '1px solid #e9d5ff', textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: '#7c3aed', fontWeight: 600 }}>Total Credits</div>
              <div style={{ fontSize: 24, fontWeight: 800, fontFamily: 'var(--ds-font-mono)', color: '#581c87' }}>{fmt(data.total_credit)} OMR</div>
            </div>
            <div style={{
              flex: 1, padding: '16px 20px', borderRadius: 10, textAlign: 'center',
              background: data.is_balanced ? '#f0fdf4' : '#fef2f2',
              border: `1px solid ${data.is_balanced ? '#bbf7d0' : '#fecaca'}`,
            }}>
              <div style={{ fontSize: 12, color: data.is_balanced ? '#166534' : '#991b1b', fontWeight: 600 }}>Difference</div>
              <div style={{ fontSize: 24, fontWeight: 800, fontFamily: 'var(--ds-font-mono)', color: data.is_balanced ? '#166534' : '#991b1b' }}>
                {fmt(data.difference)} OMR
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const thStyle = { padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#374151', borderBottom: '2px solid #e5e7eb' };
const tdStyle = { padding: '7px 12px' };

export default TrialBalance;
