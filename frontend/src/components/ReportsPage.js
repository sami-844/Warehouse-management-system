import React, { useState, useEffect } from 'react';
import { reportsAPI, reportsAPI2 } from '../services/api';
import './AdminPanel.css';
import { BarChart2 } from 'lucide-react';

const REPORTS = [
  { id: 'sales-customer', name: 'Sales by Customer', icon: '', desc: 'Revenue breakdown by customer' },
  { id: 'sales-product', name: 'Sales by Product', icon: '', desc: 'Product performance and margins' },
  { id: 'purchase-supplier', name: 'Purchases by Supplier', icon: '', desc: 'Supplier order history' },
  { id: 'receivables', name: 'Receivables Aging', icon: '', desc: 'Who owes you, how overdue' },
  { id: 'payables', name: 'Payables Aging', icon: '', desc: 'What you owe suppliers' },
  { id: 'stock-valuation', name: 'Stock Valuation', icon: '', desc: 'Total inventory value at cost & retail' },
  { id: 'inventory-movements', name: 'Inventory Movements', icon: '', desc: 'All stock in/out transactions' },
  { id: 'dead-stock', name: 'Dead Stock', icon: '', desc: 'Products not sold in 90+ days' },
  { id: 'expiry', name: 'Expiry Report', icon: '', desc: 'Expired and expiring products' },
  { id: 'delivery', name: 'Delivery Performance', icon: '', desc: 'Driver completion rates' },
  { id: 'sales-payments', name: 'Sales Payments', icon: '', desc: 'Customer payment history' },
  { id: 'purchase-payments', name: 'Purchase Payments', icon: '', desc: 'Supplier payment history' },
  { id: 'customer-orders', name: 'Customer Orders', icon: '', desc: 'Order summary per customer' },
];

function ReportsPage() {
  const [activeReport, setActiveReport] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fromDate, setFromDate] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10));
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));

  const loadReport = async (reportId) => {
    setActiveReport(reportId);
    setLoading(true);
    setReportData(null);
    try {
      const params = { from_date: fromDate, to_date: toDate };
      let data;
      switch (reportId) {
        case 'sales-customer': data = await reportsAPI.salesByCustomer(params); break;
        case 'sales-product': data = await reportsAPI.salesByProduct(params); break;
        case 'purchase-supplier': data = await reportsAPI.purchaseBySupplier(params); break;
        case 'receivables': data = await reportsAPI.receivablesAging(); break;
        case 'payables': data = await reportsAPI.payablesAging(); break;
        case 'stock-valuation': data = await reportsAPI.stockValuation(); break;
        case 'inventory-movements': data = await reportsAPI.inventoryMovements(params); break;
        case 'dead-stock': data = await reportsAPI.deadStock(90); break;
        case 'expiry': data = await reportsAPI.expiryReport(90); break;
        case 'delivery': data = await reportsAPI.deliveryPerformance(params); break;
        case 'sales-payments': data = await reportsAPI2.salesPayments(params); break;
        case 'purchase-payments': data = await reportsAPI2.purchasePayments(params); break;
        case 'customer-orders': data = await reportsAPI2.customerOrders(params); break;
        default: break;
      }
      setReportData(data);
    } catch(e) { console.error(e); setReportData({ error: e.response?.data?.detail || e.message }); }
    finally { setLoading(false); }
  };

  // Safe number formatter
  const fmt = (v) => (Number(v) || 0).toFixed(3);

  const renderAgingBuckets = (buckets) => {
    const cur = Number(buckets?.current) || 0;
    const d30 = Number(buckets?.['1_30']) || 0;
    const d60 = Number(buckets?.['31_60']) || 0;
    const d90 = Number(buckets?.['61_90']) || 0;
    const over = Number(buckets?.over_90) || 0;
    return (
      <div className="aging-cards">
        <div className="aging-card current"><div className="aging-label">Current</div><div className="aging-value">{cur.toFixed(3)}</div></div>
        <div className="aging-card d30"><div className="aging-label">1-30 Days</div><div className="aging-value">{d30.toFixed(3)}</div></div>
        <div className="aging-card d60"><div className="aging-label">31-60 Days</div><div className="aging-value">{d60.toFixed(3)}</div></div>
        <div className="aging-card d90"><div className="aging-label">61-90 Days</div><div className="aging-value">{d90.toFixed(3)}</div></div>
        <div className="aging-card over90"><div className="aging-label">90+ Days</div><div className="aging-value">{over.toFixed(3)}</div></div>
        <div className="aging-card total"><div className="aging-label">Total</div><div className="aging-value">{(cur + d30 + d60 + d90 + over).toFixed(3)}</div></div>
      </div>
    );
  };

  const renderReport = () => {
    if (!reportData) return null;
    if (reportData.error) return <div className="message error">{reportData.error}</div>;

    switch (activeReport) {
      case 'sales-customer':
        return (<>
          <div className="report-summary">Total Revenue: <strong>{fmt(reportData.total_revenue)} OMR</strong> ({reportData.period?.from} to {reportData.period?.to})</div>
          <table className="data-table"><thead><tr><th>#</th><th>Code</th><th>Customer</th><th>Area</th><th>Orders</th><th>Revenue</th><th>Discounts</th><th>% of Total</th></tr></thead>
            <tbody>{(reportData.data || []).map((r, i) => (
              <tr key={i}><td>{i+1}</td><td className="code">{r.code}</td><td>{r.name}</td><td><span className="area-badge">{r.area || '-'}</span></td>
                <td className="center">{r.orders}</td><td className="value">{fmt(r.revenue)}</td><td>{fmt(r.discounts)}</td><td>{r.pct_of_total || 0}%</td></tr>
            ))}</tbody></table>
        </>);

      case 'sales-product':
        return (
          <table className="data-table"><thead><tr><th>#</th><th>SKU</th><th>Product</th><th>Qty Sold</th><th>Revenue</th><th>Cost</th><th>Profit</th><th>Margin %</th></tr></thead>
            <tbody>{(reportData.data || []).map((r, i) => (
              <tr key={i}><td>{i+1}</td><td className="code">{r.sku}</td><td>{r.name}</td><td className="center">{r.qty_sold}</td>
                <td className="value">{fmt(r.revenue)}</td><td>{fmt(r.cost)}</td>
                <td className="positive">{fmt(r.profit)}</td><td><span className={`margin-badge ${(r.margin_pct||0) > 30 ? 'high' : (r.margin_pct||0) > 15 ? 'med' : 'low'}`}>{r.margin_pct || 0}%</span></td></tr>
            ))}</tbody></table>
        );

      case 'purchase-supplier':
        return (
          <table className="data-table"><thead><tr><th>#</th><th>Code</th><th>Supplier</th><th>Orders</th><th>Total</th><th>Freight</th></tr></thead>
            <tbody>{(reportData.data || []).map((r, i) => (
              <tr key={i}><td>{i+1}</td><td className="code">{r.code}</td><td>{r.name}</td>
                <td className="center">{r.orders}</td><td className="value">{fmt(r.total)}</td><td>{fmt(r.freight)}</td></tr>
            ))}</tbody></table>
        );

      case 'receivables':
        return (<>
          {renderAgingBuckets(reportData.buckets)}
          <table className="data-table"><thead><tr><th>Invoice</th><th>Customer</th><th>Area</th><th>Phone</th><th>Due Date</th><th>Total</th><th>Paid</th><th>Balance</th><th>Overdue</th></tr></thead>
            <tbody>{(reportData.items || []).map((r, i) => (
              <tr key={i} className={r.days_overdue > 30 ? 'overdue-row' : ''}><td className="code">{r.invoice}</td><td>{r.customer}</td>
                <td><span className="area-badge">{r.area || '-'}</span></td><td>{r.phone || '-'}</td><td>{r.due_date}</td>
                <td>{fmt(r.total)}</td><td className="positive">{fmt(r.paid)}</td>
                <td className="negative value">{fmt(r.balance)}</td><td className={r.days_overdue > 0 ? 'negative' : ''}>{r.days_overdue > 0 ? `${r.days_overdue}d` : '-'}</td></tr>
            ))}</tbody></table>
        </>);

      case 'payables':
        return (<>
          {renderAgingBuckets(reportData.buckets)}
          <table className="data-table"><thead><tr><th>Invoice</th><th>Supplier</th><th>Due Date</th><th>Total</th><th>Paid</th><th>Balance</th><th>Overdue</th></tr></thead>
            <tbody>{(reportData.items || []).map((r, i) => (
              <tr key={i}><td className="code">{r.invoice}</td><td>{r.supplier}</td><td>{r.due_date}</td>
                <td>{fmt(r.total)}</td><td className="positive">{fmt(r.paid)}</td>
                <td className="negative value">{fmt(r.balance)}</td><td className={r.days_overdue > 0 ? 'negative' : ''}>{r.days_overdue > 0 ? `${r.days_overdue}d` : '-'}</td></tr>
            ))}</tbody></table>
        </>);

      case 'stock-valuation':
        return (<>
          <div className="report-summary">Cost Value: <strong>{fmt(reportData.total_cost_value)} OMR</strong> — Retail Value: <strong>{fmt(reportData.total_retail_value)} OMR</strong> — Potential Profit: <strong className="positive">{fmt(reportData.potential_profit)} OMR</strong></div>
          <table className="data-table"><thead><tr><th>SKU</th><th>Product</th><th>Unit</th><th>Cost</th><th>Sell</th><th>Qty</th><th>Stock Value</th><th>Retail Value</th></tr></thead>
            <tbody>{(reportData.data || []).map((r, i) => (
              <tr key={i}><td className="code">{r.sku}</td><td>{r.name}</td><td>{r.unit}</td>
                <td>{fmt(r.unit_cost)}</td><td>{fmt(r.sell_price)}</td>
                <td className="center">{r.qty}</td><td className="value">{fmt(r.stock_value)}</td><td>{fmt(r.retail_value)}</td></tr>
            ))}</tbody></table>
        </>);

      case 'inventory-movements':
        return (<>
          <div className="report-summary">{reportData.count || 0} movements ({reportData.period?.from} to {reportData.period?.to})</div>
          <table className="data-table"><thead><tr><th>Date</th><th>Product</th><th>Type</th><th>Qty</th><th>Warehouse</th><th>Reference</th><th>Notes</th></tr></thead>
            <tbody>{(reportData.data || []).map((r, i) => (
              <tr key={i}><td>{r.date ? r.date.slice(0,10) : '-'}</td><td>{r.product}</td>
                <td><span className={`type-badge ${r.type}`}>{r.type}</span></td>
                <td className={r.qty >= 0 ? 'positive' : 'negative'}>{r.qty}</td>
                <td>{r.warehouse}</td><td className="code">{r.reference || '-'}</td><td>{r.notes || '-'}</td></tr>
            ))}</tbody></table>
        </>);

      case 'dead-stock':
        return (<>
          <div className="report-summary">{reportData.count || 0} products not sold in {reportData.threshold_days || 90}+ days — Value at risk: <strong className="negative">{fmt(reportData.total_dead_stock_value)} OMR</strong></div>
          <table className="data-table"><thead><tr><th>SKU</th><th>Product</th><th>Qty</th><th>Value</th><th>Last Sold</th></tr></thead>
            <tbody>{(reportData.data || []).map((r, i) => (
              <tr key={i}><td className="code">{r.sku}</td><td>{r.name}</td><td className="center">{r.qty}</td>
                <td className="negative value">{fmt(r.value)}</td><td>{r.last_sold}</td></tr>
            ))}</tbody></table>
        </>);

      case 'expiry':
        return (<>
          <div className="report-summary">{reportData.expired_count || 0} expired (value: {fmt(reportData.expired_value)} OMR) — {reportData.expiring_count || 0} expiring within {reportData.threshold_days || 90} days</div>
          {(reportData.expired || []).length > 0 && (<>
            <h4>Expired Products</h4>
            <table className="data-table"><thead><tr><th>SKU</th><th>Product</th><th>Batch</th><th>Expiry</th><th>Qty</th><th>Value</th><th>Warehouse</th></tr></thead>
              <tbody>{(reportData.expired || []).map((r, i) => (
                <tr key={i} className="overdue-row"><td className="code">{r.sku}</td><td>{r.name}</td><td>{r.batch || '-'}</td>
                  <td className="negative">{r.expiry}</td><td>{r.qty}</td><td className="negative">{fmt(r.value)}</td><td>{r.warehouse}</td></tr>
              ))}</tbody></table>
          </>)}
          {(reportData.expiring_soon || []).length > 0 && (<>
            <h4 style={{marginTop:16}}>Expiring Soon</h4>
            <table className="data-table"><thead><tr><th>SKU</th><th>Product</th><th>Batch</th><th>Expiry</th><th>Qty</th><th>Value</th><th>Warehouse</th></tr></thead>
              <tbody>{(reportData.expiring_soon || []).map((r, i) => (
                <tr key={i}><td className="code">{r.sku}</td><td>{r.name}</td><td>{r.batch || '-'}</td>
                  <td>{r.expiry}</td><td>{r.qty}</td><td>{fmt(r.value)}</td><td>{r.warehouse}</td></tr>
              ))}</tbody></table>
          </>)}
        </>);

      case 'delivery':
        return (
          <table className="data-table"><thead><tr><th>Driver</th><th>Vehicle</th><th>Total</th><th>Delivered</th><th>Pending</th><th>Completion %</th></tr></thead>
            <tbody>{(reportData.data || []).map((r, i) => (
              <tr key={i}><td>{r.driver}</td><td>{r.vehicle}</td><td className="center">{r.total}</td>
                <td className="positive center">{r.delivered}</td><td className="center">{r.pending}</td>
                <td><div className="perf-bar"><div className="perf-fill" style={{width: `${r.completion_pct || 0}%`}} /><span>{r.completion_pct || 0}%</span></div></td></tr>
            ))}</tbody></table>
        );

      case 'sales-payments':
        return (
          <table className="data-table"><thead><tr><th>#</th><th>Date</th><th>Customer</th><th>Invoice</th><th>Method</th><th>Reference</th><th>Amount</th></tr></thead>
            <tbody>{(reportData.data || []).map((r, i) => (
              <tr key={i}><td>{i+1}</td><td>{r.date ? String(r.date).slice(0,10) : '-'}</td><td>{r.customer}</td>
                <td className="code">{r.invoice || '-'}</td><td>{r.method || '-'}</td><td className="code">{r.reference || '-'}</td>
                <td className="value positive">{fmt(r.amount)}</td></tr>
            ))}</tbody></table>
        );

      case 'purchase-payments':
        return (
          <table className="data-table"><thead><tr><th>#</th><th>Date</th><th>Supplier</th><th>Invoice</th><th>Method</th><th>Reference</th><th>Amount</th></tr></thead>
            <tbody>{(reportData.data || []).map((r, i) => (
              <tr key={i}><td>{i+1}</td><td>{r.date ? String(r.date).slice(0,10) : '-'}</td><td>{r.supplier}</td>
                <td className="code">{r.invoice || '-'}</td><td>{r.method || '-'}</td><td className="code">{r.reference || '-'}</td>
                <td className="value positive">{fmt(r.amount)}</td></tr>
            ))}</tbody></table>
        );

      case 'customer-orders':
        return (
          <table className="data-table"><thead><tr><th>#</th><th>Code</th><th>Customer</th><th>Area</th><th>Orders</th><th>Total Value</th><th>Last Order</th></tr></thead>
            <tbody>{(reportData.data || []).map((r, i) => (
              <tr key={i}><td>{i+1}</td><td className="code">{r.code}</td><td>{r.name}</td>
                <td><span className="area-badge">{r.area || '-'}</span></td>
                <td className="center">{r.orders}</td><td className="value">{fmt(r.total)}</td>
                <td>{r.last_order || '-'}</td></tr>
            ))}</tbody></table>
        );

      default: return null;
    }
  };

  return (
    <div className="admin-container">
      <div className="page-header"><div className="header-content"><div className="header-icon reports"><BarChart2 size={20} /></div><div><h1>Reports</h1><p>Business intelligence and analytics</p></div></div></div>

      {/* Date Filters */}
      <div className="filter-bar">
        <label>From:</label>
        <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="filter-input" />
        <label>To:</label>
        <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="filter-input" />
        {activeReport && <button className="action-btn primary" onClick={() => loadReport(activeReport)}>Refresh</button>}
      </div>

      {/* Report Selector */}
      <div className="report-grid">
        {REPORTS.map(r => (
          <div key={r.id} className={`report-card ${activeReport === r.id ? 'active' : ''}`} onClick={() => loadReport(r.id)}>
            <div className="rc-icon">{r.icon}</div>
            <div className="rc-body"><div className="rc-name">{r.name}</div><div className="rc-desc">{r.desc}</div></div>
          </div>
        ))}
      </div>

      {/* Report Output */}
      {activeReport && (
        <div className="report-output">
          <h3>{REPORTS.find(r => r.id === activeReport)?.name}</h3>
          {loading ? <div className="loading-state">Generating report...</div> : (
            <div className="table-container">{renderReport()}</div>
          )}
        </div>
      )}
    </div>
  );
}
export default ReportsPage;
