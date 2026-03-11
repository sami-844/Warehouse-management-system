import LoadingSpinner from './LoadingSpinner';
import React, { useState, useEffect } from 'react';
import { reportsAPI } from '../services/api';
import './AdminPanel.css';
import { Scale } from 'lucide-react';

function BalanceSheet() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => { load(); }, [asOfDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = async () => {
    setLoading(true);
    try {
      const d = await reportsAPI.balanceSheet({ as_of_date: asOfDate });
      setData(d);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fmt = (v) => (Number(v) || 0).toFixed(3);

  const renderSection = (title, items, total, color) => (
    <div style={{
      flex: 1, minWidth: 280, background: '#fff', borderRadius: 10,
      border: `1px solid ${color}20`, overflow: 'hidden',
    }}>
      <div style={{
        padding: '12px 16px', background: `${color}08`,
        borderBottom: `2px solid ${color}30`, fontWeight: 700, fontSize: 15, color,
      }}>{title}</div>
      <div style={{ padding: '8px 0' }}>
        {items.map((item, i) => (
          <div key={i} style={{
            display: 'flex', justifyContent: 'space-between', padding: '8px 16px',
            borderBottom: '1px solid #f1f5f9', fontSize: 13,
          }}>
            <span>
              <span style={{ fontFamily: 'var(--ds-font-mono)', fontSize: 11, color: '#6b7280', marginRight: 8 }}>{item.code}</span>
              {item.name}
            </span>
            <span style={{ fontFamily: 'var(--ds-font-mono)', fontWeight: 600, color: item.balance < 0 ? '#dc2626' : '#0c4a6e' }}>
              {fmt(item.balance)}
            </span>
          </div>
        ))}
      </div>
      <div style={{
        display: 'flex', justifyContent: 'space-between', padding: '12px 16px',
        background: `${color}08`, borderTop: `2px solid ${color}30`,
        fontWeight: 700, fontSize: 14,
      }}>
        <span>Total {title}</span>
        <span style={{ fontFamily: 'var(--ds-font-mono)', color }}>{fmt(total)}</span>
      </div>
    </div>
  );

  return (
    <div className="admin-container">
      <div className="page-header">
        <div className="header-content">
          <div className="header-icon finance"><Scale size={20} /></div>
          <div><h1>Balance Sheet</h1><p>Assets = Liabilities + Equity</p></div>
        </div>
      </div>

      <div className="filter-bar" style={{ marginBottom: 16 }}>
        <label style={{ fontWeight: 600, fontSize: 13 }}>As at:</label>
        <input type="date" value={asOfDate} onChange={e => setAsOfDate(e.target.value)} className="filter-input" />
        <button className="action-btn primary" onClick={load}>Refresh</button>
      </div>

      {loading ? <LoadingSpinner text="Generating balance sheet..." /> : !data ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>No data available</div>
      ) : (
        <>
          {/* Balance check banner */}
          <div style={{
            padding: '10px 16px', borderRadius: 8, marginBottom: 16, fontSize: 13, fontWeight: 600,
            background: data.is_balanced ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${data.is_balanced ? '#bbf7d0' : '#fecaca'}`,
            color: data.is_balanced ? '#166534' : '#991b1b',
          }}>
            {data.is_balanced
              ? `Balanced: Assets (${fmt(data.total_assets)}) = Liabilities + Equity (${fmt(data.total_liabilities_equity)})`
              : `Unbalanced: Assets (${fmt(data.total_assets)}) != Liabilities + Equity (${fmt(data.total_liabilities_equity)})`}
          </div>

          {/* Three columns */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {renderSection('Assets', data.assets, data.total_assets, '#0369a1')}
            {renderSection('Liabilities', data.liabilities, data.total_liabilities, '#dc2626')}
            {renderSection('Equity', data.equity, data.total_equity, '#7c3aed')}
          </div>

          {/* Footer totals */}
          <div style={{
            display: 'flex', gap: 16, marginTop: 20, flexWrap: 'wrap',
          }}>
            <div style={{
              flex: 1, padding: '16px 20px', background: '#eff6ff', borderRadius: 10,
              border: '1px solid #bfdbfe', textAlign: 'center',
            }}>
              <div style={{ fontSize: 12, color: '#0369a1', fontWeight: 600 }}>Total Assets</div>
              <div style={{ fontSize: 24, fontWeight: 800, fontFamily: 'var(--ds-font-mono)', color: '#0c4a6e' }}>
                {fmt(data.total_assets)} OMR
              </div>
            </div>
            <div style={{
              flex: 1, padding: '16px 20px', background: '#faf5ff', borderRadius: 10,
              border: '1px solid #e9d5ff', textAlign: 'center',
            }}>
              <div style={{ fontSize: 12, color: '#7c3aed', fontWeight: 600 }}>Total Liabilities + Equity</div>
              <div style={{ fontSize: 24, fontWeight: 800, fontFamily: 'var(--ds-font-mono)', color: '#581c87' }}>
                {fmt(data.total_liabilities_equity)} OMR
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default BalanceSheet;
