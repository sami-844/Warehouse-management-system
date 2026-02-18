/**
 * AnalyticsDashboard — main page
 * Features: branded header, alerts, filters, 8 KPIs,
 *           2 donut charts, trend line chart, category bar chart,
 *           CSV + PDF export
 */
import React, { useState, useEffect, useCallback } from 'react';

import KPICard            from './KPICard';
import DonutChart         from './DonutChart';
import TrendLineChart     from './TrendLineChart';
import CategoryBarChart   from './CategoryBarChart';
import FilterBar          from './FilterBar';
import AlertsPanel        from './AlertsPanel';
import { exportToCSV, exportToPDF } from '../utils/ExportUtils';

import './AnalyticsDashboard.css';

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

const AnalyticsDashboard = () => {
  /* ---- state ---- */
  const [dashboardData, setDashboardData] = useState(null);
  const [trendsData,    setTrendsData]    = useState([]);
  const [categoryData,  setCategoryData]  = useState([]);
  const [alertsData,    setAlertsData]    = useState({ summary: {}, alerts: [] });
  const [categories,    setCategories]    = useState([]);

  const [loading,           setLoading]           = useState(true);
  const [error,             setError]             = useState(null);
  const [selectedPeriod,    setSelectedPeriod]    = useState(30);
  const [selectedCategory,  setSelectedCategory]  = useState('');
  const [alertsExpanded,    setAlertsExpanded]    = useState(false);
  const [isRefreshing,      setIsRefreshing]      = useState(false);

  /* ---- fetch all data in parallel; gracefully degrade on new endpoints ---- */
  const fetchAllData = useCallback(async () => {
    setLoading(prev => dashboardData ? false : true);   /* spinner only on first load */
    setIsRefreshing(true);
    setError(null);

    const catParam = selectedCategory ? `&category_id=${selectedCategory}` : '';
    const base     = '/api/analytics';

    try {
      const results = await Promise.allSettled([
        fetch(`${base}/dashboard?days=${selectedPeriod}${catParam}`).then(r => r.ok ? r.json() : null),
        fetch(`${base}/trends?days=${selectedPeriod}${catParam}`).then(r => r.ok ? r.json() : null),
        fetch(`${base}/category-breakdown?days=${selectedPeriod}`).then(r => r.ok ? r.json() : null),
        fetch(`${base}/alerts`).then(r => r.ok ? r.json() : null),
        fetch(`${base}/categories`).then(r => r.ok ? r.json() : null),
      ]);

      const val = (i) => results[i]?.status === 'fulfilled' ? results[i].value : null;

      if (val(0))  setDashboardData(val(0));
      else if (!dashboardData) throw new Error('Dashboard endpoint failed');

      if (val(1))  setTrendsData(val(1).trends || []);
      if (val(2))  setCategoryData(val(2).categories || []);
      if (val(3))  setAlertsData(val(3));
      if (val(4))  setCategories(val(4).categories || []);

    } catch (err) {
      setError('Failed to load dashboard data. Please check your backend is running.');
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
          <p className="loading-text">Loading dashboard…</p>
        </div>
      </div>
    );
  }

  /* ============================================================
     ERROR (no cached data)
     ============================================================ */
  if (error && !dashboardData) {
    return (
      <div className="error-container">
        <div className="error-content">
          <div className="error-icon">⚠️</div>
          <h3 className="error-title">Error Loading Dashboard</h3>
          <p className="error-message">{error}</p>
          <button className="retry-btn" onClick={fetchAllData}>Retry</button>
        </div>
      </div>
    );
  }

  if (!dashboardData) return null;

  /* ---- destructure ---- */
  const { kpis = {}, sales_orders = {}, inventory_status = {} } = dashboardData;

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

  /* ============================================================
     RENDER
     ============================================================ */
  return (
    <div className="analytics-container">

      {/* ──── Brand Header ──── */}
      <div className="brand-header">
        <div className="brand-header-inner">
          <div className="brand-logo-area">
            <div className="brand-icon">🏢</div>
            <div>
              <h1 className="brand-title">Wholesale Distribution</h1>
              <span className="brand-tagline">Inventory Management &amp; Analytics · Oman</span>
            </div>
          </div>
          <div className="brand-header-actions no-print">
            <button className="export-btn" onClick={handleExportCSV}>📄 CSV</button>
            <button className="export-btn" onClick={handleExportPDF}>📑 PDF</button>
            <button className={`refresh-btn ${isRefreshing ? 'spinning' : ''}`}
                    onClick={fetchAllData} title="Refresh data">🔄</button>
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
      <div className="kpi-section">
        <div className="kpi-grid">
          <KPICard title="Inventory Turnover"   value={kpis.inventory_turnover_ratio}   icon="📊" accent={KPI_ACCENTS.inventory_turnover_ratio} />
          <KPICard title="Avg. Inventory"       value={kpis.average_inventory}          unit="OMR"  icon="📦" accent={KPI_ACCENTS.average_inventory} />
          <KPICard title="COGS"                 value={kpis.cost_of_goods_sold}         unit="OMR"  icon="💰" accent={KPI_ACCENTS.cost_of_goods_sold} />
          <KPICard title="Service Level"        value={kpis.service_level}              unit="%"    icon="✅" accent={KPI_ACCENTS.service_level} />
          <KPICard title="Days to Sell"         value={kpis.days_to_sell_inventory}     unit="days" icon="⏱️" accent={KPI_ACCENTS.days_to_sell_inventory} />
          <KPICard title="Lead Time"            value={kpis.lead_time}                  unit="days" icon="🚚" accent={KPI_ACCENTS.lead_time} />
          <KPICard title="Perfect Order Rate"  value={kpis.perfect_order_rate}         unit="%"    icon="⭐" accent={KPI_ACCENTS.perfect_order_rate} />
          <KPICard title="Return Rate"         value={kpis.rate_of_return}             unit="%"    icon="↩️" accent={KPI_ACCENTS.rate_of_return} />
        </div>
      </div>

      {/* ──── Donut Charts ──── */}
      <div className="charts-section">
        <div className="charts-grid">
          <DonutChart title="Sales Orders"    data={salesChartData}      colors={SALES_COLORS} />
          <DonutChart title="Inventory Status" data={inventoryChartData} colors={INVENTORY_COLORS} />
        </div>
      </div>

      {/* ──── Trend + Category Charts ──── */}
      <div className="charts-section">
        <div className="charts-grid">
          <TrendLineChart    data={trendsData}   period={selectedPeriod} />
          <CategoryBarChart  data={categoryData} />
        </div>
      </div>

      {/* ──── Footer ──── */}
      <div className="dashboard-footer">
        <span className="footer-updated no-print">
          Last updated: {new Date().toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </span>
        <span className="footer-brand">Wholesale Distribution · Oman</span>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;