import LoadingSpinner from './LoadingSpinner';
import React, { useState, useEffect } from 'react';
import { reportsAPI } from '../services/api';
import './AdminPanel.css';
import { Users } from 'lucide-react';

function CustomerSalesSummary() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10));
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => { load(); }, [fromDate, toDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = async () => {
    setLoading(true);
    try {
      const d = await reportsAPI.customerSalesSummary({ from_date: fromDate, to_date: toDate });
      setData(d);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fmt = (v) => (Number(v) || 0).toFixed(3);

  return (
    <div className="admin-container">
      <div className="page-header">
        <div className="header-content">
          <div className="header-icon"><Users size={20} /></div>
          <div><h1>Customer Sales Summary</h1><p>Sales totals per customer</p></div>
        </div>
      </div>

      <div className="filter-bar" style={{ marginBottom: 16 }}>
        <label>From:</label>
        <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="filter-input" />
        <label>To:</label>
        <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="filter-input" />
        <button className="action-btn primary" onClick={load}>Refresh</button>
      </div>

      {loading ? <LoadingSpinner text="Loading customer summary..." /> : !data ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>No data available</div>
      ) : (
        <>
          {/* KPI Cards */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            <div style={{ padding: '12px 20px', background: '#f0f9ff', borderRadius: 8, border: '1px solid #bae6fd', flex: 1, minWidth: 150 }}>
              <div style={{ fontSize: 11, color: '#0369a1', fontWeight: 600 }}>Total Customers</div>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--ds-font-mono)', color: '#0c4a6e' }}>{data.customer_count}</div>
            </div>
            <div style={{ padding: '12px 20px', background: '#eff6ff', borderRadius: 8, border: '1px solid #bfdbfe', flex: 1, minWidth: 150 }}>
              <div style={{ fontSize: 11, color: '#1e40af', fontWeight: 600 }}>Total Invoiced</div>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--ds-font-mono)', color: '#1e3a5f' }}>{fmt(data.grand_invoiced)} OMR</div>
            </div>
            <div style={{ padding: '12px 20px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0', flex: 1, minWidth: 150 }}>
              <div style={{ fontSize: 11, color: '#15803d', fontWeight: 600 }}>Total Paid</div>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--ds-font-mono)', color: '#166534' }}>{fmt(data.grand_paid)} OMR</div>
            </div>
            <div style={{ padding: '12px 20px', background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca', flex: 1, minWidth: 150 }}>
              <div style={{ fontSize: 11, color: '#dc2626', fontWeight: 600 }}>Total Due</div>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--ds-font-mono)', color: '#991b1b' }}>{fmt(data.grand_due)} OMR</div>
            </div>
          </div>

          {/* Customer table */}
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th><th>Code</th><th>Customer</th><th>Area</th>
                  <th style={{ textAlign: 'center' }}>Invoices</th>
                  <th style={{ textAlign: 'right' }}>Invoiced</th>
                  <th style={{ textAlign: 'right' }}>Paid</th>
                  <th style={{ textAlign: 'right' }}>Due</th>
                </tr>
              </thead>
              <tbody>
                {data.data?.length === 0 ? (
                  <tr><td colSpan="8" className="no-data">No customer data for this period</td></tr>
                ) : data.data?.map((r, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td style={{ fontFamily: 'var(--ds-font-mono)', fontSize: 11 }}>{r.code}</td>
                    <td style={{ fontWeight: 500 }}>{r.name}</td>
                    <td style={{ color: '#6b7280', fontSize: 12 }}>{r.area}</td>
                    <td style={{ textAlign: 'center' }}>{r.invoice_count}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)' }}>{fmt(r.total_invoiced)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)', color: '#16a34a' }}>{fmt(r.total_paid)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)', fontWeight: 600, color: r.total_due > 0 ? '#dc2626' : '#16a34a' }}>
                      {fmt(r.total_due)}
                    </td>
                  </tr>
                ))}
                {data.data?.length > 0 && (
                  <tr style={{ fontWeight: 700, background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
                    <td colSpan="5" style={{ textAlign: 'right' }}>Totals:</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)' }}>{fmt(data.grand_invoiced)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)', color: '#16a34a' }}>{fmt(data.grand_paid)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)', color: '#dc2626' }}>{fmt(data.grand_due)}</td>
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

export default CustomerSalesSummary;
