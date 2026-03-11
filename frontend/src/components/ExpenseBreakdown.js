import LoadingSpinner from './LoadingSpinner';
import React, { useState, useEffect } from 'react';
import { reportsAPI } from '../services/api';
import './AdminPanel.css';
import { Receipt } from 'lucide-react';

function ExpenseBreakdown() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10));
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => { load(); }, [fromDate, toDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = async () => {
    setLoading(true);
    try {
      const d = await reportsAPI.expenseBreakdown({ from_date: fromDate, to_date: toDate });
      setData(d);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fmt = (v) => (Number(v) || 0).toFixed(3);

  const typeColor = (t) => ({
    Expense: '#dc2626', COGS: '#d97706',
  }[t] || '#6b7280');

  return (
    <div className="admin-container">
      <div className="page-header">
        <div className="header-content">
          <div className="header-icon finance"><Receipt size={20} /></div>
          <div><h1>Expense Breakdown</h1><p>Expenses by category from journal entries</p></div>
        </div>
      </div>

      <div className="filter-bar" style={{ marginBottom: 16 }}>
        <label>From:</label>
        <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="filter-input" />
        <label>To:</label>
        <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="filter-input" />
        <button className="action-btn primary" onClick={load}>Refresh</button>
      </div>

      {loading ? <LoadingSpinner text="Loading expense breakdown..." /> : !data ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>No data available</div>
      ) : (
        <>
          {/* KPI Cards */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            <div style={{ padding: '12px 20px', background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca', flex: 1, minWidth: 160 }}>
              <div style={{ fontSize: 11, color: '#dc2626', fontWeight: 600 }}>Operating Expenses</div>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--ds-font-mono)', color: '#991b1b' }}>{fmt(data.total_expenses)} OMR</div>
            </div>
            <div style={{ padding: '12px 20px', background: '#fff7ed', borderRadius: 8, border: '1px solid #fed7aa', flex: 1, minWidth: 160 }}>
              <div style={{ fontSize: 11, color: '#c2410c', fontWeight: 600 }}>Cost of Goods Sold</div>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--ds-font-mono)', color: '#9a3412' }}>{fmt(data.total_cogs)} OMR</div>
            </div>
            <div style={{ padding: '12px 20px', background: '#eff6ff', borderRadius: 8, border: '1px solid #bfdbfe', flex: 1, minWidth: 160 }}>
              <div style={{ fontSize: 11, color: '#1e40af', fontWeight: 600 }}>Grand Total</div>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--ds-font-mono)', color: '#1e3a5f' }}>{fmt(data.grand_total)} OMR</div>
            </div>
          </div>

          {/* Expense table */}
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th><th>Account Code</th><th>Category</th><th>Type</th>
                  <th style={{ textAlign: 'right' }}>Amount (OMR)</th>
                </tr>
              </thead>
              <tbody>
                {data.data?.length === 0 ? (
                  <tr><td colSpan="5" className="no-data">No expenses for this period</td></tr>
                ) : data.data?.map((r, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td style={{ fontFamily: 'var(--ds-font-mono)', fontSize: 11 }}>{r.account_code}</td>
                    <td style={{ fontWeight: 500 }}>{r.account_name}</td>
                    <td>
                      <span style={{
                        background: typeColor(r.account_type), color: '#fff',
                        padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                      }}>{r.account_type}</span>
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)', fontWeight: 600 }}>{fmt(r.amount)}</td>
                  </tr>
                ))}
                {data.data?.length > 0 && (
                  <tr style={{ fontWeight: 700, background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
                    <td colSpan="4" style={{ textAlign: 'right' }}>Grand Total:</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)', color: '#991b1b' }}>{fmt(data.grand_total)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

export default ExpenseBreakdown;
