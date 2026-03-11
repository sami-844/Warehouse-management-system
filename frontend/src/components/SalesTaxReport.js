import LoadingSpinner from './LoadingSpinner';
import React, { useState, useEffect } from 'react';
import { reportsAPI } from '../services/api';
import './AdminPanel.css';
import { Calculator } from 'lucide-react';

function SalesTaxReport() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10));
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => { load(); }, [fromDate, toDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = async () => {
    setLoading(true);
    try {
      const d = await reportsAPI.salesTax({ from_date: fromDate, to_date: toDate });
      setData(d);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fmt = (v) => (Number(v) || 0).toFixed(3);

  return (
    <div className="admin-container">
      <div className="page-header">
        <div className="header-content">
          <div className="header-icon finance"><Calculator size={20} /></div>
          <div><h1>Sales Tax Report</h1><p>VAT summary — output tax vs input tax</p></div>
        </div>
      </div>

      <div className="filter-bar" style={{ marginBottom: 16 }}>
        <label>From:</label>
        <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="filter-input" />
        <label>To:</label>
        <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="filter-input" />
        <button className="action-btn primary" onClick={load}>Refresh</button>
      </div>

      {loading ? <LoadingSpinner text="Loading tax report..." /> : !data ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>No data available</div>
      ) : (
        <>
          {/* KPI Cards */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            <div style={{ padding: '12px 20px', background: '#eff6ff', borderRadius: 8, border: '1px solid #bfdbfe', flex: 1, minWidth: 160 }}>
              <div style={{ fontSize: 11, color: '#1e40af', fontWeight: 600 }}>Total Taxable Sales</div>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--ds-font-mono)', color: '#1e3a5f' }}>{fmt(data.taxable_sales)} OMR</div>
              <div style={{ fontSize: 10, color: '#6b7280' }}>{data.taxable_sales_count} invoices</div>
            </div>
            <div style={{ padding: '12px 20px', background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca', flex: 1, minWidth: 160 }}>
              <div style={{ fontSize: 11, color: '#dc2626', fontWeight: 600 }}>Output VAT (5%)</div>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--ds-font-mono)', color: '#991b1b' }}>{fmt(data.output_vat)} OMR</div>
            </div>
            <div style={{ padding: '12px 20px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0', flex: 1, minWidth: 160 }}>
              <div style={{ fontSize: 11, color: '#15803d', fontWeight: 600 }}>Input VAT</div>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--ds-font-mono)', color: '#166534' }}>{fmt(data.input_vat)} OMR</div>
            </div>
            <div style={{ padding: '12px 20px', background: data.net_vat_payable > 0 ? '#fff7ed' : '#f0fdf4', borderRadius: 8, border: `1px solid ${data.net_vat_payable > 0 ? '#fed7aa' : '#bbf7d0'}`, flex: 1, minWidth: 160 }}>
              <div style={{ fontSize: 11, color: data.net_vat_payable > 0 ? '#c2410c' : '#15803d', fontWeight: 600 }}>Net VAT Payable</div>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--ds-font-mono)', color: data.net_vat_payable > 0 ? '#9a3412' : '#166534' }}>{fmt(data.net_vat_payable)} OMR</div>
            </div>
          </div>

          {/* Tax breakdown table */}
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Category</th><th>Type</th>
                  <th style={{ textAlign: 'center' }}>Invoices</th>
                  <th style={{ textAlign: 'right' }}>Amount (OMR)</th>
                  <th style={{ textAlign: 'right' }}>Tax (OMR)</th>
                </tr>
              </thead>
              <tbody>
                {/* Sales section */}
                <tr style={{ background: '#f0f9ff', fontWeight: 600 }}>
                  <td colSpan="5" style={{ color: '#0369a1' }}>Sales</td>
                </tr>
                <tr>
                  <td>Standard-Rated Sales</td>
                  <td><span style={{ background: '#1e40af', color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>5% VAT</span></td>
                  <td style={{ textAlign: 'center' }}>{data.taxable_sales_count}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)' }}>{fmt(data.taxable_sales)}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)', color: '#dc2626', fontWeight: 600 }}>{fmt(data.output_vat)}</td>
                </tr>
                <tr>
                  <td>Zero-Rated Sales</td>
                  <td><span style={{ background: '#6b7280', color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>0%</span></td>
                  <td style={{ textAlign: 'center' }}>{data.zero_rated_sales_count}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)' }}>{fmt(data.zero_rated_sales)}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)', color: '#9ca3af' }}>0.000</td>
                </tr>
                <tr style={{ fontWeight: 600, background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
                  <td colSpan="3" style={{ textAlign: 'right' }}>Total Sales:</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)' }}>{fmt(data.total_sales)}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)', color: '#dc2626' }}>{fmt(data.output_vat)}</td>
                </tr>

                {/* Purchases section */}
                <tr style={{ background: '#fff7ed', fontWeight: 600 }}>
                  <td colSpan="5" style={{ color: '#c2410c' }}>Purchases</td>
                </tr>
                <tr>
                  <td>Standard-Rated Purchases</td>
                  <td><span style={{ background: '#d97706', color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>5% VAT</span></td>
                  <td style={{ textAlign: 'center' }}>{data.taxable_purchases_count}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)' }}>{fmt(data.taxable_purchases)}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)', color: '#16a34a', fontWeight: 600 }}>{fmt(data.input_vat)}</td>
                </tr>
                <tr>
                  <td>Zero-Rated Purchases</td>
                  <td><span style={{ background: '#6b7280', color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>0%</span></td>
                  <td style={{ textAlign: 'center' }}>{data.zero_rated_purchases_count}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)' }}>{fmt(data.zero_rated_purchases)}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)', color: '#9ca3af' }}>0.000</td>
                </tr>
                <tr style={{ fontWeight: 600, background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
                  <td colSpan="3" style={{ textAlign: 'right' }}>Total Purchases:</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)' }}>{fmt(data.total_purchases)}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)', color: '#16a34a' }}>{fmt(data.input_vat)}</td>
                </tr>

                {/* Net VAT */}
                <tr style={{ fontWeight: 700, background: '#f1f5f9', borderTop: '2px solid #cbd5e1' }}>
                  <td colSpan="4" style={{ textAlign: 'right', fontSize: 14 }}>Net VAT Payable (Output - Input):</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)', fontSize: 16, color: data.net_vat_payable > 0 ? '#dc2626' : '#16a34a' }}>
                    {fmt(data.net_vat_payable)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

export default SalesTaxReport;
