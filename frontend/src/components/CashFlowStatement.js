import React, { useState, useEffect } from 'react';
import { reportsAPI } from '../services/api';
import LoadingSpinner from './LoadingSpinner';
import './AdminPanel.css';
import { Banknote } from 'lucide-react';

function CashFlowStatement() {
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
      const d = await reportsAPI.cashFlow({ from_date: fromDate, to_date: toDate });
      setData(d);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fmt = (v) => (Number(v) || 0).toFixed(3);

  const renderSection = (title, section, color) => (
    <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', marginBottom: 16, overflow: 'hidden' }}>
      <div style={{
        padding: '10px 16px', background: `${color}08`,
        borderBottom: `2px solid ${color}30`, fontWeight: 700, fontSize: 14, color,
        display: 'flex', justifyContent: 'space-between',
      }}>
        <span>{title}</span>
        <span style={{ fontFamily: 'var(--ds-font-mono)' }}>{fmt(section.total)} OMR</span>
      </div>
      {section.items.length === 0 ? (
        <div style={{ padding: '12px 16px', fontSize: 13, color: '#6b7280' }}>No transactions</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              <th style={thStyle}>Date</th>
              <th style={{ ...thStyle, width: '50%' }}>Description</th>
              <th style={thStyle}>Type</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Amount (OMR)</th>
            </tr>
          </thead>
          <tbody>
            {section.items.map((item, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ ...tdStyle, fontFamily: 'var(--ds-font-mono)', fontSize: 11, color: '#6b7280' }}>{item.date}</td>
                <td style={{ ...tdStyle, fontSize: 12 }}>{item.description || '--'}</td>
                <td style={tdStyle}>
                  <span style={{ padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: '#f1f5f9', color: '#475569' }}>
                    {(item.reference_type || '').replace(/_/g, ' ')}
                  </span>
                </td>
                <td style={{
                  ...tdStyle, textAlign: 'right', fontFamily: 'var(--ds-font-mono)', fontWeight: 600,
                  color: item.amount >= 0 ? '#16a34a' : '#dc2626',
                }}>
                  {item.amount >= 0 ? '+' : ''}{fmt(item.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  return (
    <div className="admin-container">
      <div className="page-header">
        <div className="header-content">
          <div className="header-icon finance"><Banknote size={20} /></div>
          <div><h1>Cash Flow Statement</h1><p>Cash inflows and outflows by activity</p></div>
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

      {loading ? <LoadingSpinner text="Generating cash flow statement..." /> : !data ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>No data available</div>
      ) : (
        <>
          {renderSection('Operating Activities', data.operating, '#0369a1')}
          {renderSection('Investing Activities', data.investing, '#7c3aed')}
          {renderSection('Financing Activities', data.financing, '#d97706')}

          {/* Cash Summary */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8 }}>
            <div style={{ flex: 1, padding: '16px 20px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0', textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>Opening Cash Balance</div>
              <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--ds-font-mono)', color: '#0c4a6e', marginTop: 4 }}>
                {fmt(data.opening_cash_balance)} OMR
              </div>
            </div>
            <div style={{
              flex: 1, padding: '16px 20px', borderRadius: 10, textAlign: 'center',
              background: data.net_change_in_cash >= 0 ? '#f0fdf4' : '#fef2f2',
              border: `1px solid ${data.net_change_in_cash >= 0 ? '#bbf7d0' : '#fecaca'}`,
            }}>
              <div style={{ fontSize: 12, color: data.net_change_in_cash >= 0 ? '#166534' : '#991b1b', fontWeight: 600 }}>Net Change in Cash</div>
              <div style={{
                fontSize: 22, fontWeight: 800, fontFamily: 'var(--ds-font-mono)', marginTop: 4,
                color: data.net_change_in_cash >= 0 ? '#166534' : '#991b1b',
              }}>
                {data.net_change_in_cash >= 0 ? '+' : ''}{fmt(data.net_change_in_cash)} OMR
              </div>
            </div>
            <div style={{ flex: 1, padding: '16px 20px', background: '#eff6ff', borderRadius: 10, border: '1px solid #bfdbfe', textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: '#0369a1', fontWeight: 600 }}>Closing Cash Balance</div>
              <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--ds-font-mono)', color: '#0c4a6e', marginTop: 4 }}>
                {fmt(data.closing_cash_balance)} OMR
              </div>
            </div>
          </div>

          {/* Breakdown summary */}
          <div style={{ marginTop: 16, background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <div style={{ padding: '10px 16px', background: '#f8fafc', borderBottom: '2px solid #e5e7eb', fontWeight: 700, fontSize: 14, color: '#374151' }}>
              Summary
            </div>
            {[
              { label: 'Cash from Operating Activities', value: data.operating.total, color: '#0369a1' },
              { label: 'Cash from Investing Activities', value: data.investing.total, color: '#7c3aed' },
              { label: 'Cash from Financing Activities', value: data.financing.total, color: '#d97706' },
            ].map((row, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', padding: '10px 16px',
                borderBottom: '1px solid #f1f5f9', fontSize: 13,
              }}>
                <span style={{ color: row.color, fontWeight: 600 }}>{row.label}</span>
                <span style={{
                  fontFamily: 'var(--ds-font-mono)', fontWeight: 600,
                  color: row.value >= 0 ? '#16a34a' : '#dc2626',
                }}>
                  {row.value >= 0 ? '+' : ''}{fmt(row.value)} OMR
                </span>
              </div>
            ))}
            <div style={{
              display: 'flex', justifyContent: 'space-between', padding: '12px 16px',
              background: '#f8fafc', borderTop: '2px solid #e5e7eb', fontWeight: 800, fontSize: 14,
            }}>
              <span>Net Change in Cash</span>
              <span style={{
                fontFamily: 'var(--ds-font-mono)',
                color: data.net_change_in_cash >= 0 ? '#166534' : '#991b1b',
              }}>
                {data.net_change_in_cash >= 0 ? '+' : ''}{fmt(data.net_change_in_cash)} OMR
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const thStyle = { padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#374151', borderBottom: '2px solid #e5e7eb' };
const tdStyle = { padding: '7px 12px' };

export default CashFlowStatement;
