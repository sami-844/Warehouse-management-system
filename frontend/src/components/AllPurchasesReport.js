import LoadingSpinner from './LoadingSpinner';
import React, { useState, useEffect } from 'react';
import { reportsAPI } from '../services/api';
import './AdminPanel.css';
import { Truck } from 'lucide-react';

function AllPurchasesReport() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('invoices'); // invoices | vendors
  const [fromDate, setFromDate] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10));
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => { load(); }, [fromDate, toDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = async () => {
    setLoading(true);
    try {
      const d = await reportsAPI.allPurchases({ from_date: fromDate, to_date: toDate });
      setData(d);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fmt = (v) => (Number(v) || 0).toFixed(3);

  const statusColor = (s) => ({
    paid: '#16a34a', partial: '#d97706', pending: '#3b82f6', unpaid: '#dc2626', overdue: '#dc2626',
  }[s] || '#6b7280');

  return (
    <div className="admin-container">
      <div className="page-header">
        <div className="header-content">
          <div className="header-icon"><Truck size={20} /></div>
          <div><h1>All Purchases Report</h1><p>Purchase invoices and vendor summary</p></div>
        </div>
      </div>

      <div className="filter-bar" style={{ marginBottom: 16 }}>
        <label>From:</label>
        <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="filter-input" />
        <label>To:</label>
        <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="filter-input" />
        <button className="action-btn primary" onClick={load}>Refresh</button>
      </div>

      {loading ? <LoadingSpinner text="Loading purchases report..." /> : !data ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>No data available</div>
      ) : (
        <>
          {/* KPI Cards */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            <div style={{ padding: '12px 20px', background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca', flex: 1, minWidth: 150 }}>
              <div style={{ fontSize: 11, color: '#dc2626', fontWeight: 600 }}>Total Purchases</div>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--ds-font-mono)', color: '#991b1b' }}>{fmt(data.total_purchases)} OMR</div>
              <div style={{ fontSize: 10, color: '#6b7280' }}>{data.invoice_count} invoices</div>
            </div>
            <div style={{ padding: '12px 20px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0', flex: 1, minWidth: 150 }}>
              <div style={{ fontSize: 11, color: '#15803d', fontWeight: 600 }}>Total Paid</div>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--ds-font-mono)', color: '#166534' }}>{fmt(data.total_paid)} OMR</div>
            </div>
            <div style={{ padding: '12px 20px', background: '#fff7ed', borderRadius: 8, border: '1px solid #fed7aa', flex: 1, minWidth: 150 }}>
              <div style={{ fontSize: 11, color: '#c2410c', fontWeight: 600 }}>Total Due</div>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--ds-font-mono)', color: '#9a3412' }}>{fmt(data.total_due)} OMR</div>
            </div>
          </div>

          {/* Tab switcher */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
            {['invoices', 'vendors'].map(t => (
              <button key={t} onClick={() => setTab(t)}
                style={{
                  padding: '8px 20px', borderRadius: 6, border: '1px solid #e2e8f0',
                  background: tab === t ? '#1e40af' : '#fff', color: tab === t ? '#fff' : '#374151',
                  fontWeight: 600, fontSize: 13, cursor: 'pointer',
                }}>{t === 'invoices' ? 'Invoice Detail' : 'Vendor Summary'}</button>
            ))}
          </div>

          {tab === 'invoices' ? (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th><th>Invoice</th><th>Date</th><th>Vendor</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                    <th style={{ textAlign: 'right' }}>Paid</th>
                    <th style={{ textAlign: 'right' }}>Balance</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data?.length === 0 ? (
                    <tr><td colSpan="8" className="no-data">No purchase invoices for this period</td></tr>
                  ) : data.data?.map((r, i) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td style={{ fontFamily: 'var(--ds-font-mono)', fontSize: 12 }}>{r.invoice}</td>
                      <td>{r.date}</td>
                      <td>{r.vendor}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)' }}>{fmt(r.total)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)', color: '#16a34a' }}>{fmt(r.paid)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)', fontWeight: 600, color: r.balance > 0 ? '#dc2626' : '#16a34a' }}>
                        {fmt(r.balance)}
                      </td>
                      <td>
                        <span style={{
                          background: statusColor(r.status), color: '#fff',
                          padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                        }}>{r.status}</span>
                      </td>
                    </tr>
                  ))}
                  {data.data?.length > 0 && (
                    <tr style={{ fontWeight: 700, background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
                      <td colSpan="4" style={{ textAlign: 'right' }}>Totals:</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)' }}>{fmt(data.total_purchases)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)', color: '#16a34a' }}>{fmt(data.total_paid)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)', color: '#dc2626' }}>{fmt(data.total_due)}</td>
                      <td></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th><th>Code</th><th>Vendor</th>
                    <th style={{ textAlign: 'center' }}>Invoices</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                    <th style={{ textAlign: 'right' }}>Paid</th>
                    <th style={{ textAlign: 'right' }}>Due</th>
                  </tr>
                </thead>
                <tbody>
                  {data.vendor_summary?.length === 0 ? (
                    <tr><td colSpan="7" className="no-data">No vendor data for this period</td></tr>
                  ) : data.vendor_summary?.map((r, i) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td style={{ fontFamily: 'var(--ds-font-mono)', fontSize: 11 }}>{r.code}</td>
                      <td style={{ fontWeight: 500 }}>{r.name}</td>
                      <td style={{ textAlign: 'center' }}>{r.invoice_count}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)' }}>{fmt(r.total)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)', color: '#16a34a' }}>{fmt(r.paid)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)', fontWeight: 600, color: r.due > 0 ? '#dc2626' : '#16a34a' }}>
                        {fmt(r.due)}
                      </td>
                    </tr>
                  ))}
                  {data.vendor_summary?.length > 0 && (
                    <tr style={{ fontWeight: 700, background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
                      <td colSpan="4" style={{ textAlign: 'right' }}>Totals:</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)' }}>{fmt(data.total_purchases)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)', color: '#16a34a' }}>{fmt(data.total_paid)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)', color: '#dc2626' }}>{fmt(data.total_due)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default AllPurchasesReport;
