import React, { useState, useEffect } from 'react';
import { financialAPI } from '../services/api';
import './AdminPanel.css';

function FinancialDashboard() {
  const [data, setData] = useState(null);
  const [pnl, setPnl] = useState(null);
  const [pnlPeriod, setPnlPeriod] = useState('month');
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);
  useEffect(() => { loadPnl(); }, [pnlPeriod]);

  const load = async () => { setLoading(true); try { setData(await financialAPI.dashboard()); } catch(e) { console.error(e); } finally { setLoading(false); } };
  const loadPnl = async () => { try { setPnl(await financialAPI.profitLoss({ period: pnlPeriod })); } catch(e) { console.error(e); } };

  if (loading || !data) return <div className="admin-container"><div className="loading-state">Loading financial data...</div></div>;

  const maxTrend = Math.max(...data.monthly_trend.map(m => Math.max(m.sales, m.purchases)), 1);

  return (
    <div className="admin-container">
      <div className="page-header"><div className="header-content"><div className="header-icon finance">💰</div><div><h1>Financial Dashboard</h1><p>Business overview at a glance</p></div></div></div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card receivable">
          <div className="kpi-icon">📥</div>
          <div className="kpi-body"><div className="kpi-label">Receivables</div><div className="kpi-value">{data.receivables.toFixed(3)}</div><div className="kpi-sub">OMR owed by customers</div></div>
        </div>
        <div className="kpi-card payable">
          <div className="kpi-icon">📤</div>
          <div className="kpi-body"><div className="kpi-label">Payables</div><div className="kpi-value">{data.payables.toFixed(3)}</div><div className="kpi-sub">OMR owed to suppliers</div></div>
        </div>
        <div className="kpi-card net">
          <div className="kpi-icon">⚖️</div>
          <div className="kpi-body"><div className="kpi-label">Net Position</div><div className={`kpi-value ${data.net_position >= 0 ? 'positive' : 'negative'}`}>{data.net_position.toFixed(3)}</div><div className="kpi-sub">Receivables − Payables</div></div>
        </div>
        <div className="kpi-card sales">
          <div className="kpi-icon">📈</div>
          <div className="kpi-body"><div className="kpi-label">Sales This Month</div><div className="kpi-value">{data.sales.month.toFixed(3)}</div><div className="kpi-sub">{data.sales.orders_month} orders</div></div>
        </div>
        <div className="kpi-card profit">
          <div className="kpi-icon">💵</div>
          <div className="kpi-body"><div className="kpi-label">Gross Profit (Month)</div><div className="kpi-value positive">{data.gross_profit_month.toFixed(3)}</div><div className="kpi-sub">{data.margin_pct}% margin</div></div>
        </div>
        <div className="kpi-card stock">
          <div className="kpi-icon">🏭</div>
          <div className="kpi-body"><div className="kpi-label">Stock Value</div><div className="kpi-value">{data.stock_value.toFixed(3)}</div><div className="kpi-sub">OMR at cost</div></div>
        </div>
      </div>

      {/* Cash Flow */}
      <div className="section-row">
        <div className="section-card cash-flow">
          <h3>💸 Cash Flow This Month</h3>
          <div className="cash-flow-bar">
            <div className="cf-row"><span className="cf-label">Money In (Collections)</span><div className="cf-bar-wrap"><div className="cf-bar in" style={{width: `${Math.min(data.cash_flow.month.in / Math.max(data.cash_flow.month.in, data.cash_flow.month.out, 1) * 100, 100)}%`}} /><span className="cf-amount positive">{data.cash_flow.month.in.toFixed(3)}</span></div></div>
            <div className="cf-row"><span className="cf-label">Money Out (Payments)</span><div className="cf-bar-wrap"><div className="cf-bar out" style={{width: `${Math.min(data.cash_flow.month.out / Math.max(data.cash_flow.month.in, data.cash_flow.month.out, 1) * 100, 100)}%`}} /><span className="cf-amount negative">{data.cash_flow.month.out.toFixed(3)}</span></div></div>
            <div className="cf-net"><span>Net Cash Flow</span><span className={data.cash_flow.month.net >= 0 ? 'positive' : 'negative'}>{data.cash_flow.month.net.toFixed(3)} OMR</span></div>
          </div>
        </div>

        {/* P&L Summary */}
        <div className="section-card pnl">
          <div className="pnl-header"><h3>📊 Profit & Loss</h3>
            <div className="period-tabs">
              {['month', 'quarter', 'year'].map(p => (
                <button key={p} className={`period-btn ${pnlPeriod === p ? 'active' : ''}`} onClick={() => setPnlPeriod(p)}>{p.charAt(0).toUpperCase() + p.slice(1)}</button>
              ))}
            </div>
          </div>
          {pnl && (
            <div className="pnl-body">
              <div className="pnl-line"><span>Revenue</span><span className="val">{pnl.revenue.toFixed(3)}</span></div>
              <div className="pnl-line sub"><span>Cost of Goods Sold</span><span className="val negative">({pnl.cost_of_goods_sold.toFixed(3)})</span></div>
              <div className="pnl-line sub"><span>Discounts Given</span><span className="val negative">({pnl.discounts_given.toFixed(3)})</span></div>
              <div className="pnl-line bold"><span>Gross Profit</span><span className={`val ${pnl.gross_profit >= 0 ? 'positive' : 'negative'}`}>{pnl.gross_profit.toFixed(3)}</span></div>
              <div className="pnl-line sub"><span>Freight & Customs</span><span className="val negative">({pnl.operating_expenses.freight_customs.toFixed(3)})</span></div>
              <div className="pnl-line grand"><span>Net Profit</span><span className={`val ${pnl.net_profit >= 0 ? 'positive' : 'negative'}`}>{pnl.net_profit.toFixed(3)} OMR</span></div>
              <div className="pnl-margin">Gross Margin: {pnl.gross_margin_pct}% — Net Margin: {pnl.net_margin_pct}%</div>
            </div>
          )}
        </div>
      </div>

      {/* Monthly Trend Chart (CSS bars) */}
      <div className="section-card">
        <h3>📈 Monthly Sales vs Purchases (12 months)</h3>
        <div className="trend-chart">
          {data.monthly_trend.map((m, idx) => (
            <div key={idx} className="trend-month">
              <div className="trend-bars">
                <div className="trend-bar sales" style={{height: `${(m.sales / maxTrend) * 120}px`}} title={`Sales: ${m.sales.toFixed(0)}`} />
                <div className="trend-bar purchases" style={{height: `${(m.purchases / maxTrend) * 120}px`}} title={`Purchases: ${m.purchases.toFixed(0)}`} />
              </div>
              <div className="trend-label">{m.month.slice(5)}</div>
            </div>
          ))}
        </div>
        <div className="trend-legend"><span className="legend-dot sales" /> Sales <span className="legend-dot purchases" /> Purchases</div>
      </div>

      {/* Top Customers & Products */}
      <div className="section-row">
        <div className="section-card">
          <h3>🏆 Top 10 Customers by Revenue</h3>
          <table className="data-table compact">
            <thead><tr><th>Customer</th><th>Area</th><th>Orders</th><th>Revenue</th></tr></thead>
            <tbody>
              {data.top_customers.map((c, i) => (
                <tr key={i}><td><span className="rank">#{i+1}</span> {c.name}</td><td><span className="area-badge">{c.area || '-'}</span></td>
                  <td className="center">{c.orders}</td><td className="value">{c.revenue.toFixed(3)}</td></tr>
              ))}
              {data.top_customers.length === 0 && <tr><td colSpan="4" className="no-data">No sales data yet</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="section-card">
          <h3>🏆 Top 10 Products by Profit</h3>
          <table className="data-table compact">
            <thead><tr><th>Product</th><th>Margin</th><th>Qty Sold</th><th>Profit</th></tr></thead>
            <tbody>
              {data.top_products.map((p, i) => (
                <tr key={i}><td><span className="rank">#{i+1}</span> {p.name}</td>
                  <td><span className={`margin-badge ${p.margin_pct > 30 ? 'high' : p.margin_pct > 15 ? 'med' : 'low'}`}>{p.margin_pct}%</span></td>
                  <td className="center">{p.qty_sold}</td><td className="value">{p.profit.toFixed(3)}</td></tr>
              ))}
              {data.top_products.length === 0 && <tr><td colSpan="4" className="no-data">No sales data yet</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
export default FinancialDashboard;
