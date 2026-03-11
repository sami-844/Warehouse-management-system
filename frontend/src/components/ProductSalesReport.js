import LoadingSpinner from './LoadingSpinner';
import React, { useState, useEffect } from 'react';
import { reportsAPI } from '../services/api';
import './AdminPanel.css';
import { Package } from 'lucide-react';

function ProductSalesReport() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10));
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => { load(); }, [fromDate, toDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = async () => {
    setLoading(true);
    try {
      const d = await reportsAPI.productSales({ from_date: fromDate, to_date: toDate });
      setData(d);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fmt = (v) => (Number(v) || 0).toFixed(3);

  return (
    <div className="admin-container">
      <div className="page-header">
        <div className="header-content">
          <div className="header-icon"><Package size={20} /></div>
          <div><h1>Product Sales Report</h1><p>Product-wise sales breakdown</p></div>
        </div>
      </div>

      <div className="filter-bar" style={{ marginBottom: 16 }}>
        <label>From:</label>
        <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="filter-input" />
        <label>To:</label>
        <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="filter-input" />
        <button className="action-btn primary" onClick={load}>Refresh</button>
      </div>

      {loading ? <LoadingSpinner text="Loading product sales..." /> : !data ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>No data available</div>
      ) : (
        <>
          {/* KPI Cards */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            <div style={{ padding: '12px 20px', background: '#f0f9ff', borderRadius: 8, border: '1px solid #bae6fd', flex: 1, minWidth: 150 }}>
              <div style={{ fontSize: 11, color: '#0369a1', fontWeight: 600 }}>Sales Qty</div>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--ds-font-mono)', color: '#0c4a6e' }}>{(data.grand_qty || 0).toLocaleString()}</div>
            </div>
            <div style={{ padding: '12px 20px', background: '#fff7ed', borderRadius: 8, border: '1px solid #fed7aa', flex: 1, minWidth: 150 }}>
              <div style={{ fontSize: 11, color: '#c2410c', fontWeight: 600 }}>Return Qty</div>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--ds-font-mono)', color: '#9a3412' }}>{(data.grand_return_qty || 0).toLocaleString()}</div>
            </div>
            <div style={{ padding: '12px 20px', background: '#faf5ff', borderRadius: 8, border: '1px solid #e9d5ff', flex: 1, minWidth: 150 }}>
              <div style={{ fontSize: 11, color: '#7c3aed', fontWeight: 600 }}>Total Discount</div>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--ds-font-mono)', color: '#581c87' }}>{fmt(data.grand_discount)} OMR</div>
            </div>
            <div style={{ padding: '12px 20px', background: '#eff6ff', borderRadius: 8, border: '1px solid #bfdbfe', flex: 1, minWidth: 150 }}>
              <div style={{ fontSize: 11, color: '#1e40af', fontWeight: 600 }}>Total Amount</div>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--ds-font-mono)', color: '#1e3a5f' }}>{fmt(data.grand_amount)} OMR</div>
            </div>
          </div>

          {/* Products table */}
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th><th>SKU</th><th>Product</th>
                  <th style={{ textAlign: 'right' }}>Qty Sold</th>
                  <th style={{ textAlign: 'right' }}>Returned</th>
                  <th style={{ textAlign: 'right' }}>Cost</th>
                  <th style={{ textAlign: 'right' }}>Discount</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                  <th style={{ textAlign: 'right' }}>Profit</th>
                </tr>
              </thead>
              <tbody>
                {data.data?.length === 0 ? (
                  <tr><td colSpan="9" className="no-data">No product sales for this period</td></tr>
                ) : data.data?.map((r, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td style={{ fontFamily: 'var(--ds-font-mono)', fontSize: 11 }}>{r.sku}</td>
                    <td style={{ fontWeight: 500 }}>{r.name}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)' }}>{r.sales_qty}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)', color: r.return_qty > 0 ? '#dc2626' : '#9ca3af' }}>
                      {r.return_qty || 0}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)', color: '#6b7280' }}>{fmt(r.total_cost)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)', color: '#7c3aed' }}>{fmt(r.total_discount)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)', fontWeight: 600 }}>{fmt(r.total_amount)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)', fontWeight: 600, color: r.profit >= 0 ? '#16a34a' : '#dc2626' }}>
                      {fmt(r.profit)}
                    </td>
                  </tr>
                ))}
                {data.data?.length > 0 && (
                  <tr style={{ fontWeight: 700, background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
                    <td colSpan="3" style={{ textAlign: 'right' }}>Totals:</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)' }}>{data.grand_qty}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)' }}>{data.grand_return_qty}</td>
                    <td></td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)', color: '#7c3aed' }}>{fmt(data.grand_discount)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)' }}>{fmt(data.grand_amount)}</td>
                    <td></td>
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

export default ProductSalesReport;
