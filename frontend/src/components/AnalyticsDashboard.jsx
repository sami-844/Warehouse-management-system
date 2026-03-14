/**
 * AnalyticsDashboard — main page (Phase 32 Mega-Upgrade)
 * Features: branded header, alerts, filters, 8 KPIs,
 *           invoice/counts/expense widgets, overdue/payable tables,
 *           cash flow bar chart, bank balances,
 *           2 donut charts, trend line chart, category bar chart,
 *           expiry bell, CSV + PDF export
 */
import React, { useState, useEffect, useCallback } from 'react';
import { analyticsAPI, dashboardAPI } from '../services/api';

import KPICard            from './KPICard';
import DonutChart         from './DonutChart';
import TrendLineChart     from './TrendLineChart';
import CategoryBarChart   from './CategoryBarChart';
import FilterBar          from './FilterBar';
import AlertsPanel        from './AlertsPanel';
import { exportToCSV, exportToPDF } from '../utils/ExportUtils';
import { Bell } from 'lucide-react';
import { fmtOMR, fmtNumber } from '../utils/format';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

import { PERMISSIONS } from '../constants/permissions';
import './AnalyticsDashboard.css';

/* ── Permission helper ── */
const userRole = localStorage.getItem('userRole') || '';
const userPerms = (() => { try { return JSON.parse(localStorage.getItem('userPermissions') || '[]'); } catch { return []; } })();
const can = (perm) => {
  if (userRole.toLowerCase() === 'admin') return true;
  return userPerms.includes(perm);
};

/* --------------------------------------------------------
   BRAND COLOURS — tweak accent / logo text here
   -------------------------------------------------------- */
const SALES_COLORS     = ['#1A7B5B','#2EA87B','#D4A017','#3B82F6'];
const INVENTORY_COLORS = ['#1A7B5B','#D4A017','#EF4444','#6B7280'];

/* KPI accent colours — gold for money, green for performance, blue for time, red for risk */
const KPI_ACCENTS = {
  inventory_turnover_ratio:  'green',
  average_inventory:         'gold',
  cost_of_goods_sold:        'gold',
  service_level:             'green',
  days_to_sell_inventory:    'blue',
  lead_time:                 'blue',
  perfect_order_rate:        'green',
  rate_of_return:            'red',
};

const fmt = (v) => fmtNumber(v);

/* ── Cash Flow Tooltip ── */
const CashFlowTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, fontFamily: 'var(--ds-font-mono)' }}>
          {p.name}: {fmt(p.value)} OMR
        </div>
      ))}
    </div>
  );
};

const AnalyticsDashboard = ({ onNavigate }) => {
  /* ---- state ---- */
  const [dashboardData, setDashboardData] = useState(null);
  const [trendsData,    setTrendsData]    = useState([]);
  const [categoryData,  setCategoryData]  = useState([]);
  const [alertsData,    setAlertsData]    = useState({ summary: {}, alerts: [] });
  const [categories,    setCategories]    = useState([]);
  const [summaryData,   setSummaryData]   = useState(null);

  const [loading,           setLoading]           = useState(true);
  const [selectedPeriod,    setSelectedPeriod]    = useState(30);
  const [selectedCategory,  setSelectedCategory]  = useState('');
  const [alertsExpanded,    setAlertsExpanded]    = useState(false);
  const [isRefreshing,      setIsRefreshing]      = useState(false);
  const [stockAlertCount,  setStockAlertCount]   = useState(0);
  const [receivables,      setReceivables]       = useState(null);

  const nav = (page) => onNavigate?.(page);

  /* ---- fetch all data in parallel; gracefully degrade on new endpoints ---- */
  const fetchAllData = useCallback(async () => {
    setLoading(prev => dashboardData ? false : true);   /* spinner only on first load */
    setIsRefreshing(true);

    try {
      const results = await Promise.allSettled([
        analyticsAPI.dashboard(selectedPeriod, selectedCategory || null),
        analyticsAPI.trends(selectedPeriod, selectedCategory || null),
        analyticsAPI.categoryBreakdown(selectedPeriod),
        analyticsAPI.alerts(),
        analyticsAPI.categories(),
        dashboardAPI.summary(),
        fetch('/api/alerts/stock', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } }).then(r => r.json()),
        fetch('/api/collections/aging', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } }).then(r => r.json()),
      ]);

      const val = (i) => results[i]?.status === 'fulfilled' ? results[i].value : null;

      // Log any failed requests for debugging
      results.forEach((r, i) => {
        if (r.status === 'rejected') console.error(`Dashboard call ${i} failed:`, r.reason?.response?.data || r.reason?.message);
      });

      // Dashboard data — use response or safe defaults so dashboard always renders
      const defaultDashboard = {
        kpis: { inventory_turnover_ratio: 0, average_inventory: 0, cost_of_goods_sold: 0,
                service_level: 0, days_to_sell_inventory: 0, lead_time: 0,
                perfect_order_rate: 0, rate_of_return: 0 },
        sales_orders: { completed: 0, in_progress: 0, returns: 0, overdue_shipping: 0 },
        inventory_status: { in_stock_items: 0, low_stock_items: 0, out_of_stock_items: 0, dead_stock_items: 0 },
      };
      setDashboardData(val(0) || dashboardData || defaultDashboard);

      setTrendsData(val(1)?.trends || []);
      setCategoryData(val(2)?.categories || []);
      if (val(3)) setAlertsData(val(3));
      if (val(4)) setCategories(val(4).categories || []);
      setSummaryData(val(5) || summaryData || null);
      if (val(6)) setStockAlertCount(val(6).total_alerts || 0);
      if (val(7)) setReceivables(val(7).summary || null);

    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedPeriod, selectedCategory]);   /* eslint-disable-line react-hooks/exhaustive-deps */

  useEffect(() => {
    fetchAllData();
    const interval = setInterval(fetchAllData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchAllData]);

  /* ---- export helpers ---- */
  const handleExportCSV = () => exportToCSV(dashboardData, trendsData, categoryData, selectedPeriod);
  const handleExportPDF = () => exportToPDF();

  /* ============================================================
     LOADING
     ============================================================ */
  if (loading && !dashboardData) {
    return (
      <div className="loading-container">
        <div className="loading-content">
          <div className="spinner"></div>
          <p className="loading-text">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  /* If dashboardData never loaded, use safe defaults so the page always renders */
  const safeData = dashboardData || {
    kpis: { inventory_turnover_ratio: 0, average_inventory: 0, cost_of_goods_sold: 0,
            service_level: 0, days_to_sell_inventory: 0, lead_time: 0,
            perfect_order_rate: 0, rate_of_return: 0 },
    sales_orders: { completed: 0, in_progress: 0, returns: 0, overdue_shipping: 0 },
    inventory_status: { in_stock_items: 0, low_stock_items: 0, out_of_stock_items: 0, dead_stock_items: 0 },
  };

  /* ---- destructure ---- */
  const { kpis = {}, sales_orders = {}, inventory_status = {} } = safeData;

  const salesChartData = [
    { name: 'Completed',   value: sales_orders.completed || 0 },
    { name: 'In Progress', value: sales_orders.in_progress || 0 },
    { name: 'Returns',     value: sales_orders.returns || 0 },
    { name: 'Overdue',     value: sales_orders.overdue_shipping || 0 },
  ];

  const inventoryChartData = [
    { name: 'In Stock',     value: inventory_status.in_stock_items || 0 },
    { name: 'Low Stock',    value: inventory_status.low_stock_items || 0 },
    { name: 'Out of Stock', value: inventory_status.out_of_stock_items || 0 },
    { name: 'Dead Stock',   value: inventory_status.dead_stock_items || 0 },
  ];

  /* ---- Phase 32 summary data ---- */
  const inv = summaryData?.invoice_summary || {};
  const counts = summaryData?.counts || {};
  const expenses = summaryData?.expense_breakdown || { total: 0, items: [] };
  const overdueInvs = summaryData?.overdue_invoices || [];
  const payableBills = summaryData?.payable_bills || [];
  const cashFlowData = summaryData?.cash_flow || [];
  const bankBalances = summaryData?.bank_balances || [];
  const expiryCount = summaryData?.expiry_alerts_count || 0;

  /* ============================================================
     RENDER
     ============================================================ */
  return (
    <div className="analytics-container">

      {/* ──── Brand Header ──── */}
      <div className="brand-header">
        <div className="brand-header-inner">
          <div className="brand-logo-area">
            <div className="brand-icon"></div>
            <div>
              <h1 className="brand-title">Wholesale Distribution</h1>
              <span className="brand-tagline">Inventory Management &amp; Analytics - Oman</span>
            </div>
          </div>
          <div className="brand-header-actions no-print">
            {expiryCount > 0 && (
              <div className="expiry-bell" onClick={() => nav('expiry-tracker')} title={`${expiryCount} expiring items`}>
                <Bell size={18} />
                <span className="expiry-badge">{expiryCount}</span>
              </div>
            )}
            <button className="export-btn" onClick={handleExportCSV}>CSV</button>
            <button className="export-btn" onClick={handleExportPDF}>PDF</button>
            <button className={`refresh-btn ${isRefreshing ? 'spinning' : ''}`}
                    onClick={fetchAllData} title="Refresh data">Refresh</button>
          </div>
        </div>
      </div>

      {/* ──── Alerts ──── */}
      <AlertsPanel alerts={alertsData} expanded={alertsExpanded} onToggle={() => setAlertsExpanded(p => !p)} />

      {/* ──── Filters ──── */}
      <div className="no-print">
        <FilterBar
          categories={categories}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          selectedPeriod={selectedPeriod}
          onPeriodChange={setSelectedPeriod}
        />
      </div>

      {/* ──── KPI Cards ──── */}
      {can(PERMISSIONS.DASHBOARD.WIDGET_INVENTORY) && (
        <div className="kpi-section">
          <div className="kpi-grid">
            <KPICard title="Inventory Turnover"   value={kpis.inventory_turnover_ratio}   icon="" accent={KPI_ACCENTS.inventory_turnover_ratio} />
            <KPICard title="Avg. Inventory"       value={kpis.average_inventory}          unit="OMR"  icon="" accent={KPI_ACCENTS.average_inventory} />
            <KPICard title="COGS"                 value={kpis.cost_of_goods_sold}         unit="OMR"  icon="" accent={KPI_ACCENTS.cost_of_goods_sold} />
            <KPICard title="Service Level"        value={kpis.service_level}              unit="%"    icon="" accent={KPI_ACCENTS.service_level} />
            <KPICard title="Days to Sell"         value={kpis.days_to_sell_inventory}     unit="days" icon="" accent={KPI_ACCENTS.days_to_sell_inventory} />
            <KPICard title="Lead Time"            value={kpis.lead_time}                  unit="days" icon="" accent={KPI_ACCENTS.lead_time} />
            <KPICard title="Perfect Order Rate"  value={kpis.perfect_order_rate}         unit="%"    icon="" accent={KPI_ACCENTS.perfect_order_rate} />
            <KPICard title="Return Rate"         value={kpis.rate_of_return}             unit="%"    icon="" accent={KPI_ACCENTS.rate_of_return} />
          </div>
        </div>
      )}

      {/* Stock Alert Widget */}
      {stockAlertCount > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div
            onClick={() => nav('stock-alerts')}
            style={{
              display: 'flex', alignItems: 'center', gap: 16,
              padding: '14px 20px', borderRadius: 8,
              background: '#FFF5F5', border: '1px solid #FED7D7',
              cursor: 'pointer', transition: 'box-shadow 0.2s'
            }}
          >
            <div style={{ fontSize: 28, fontWeight: 700, color: '#DC3545', minWidth: 48, textAlign: 'center' }}>
              {stockAlertCount}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: '#DC3545' }}>Stock Alerts</div>
              <div style={{ fontSize: 12, color: '#6C757D' }}>
                {stockAlertCount} product(s) at or below reorder level — click to view
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Receivables Widget */}
      {receivables && receivables.total_receivables > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div
            onClick={() => nav('collections')}
            style={{
              display: 'flex', alignItems: 'center', gap: 16,
              padding: '14px 20px', borderRadius: 8,
              background: '#FFFBEB', border: '1px solid #FDE68A',
              cursor: 'pointer', transition: 'box-shadow 0.2s'
            }}
          >
            <div style={{ fontSize: 28, fontWeight: 700, color: '#1A3A5C', minWidth: 100, textAlign: 'center' }}>
              {(receivables.total_receivables || 0).toFixed(3)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: '#1A3A5C' }}>Total Receivables (OMR)</div>
              <div style={{ fontSize: 12, color: '#6C757D' }}>
                {receivables.customer_count || 0} customer(s) with outstanding balances — click to view
              </div>
            </div>
            {receivables.very_late_90_plus > 0 && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#DC3545' }}>
                  {receivables.very_late_90_plus.toFixed(3)} OMR
                </div>
                <div style={{ fontSize: 11, color: '#DC3545' }}>overdue 90+ days</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          Phase 32 — NEW WIDGET ROWS
          ══════════════════════════════════════════════════════════ */}

      {summaryData && (
        <>
          {/* ──── ROW 1: Invoice + Counts + Expenses (3-col) ──── */}
          <div className="widget-section">
            <div className="widget-grid-3">
              {/* Invoice Summary */}
              {can(PERMISSIONS.DASHBOARD.WIDGET_SALES) && <div className="widget-card">
                <div className="widget-card-title">Invoices</div>
                <div className="widget-big-number">{fmt(inv.total_amount)} <span style={{ fontSize: 14, fontWeight: 500 }}>OMR</span></div>
                <div className="widget-subtitle">{inv.count || 0} total invoices</div>
                <div className="progress-bar-bg">
                  <div className="progress-bar-fill" style={{ width: `${Math.min(inv.paid_pct || 0, 100)}%` }}></div>
                </div>
                <div className="widget-subtitle">Collected: {fmt(inv.paid_amount)} OMR ({inv.paid_pct || 0}%)</div>
                <button className="widget-create-btn no-print" onClick={() => nav('sales-invoices')}>+ Create Invoice</button>
              </div>}

              {/* Customers / Vendors / Items */}
              {can(PERMISSIONS.DASHBOARD.WIDGET_PURCHASES) && <div className="widget-card">
                <div className="widget-card-title">Business Overview</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 24, fontWeight: 800, fontFamily: 'var(--ds-font-mono)' }}>{counts.customers || 0}</div>
                      <div className="widget-subtitle">Customers</div>
                    </div>
                    <span className="widget-create-link no-print" onClick={() => nav('customers')}>+ New</span>
                  </div>
                  <hr className="widget-divider" />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 24, fontWeight: 800, fontFamily: 'var(--ds-font-mono)' }}>{counts.vendors || 0}</div>
                      <div className="widget-subtitle">Vendors</div>
                    </div>
                    <span className="widget-create-link no-print" onClick={() => nav('suppliers')}>+ New</span>
                  </div>
                  <hr className="widget-divider" />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 24, fontWeight: 800, fontFamily: 'var(--ds-font-mono)' }}>{counts.products || 0}</div>
                      <div className="widget-subtitle">Products</div>
                    </div>
                    <span className="widget-create-link no-print" onClick={() => nav('products')}>+ New</span>
                  </div>
                </div>
              </div>}

              {/* Expense Breakdown */}
              {can(PERMISSIONS.DASHBOARD.WIDGET_CASH_FLOW) && <div className="widget-card">
                <div className="widget-card-title">Expenses (30 Days)</div>
                <div className="widget-big-number">{fmt(expenses.total)} <span style={{ fontSize: 14, fontWeight: 500 }}>OMR</span></div>
                {expenses.items.length > 0 ? (
                  <div style={{ marginTop: 8 }}>
                    {expenses.items.map((e, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--ds-border, #e5e7eb)', fontSize: 12 }}>
                        <span style={{ color: '#374151' }}>{e.category}</span>
                        <span style={{ fontFamily: 'var(--ds-font-mono)', fontWeight: 600 }}>{fmt(e.amount)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="widget-subtitle" style={{ marginTop: 8 }}>No expenses recorded</div>
                )}
                <button className="widget-create-btn no-print" onClick={() => nav('cash-transactions')} style={{ background: '#7c3aed' }}>+ Add Expense</button>
              </div>}
            </div>
          </div>

          {/* ──── ROW 2: Overdue Invoices + Payable Bills (2-col) ──── */}
          <div className="widget-section">
            <div className="widget-grid-2">
              {/* Overdue Invoices */}
              {can(PERMISSIONS.DASHBOARD.WIDGET_OVERDUE) && <div className="widget-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div className="widget-card-title">Overdue Invoices</div>
                  <span className="overdue-count-badge">{overdueInvs.length}</span>
                </div>
                {overdueInvs.length > 0 ? (
                  <table className="widget-table">
                    <thead>
                      <tr><th>Customer</th><th>Invoice</th><th>Overdue</th><th style={{ textAlign: 'right' }}>Amount</th></tr>
                    </thead>
                    <tbody>
                      {overdueInvs.map((r, i) => (
                        <tr key={i}>
                          <td style={{ fontWeight: 500 }}>{r.customer_name}</td>
                          <td style={{ fontFamily: 'var(--ds-font-mono)', fontSize: 11 }}>{r.invoice_number}</td>
                          <td><span className="overdue-badge">{r.days_overdue}d</span></td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)', fontWeight: 600 }}>{fmt(r.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ textAlign: 'center', padding: 24, color: '#6b7280', fontSize: 13 }}>No overdue invoices</div>
                )}
                <span className="view-all-link no-print" onClick={() => nav('sales-invoices')}>View All Invoices</span>
              </div>}

              {/* Payable Bills */}
              {can(PERMISSIONS.DASHBOARD.WIDGET_PAYABLE_BILLS) && <div className="widget-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div className="widget-card-title">Payable Bills</div>
                  <span className="overdue-count-badge" style={{ background: '#fff7ed', color: '#c2410c' }}>{payableBills.length}</span>
                </div>
                {payableBills.length > 0 ? (
                  <table className="widget-table">
                    <thead>
                      <tr><th>Vendor</th><th>Bill #</th><th>Due</th><th style={{ textAlign: 'right' }}>Amount</th></tr>
                    </thead>
                    <tbody>
                      {payableBills.map((r, i) => (
                        <tr key={i}>
                          <td style={{ fontWeight: 500 }}>{r.vendor_name}</td>
                          <td style={{ fontFamily: 'var(--ds-font-mono)', fontSize: 11 }}>{r.bill_number}</td>
                          <td style={{ fontSize: 11, color: '#6b7280' }}>{r.due_date}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)', fontWeight: 600 }}>{fmt(r.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ textAlign: 'center', padding: 24, color: '#6b7280', fontSize: 13 }}>No pending bills</div>
                )}
                <span className="view-all-link no-print" onClick={() => nav('purchase-invoices')}>View All Bills</span>
              </div>}
            </div>
          </div>

          {/* ──── ROW 3: Cash Flow Chart + Bank Balances ──── */}
          <div className="widget-section">
            <div className="widget-grid-2">
              {/* Cash Flow Bar Chart */}
              {can(PERMISSIONS.DASHBOARD.WIDGET_CASH_FLOW) && <div className="widget-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div className="widget-card-title">Cash Flow</div>
                  <span style={{ fontSize: 11, color: '#6b7280' }}>Last 12 months</span>
                </div>
                {cashFlowData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={cashFlowData} margin={{ top: 8, right: 10, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#6B7280' }} />
                      <YAxis tick={{ fontSize: 10, fill: '#6B7280' }} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v} width={45} />
                      <Tooltip content={<CashFlowTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="cash_in" name="Cash In" fill="#16a34a" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="cash_out" name="Cash Out" fill="#dc2626" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ textAlign: 'center', padding: 40, color: '#6b7280', fontSize: 13 }}>No cash flow data</div>
                )}
              </div>}

              {/* Bank Balances */}
              {can(PERMISSIONS.DASHBOARD.WIDGET_WALLETS) && <div className="widget-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div className="widget-card-title">Cash & Bank Balances</div>
                  <span className="widget-create-link no-print" onClick={() => nav('bank-accounts')}>View All</span>
                </div>
                {bankBalances.length > 0 ? (
                  bankBalances.map((b, i) => (
                    <div className="bank-row" key={i}>
                      <div>
                        <span className="bank-name">{b.name}</span>
                        <span className="bank-type-badge">{b.type}</span>
                      </div>
                      <div className="bank-balance">{fmt(b.balance)} <span style={{ fontSize: 11, fontWeight: 400, color: '#6b7280' }}>OMR</span></div>
                    </div>
                  ))
                ) : (
                  <div style={{ textAlign: 'center', padding: 24, color: '#6b7280', fontSize: 13 }}>No bank accounts configured</div>
                )}
              </div>}
            </div>
          </div>
        </>
      )}

      {/* ──── Donut Charts ──── */}
      <div className="charts-section">
        <div className="charts-grid">
          {can(PERMISSIONS.DASHBOARD.WIDGET_SALES) && <DonutChart title="Sales Orders"    data={salesChartData}      colors={SALES_COLORS} />}
          {can(PERMISSIONS.DASHBOARD.WIDGET_INVENTORY) && <DonutChart title="Inventory Status" data={inventoryChartData} colors={INVENTORY_COLORS} />}
        </div>
      </div>

      {/* ──── Trend + Category Charts ──── */}
      {can(PERMISSIONS.DASHBOARD.WIDGET_SALES) && (
        <div className="charts-section">
          <div className="charts-grid">
            {trendsData.length > 0 ? (
              <TrendLineChart data={trendsData} period={selectedPeriod} />
            ) : (
              <div className="widget-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 220, color: '#ADB5BD' }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>~</div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>No sales trend data</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>Trends will appear once you complete sales orders</div>
              </div>
            )}
            {categoryData.length > 0 ? (
              <CategoryBarChart data={categoryData} />
            ) : (
              <div className="widget-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 220, color: '#ADB5BD' }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>~</div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>No category data</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>Category breakdown will appear once products have stock</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ──── Footer ──── */}
      <div className="dashboard-footer">
        <span className="footer-updated no-print">
          Last updated: {new Date().toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </span>
        <span className="footer-brand">Wholesale Distribution - Oman</span>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
