import React, { useState, useEffect } from 'react';
import { accountingAPI } from '../services/api';
import LoadingSpinner from './LoadingSpinner';
import './AdminPanel.css';
import { TrendingUp } from 'lucide-react';

function ProfitLoss() {
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
      const d = await accountingAPI.profitLossDetailed({ from_date: fromDate, to_date: toDate });
      setData(d);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fmt = (v) => (Number(v) || 0).toFixed(3);

  const lineItem = (label, value, opts = {}) => (
    <div style={{
      display: 'flex', justifyContent: 'space-between', padding: '8px 16px',
      borderBottom: '1px solid #f1f5f9', fontSize: 13,
      fontWeight: opts.bold ? 700 : 400,
      background: opts.highlight || 'transparent',
    }}>
      <span style={{ color: opts.labelColor || '#1e293b' }}>{opts.indent ? '    ' : ''}{label}</span>
      <span style={{
        fontFamily: 'var(--ds-font-mono)', fontWeight: 600,
        color: opts.color || (value < 0 ? '#dc2626' : '#0c4a6e'),
      }}>
        {fmt(value)} OMR
      </span>
    </div>
  );

  return (
    <div className="admin-container">
      <div className="page-header">
        <div className="header-content">
          <div className="header-icon finance"><TrendingUp size={20} /></div>
          <div><h1>Profit & Loss Statement</h1><p>Revenue, costs, and net profit for the period</p></div>
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

      {loading ? <LoadingSpinner text="Generating P&L..." /> : !data ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>No data available</div>
      ) : (
        <>
          {/* Revenue Section */}
          <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', marginBottom: 16, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', background: '#f0fdf408', borderBottom: '2px solid #16a34a30', fontWeight: 700, fontSize: 15, color: '#16a34a' }}>
              Revenue
            </div>
            {lineItem('Sales Revenue', data.revenue.sales_revenue)}
            {lineItem('Less: Sales Returns', -data.revenue.sales_returns, { indent: true, color: '#dc2626' })}
            {lineItem('Less: Discounts', -data.revenue.discounts, { indent: true, color: '#dc2626' })}
            {lineItem('Net Sales', data.revenue.net_sales, { bold: true, highlight: '#f8fafc' })}
          </div>

          {/* COGS Section */}
          <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', marginBottom: 16, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', background: '#fef2f208', borderBottom: '2px solid #dc262630', fontWeight: 700, fontSize: 15, color: '#dc2626' }}>
              Cost of Goods Sold
            </div>
            {lineItem('Cost of Goods Sold', data.cogs.cost_of_goods_sold)}
            {lineItem('Purchases Total', data.cogs.purchases_total, { indent: true })}
          </div>

          {/* Gross Profit */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', padding: '14px 16px',
            background: data.gross_profit >= 0 ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${data.gross_profit >= 0 ? '#bbf7d0' : '#fecaca'}`,
            borderRadius: 10, marginBottom: 16, fontWeight: 700, fontSize: 15,
          }}>
            <span style={{ color: '#1e293b' }}>Gross Profit</span>
            <span style={{ fontFamily: 'var(--ds-font-mono)', color: data.gross_profit >= 0 ? '#166534' : '#991b1b' }}>
              {fmt(data.gross_profit)} OMR
              <span style={{ fontSize: 12, fontWeight: 500, marginLeft: 8 }}>({data.gross_margin_pct}%)</span>
            </span>
          </div>

          {/* Operating Expenses */}
          <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', marginBottom: 16, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', background: '#faf5ff08', borderBottom: '2px solid #7c3aed30', fontWeight: 700, fontSize: 15, color: '#7c3aed' }}>
              Operating Expenses
            </div>
            {Object.entries(data.expenses || {}).length === 0 ? (
              <div style={{ padding: '12px 16px', fontSize: 13, color: '#6b7280' }}>No expenses recorded</div>
            ) : (
              Object.entries(data.expenses).map(([name, amount]) => (
                lineItem(name, amount, { key: name })
              ))
            )}
            {lineItem('Total Expenses', data.total_expenses, { bold: true, highlight: '#f8fafc' })}
          </div>

          {/* Net Profit */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', padding: '16px 20px',
            background: data.net_profit >= 0 ? '#f0fdf4' : '#fef2f2',
            border: `2px solid ${data.net_profit >= 0 ? '#16a34a' : '#dc2626'}`,
            borderRadius: 10, marginBottom: 16, fontWeight: 800, fontSize: 18,
          }}>
            <span style={{ color: '#1e293b' }}>Net Profit</span>
            <span style={{ fontFamily: 'var(--ds-font-mono)', color: data.net_profit >= 0 ? '#166534' : '#991b1b' }}>
              {fmt(data.net_profit)} OMR
              <span style={{ fontSize: 13, fontWeight: 500, marginLeft: 8 }}>({data.net_margin_pct}%)</span>
            </span>
          </div>

          {/* Tax Info */}
          <div style={{
            padding: '10px 16px', background: '#fffbeb', border: '1px solid #fde68a',
            borderRadius: 8, fontSize: 13, color: '#92400e',
          }}>
            Tax Collected (VAT): <strong>{fmt(data.tax_collected)} OMR</strong>
          </div>
        </>
      )}
    </div>
  );
}

export default ProfitLoss;
