import React, { useState, useEffect } from 'react';
import LoadingSpinner from './LoadingSpinner';
import { financialAPI, bankAccountsAPI } from '../services/api';
import './AdminPanel.css';
import { TrendingUp, Banknote, Landmark, CreditCard, Smartphone } from 'lucide-react';

function FinancialDashboard() {
  const [data, setData] = useState(null);
  const [pnl, setPnl] = useState(null);
  const [pnlPeriod, setPnlPeriod] = useState('month');
  const [loading, setLoading] = useState(true);
  const [wallets, setWallets] = useState([]);

  useEffect(() => { load(); }, []);
  useEffect(() => { loadPnl(); }, [pnlPeriod]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = async () => {
    setLoading(true);
    try {
      const [dashData, walletData] = await Promise.all([
        financialAPI.dashboard(),
        bankAccountsAPI.list().catch(() => ({ accounts: [] })),
      ]);
      setData(dashData);
      setWallets(walletData.accounts || []);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  };
  const loadPnl = async () => { try { setPnl(await financialAPI.profitLoss({ period: pnlPeriod })); } catch(e) { console.error(e); } };

  const walletIcon = (type) => {
    const icons = { cash: Banknote, bank: Landmark, credit_card: CreditCard, mobile_wallet: Smartphone };
    const I = icons[type] || Landmark;
    return <I size={18} />;
  };
  const walletColor = (type) => ({
    cash: { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534' },
    bank: { bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af' },
    credit_card: { bg: '#fdf4ff', border: '#e9d5ff', text: '#7e22ce' },
    mobile_wallet: { bg: '#fff7ed', border: '#fed7aa', text: '#c2410c' },
  }[type] || { bg: '#f8fafc', border: '#e2e8f0', text: '#334155' });

  if (loading || !data) return <div className="admin-container"><LoadingSpinner text="Loading financial data..." /></div>;

  // Safe number formatter — prevents .toFixed() crash on null/undefined
  const n = (v) => (Number(v) || 0).toFixed(3);
  const n0 = (v) => (Number(v) || 0).toFixed(0);

  const trend = Array.isArray(data.monthly_trend) ? data.monthly_trend : [];
  const maxTrend = Math.max(...trend.map(m => Math.max(Number(m.sales) || 0, Number(m.purchases) || 0, 0)), 1);
  const topCustomers = Array.isArray(data.top_customers) ? data.top_customers : [];
  const topProducts = Array.isArray(data.top_products) ? data.top_products : [];
  const netPos = Number(data.net_position) || 0;
  const grossProfit = Number(data.gross_profit_month) || 0;

  return (
    <div className="admin-container">
      <div className="page-header"><div className="header-content"><div className="header-icon finance"><TrendingUp size={20} /></div><div><h1>Financial Dashboard</h1><p>Business overview at a glance</p></div></div></div>

      {/* My Wallets */}
      {wallets.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#334155', marginBottom: 10 }}>My Wallets</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {/* Total */}
            <div style={{
              padding: '14px 20px', background: '#0c4a6e', borderRadius: 10,
              minWidth: 160, flex: '0 0 auto', color: '#fff',
            }}>
              <div style={{ fontSize: 11, opacity: 0.7, fontWeight: 600 }}>Total Balance</div>
              <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--ds-font-mono)' }}>
                {n(wallets.reduce((s, w) => s + (Number(w.current_balance) || 0), 0))}
              </div>
              <div style={{ fontSize: 11, opacity: 0.6 }}>OMR across {wallets.length} account{wallets.length > 1 ? 's' : ''}</div>
            </div>
            {/* Individual accounts */}
            {wallets.map(w => {
              const wc = walletColor(w.account_type);
              return (
                <div key={w.id} style={{
                  padding: '14px 20px', background: wc.bg, borderRadius: 10,
                  border: `1px solid ${wc.border}`, minWidth: 160, flex: '1 1 auto',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ color: wc.text }}>{walletIcon(w.account_type)}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: wc.text }}>{w.account_name}</span>
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'var(--ds-font-mono)', color: '#0c4a6e' }}>
                    {n(w.current_balance)}
                  </div>
                  <div style={{ fontSize: 10, color: '#6b7280' }}>{w.currency || 'OMR'}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card receivable">
          <div className="kpi-icon"></div>
          <div className="kpi-body"><div className="kpi-label">Receivables</div><div className="kpi-value">{n(data.receivables)}</div><div className="kpi-sub">OMR owed by customers</div></div>
        </div>
        <div className="kpi-card payable">
          <div className="kpi-icon"></div>
          <div className="kpi-body"><div className="kpi-label">Payables</div><div className="kpi-value">{n(data.payables)}</div><div className="kpi-sub">OMR owed to suppliers</div></div>
        </div>
        <div className="kpi-card net">
          <div className="kpi-icon"></div>
          <div className="kpi-body"><div className="kpi-label">Net Position</div><div className={`kpi-value ${netPos >= 0 ? 'positive' : 'negative'}`}>{n(netPos)}</div><div className="kpi-sub">Receivables − Payables</div></div>
        </div>
        <div className="kpi-card sales">
          <div className="kpi-icon"></div>
          <div className="kpi-body"><div className="kpi-label">Sales This Month</div><div className="kpi-value">{n(data.sales?.month)}</div><div className="kpi-sub">{data.sales?.orders_month || 0} orders</div></div>
        </div>
        <div className="kpi-card profit">
          <div className="kpi-icon"></div>
          <div className="kpi-body"><div className="kpi-label">Gross Profit (Month)</div><div className={`kpi-value ${grossProfit >= 0 ? 'positive' : 'negative'}`}>{n(grossProfit)}</div><div className="kpi-sub">{data.margin_pct || 0}% margin</div></div>
        </div>
        <div className="kpi-card stock">
          <div className="kpi-icon"></div>
          <div className="kpi-body"><div className="kpi-label">Stock Value</div><div className="kpi-value">{n(data.stock_value)}</div><div className="kpi-sub">OMR at cost</div></div>
        </div>
      </div>

      {/* Cash Flow */}
      <div className="section-row">
        <div className="section-card cash-flow">
          <h3>Cash Flow This Month</h3>
          <div className="cash-flow-bar">
            <div className="cf-row"><span className="cf-label">Money In (Collections)</span><div className="cf-bar-wrap"><div className="cf-bar in" style={{width: `${Math.min((Number(data.cash_flow?.month?.in)||0) / Math.max(Number(data.cash_flow?.month?.in)||0, Number(data.cash_flow?.month?.out)||0, 1) * 100, 100)}%`}} /><span className="cf-amount positive">{n(data.cash_flow?.month?.in)}</span></div></div>
            <div className="cf-row"><span className="cf-label">Money Out (Payments)</span><div className="cf-bar-wrap"><div className="cf-bar out" style={{width: `${Math.min((Number(data.cash_flow?.month?.out)||0) / Math.max(Number(data.cash_flow?.month?.in)||0, Number(data.cash_flow?.month?.out)||0, 1) * 100, 100)}%`}} /><span className="cf-amount negative">{n(data.cash_flow?.month?.out)}</span></div></div>
            <div className="cf-net"><span>Net Cash Flow</span><span className={(Number(data.cash_flow?.month?.net)||0) >= 0 ? 'positive' : 'negative'}>{n(data.cash_flow?.month?.net)} OMR</span></div>
          </div>
        </div>

        {/* P&L Summary */}
        <div className="section-card pnl">
          <div className="pnl-header"><h3>Profit & Loss</h3>
            <div className="period-tabs">
              {['month', 'quarter', 'year'].map(p => (
                <button key={p} className={`period-btn ${pnlPeriod === p ? 'active' : ''}`} onClick={() => setPnlPeriod(p)}>{p.charAt(0).toUpperCase() + p.slice(1)}</button>
              ))}
            </div>
          </div>
          {pnl && (
            <div className="pnl-body">
              <div className="pnl-line"><span>Revenue</span><span className="val">{n(pnl.revenue)}</span></div>
              <div className="pnl-line sub"><span>Cost of Goods Sold</span><span className="val negative">({n(pnl.cost_of_goods_sold)})</span></div>
              <div className="pnl-line sub"><span>Discounts Given</span><span className="val negative">({n(pnl.discounts_given)})</span></div>
              <div className="pnl-line bold"><span>Gross Profit</span><span className={`val ${(Number(pnl.gross_profit)||0) >= 0 ? 'positive' : 'negative'}`}>{n(pnl.gross_profit)}</span></div>
              <div className="pnl-line sub"><span>Freight & Customs</span><span className="val negative">({n(pnl.operating_expenses?.freight_customs)})</span></div>
              <div className="pnl-line grand"><span>Net Profit</span><span className={`val ${(Number(pnl.net_profit)||0) >= 0 ? 'positive' : 'negative'}`}>{n(pnl.net_profit)} OMR</span></div>
              <div className="pnl-margin">Gross Margin: {pnl.gross_margin_pct || 0}% — Net Margin: {pnl.net_margin_pct || 0}%</div>
            </div>
          )}
        </div>
      </div>

      {/* Monthly Trend Chart (CSS bars) */}
      <div className="section-card">
        <h3>Monthly Sales vs Purchases (12 months)</h3>
        <div className="trend-chart">
          {trend.map((m, idx) => (
            <div key={idx} className="trend-month">
              <div className="trend-bars">
                <div className="trend-bar sales" style={{height: `${((Number(m.sales)||0) / maxTrend) * 120}px`}} title={`Sales: ${n0(m.sales)}`} />
                <div className="trend-bar purchases" style={{height: `${((Number(m.purchases)||0) / maxTrend) * 120}px`}} title={`Purchases: ${n0(m.purchases)}`} />
              </div>
              <div className="trend-label">{(m.month || '').slice(5)}</div>
            </div>
          ))}
        </div>
        <div className="trend-legend"><span className="legend-dot sales" /> Sales <span className="legend-dot purchases" /> Purchases</div>
      </div>

      {/* Top Customers & Products */}
      <div className="section-row">
        <div className="section-card">
          <h3>Top 10 Customers by Revenue</h3>
          <table className="data-table compact">
            <thead><tr><th>Customer</th><th>Area</th><th>Orders</th><th>Revenue</th></tr></thead>
            <tbody>
              {topCustomers.map((c, i) => (
                <tr key={i}><td><span className="rank">#{i+1}</span> {c.name}</td><td><span className="area-badge">{c.area || '-'}</span></td>
                  <td className="center">{c.orders || 0}</td><td className="value">{n(c.revenue)}</td></tr>
              ))}
              {topCustomers.length === 0 && <tr><td colSpan="4" className="no-data">No sales data yet</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="section-card">
          <h3>Top 10 Products by Profit</h3>
          <table className="data-table compact">
            <thead><tr><th>Product</th><th>Margin</th><th>Qty Sold</th><th>Profit</th></tr></thead>
            <tbody>
              {topProducts.map((p, i) => (
                <tr key={i}><td><span className="rank">#{i+1}</span> {p.name}</td>
                  <td><span className={`margin-badge ${(p.margin_pct||0) > 30 ? 'high' : (p.margin_pct||0) > 15 ? 'med' : 'low'}`}>{p.margin_pct || 0}%</span></td>
                  <td className="center">{p.qty_sold || 0}</td><td className="value">{n(p.profit)}</td></tr>
              ))}
              {topProducts.length === 0 && <tr><td colSpan="4" className="no-data">No sales data yet</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
export default FinancialDashboard;
