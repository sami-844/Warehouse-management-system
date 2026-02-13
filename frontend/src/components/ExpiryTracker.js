import React, { useState, useEffect } from 'react';
import { inventoryAPI } from '../services/api';
import './ExpiryTracker.css';

function ExpiryTracker() {
  const [data, setData] = useState({ summary: {}, items: [] });
  const [days, setDays] = useState(90);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => { loadData(); }, [days]);

  const loadData = async () => {
    setLoading(true);
    try { setData(await inventoryAPI.getExpiryAlerts(days)); } catch(e) { console.error(e); }
    finally { setLoading(false); }
  };

  const filtered = filter === 'all' ? data.items : data.items.filter(i => i.urgency === filter);

  const exportCSV = () => {
    const headers = ['Product', 'SKU', 'Batch', 'Expiry Date', 'Days Left', 'Quantity', 'Warehouse', 'Status'];
    const rows = filtered.map(i => [i.product_name, i.sku, i.batch_number || '', i.expiry_date, i.days_until_expiry, i.quantity, i.warehouse_name, i.urgency]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `expiry-report-${new Date().toISOString().slice(0,10)}.csv`; a.click();
  };

  const urgencyColor = (u) => u === 'EXPIRED' ? '#dc2626' : u === 'CRITICAL' ? '#ea580c' : u === 'WARNING' ? '#d97706' : '#2563eb';
  const urgencyBg = (u) => u === 'EXPIRED' ? '#fef2f2' : u === 'CRITICAL' ? '#fff7ed' : u === 'WARNING' ? '#fffbeb' : '#eff6ff';

  return (
    <div className="expiry-container">
      <div className="page-header"><div className="header-content"><div className="header-icon expiry">⏰</div><div><h1>Expiry Tracker</h1><p>Monitor product shelf life — FIFO enforcement</p></div></div>
        <div className="header-actions"><button className="action-btn" onClick={exportCSV}>📥 Export</button><button className="action-btn refresh" onClick={loadData}>🔄 Refresh</button></div>
      </div>

      <div className="expiry-summary-cards">
        <div className="exp-card expired" onClick={() => setFilter('EXPIRED')}><div className="exp-num">{data.summary.expired || 0}</div><div className="exp-label">Expired</div></div>
        <div className="exp-card critical" onClick={() => setFilter('CRITICAL')}><div className="exp-num">{data.summary.critical || 0}</div><div className="exp-label">≤30 Days</div></div>
        <div className="exp-card warning" onClick={() => setFilter('WARNING')}><div className="exp-num">{data.summary.warning || 0}</div><div className="exp-label">≤60 Days</div></div>
        <div className="exp-card info" onClick={() => setFilter('INFO')}><div className="exp-num">{data.summary.info || 0}</div><div className="exp-label">≤{days} Days</div></div>
        <div className="exp-card all" onClick={() => setFilter('all')}><div className="exp-num">{data.items.length}</div><div className="exp-label">All</div></div>
      </div>

      <div className="expiry-controls">
        <div className="form-group"><label>Show items expiring within:</label>
          <select value={days} onChange={e => setDays(parseInt(e.target.value))}><option value={30}>30 days</option><option value={60}>60 days</option><option value={90}>90 days</option><option value={180}>180 days</option><option value={365}>1 year</option></select>
        </div>
        <span className="filter-label">Showing: {filter === 'all' ? 'All' : filter} ({filtered.length} items)</span>
      </div>

      {loading ? <div className="loading-state">Loading expiry data...</div> : (
        <div className="expiry-table-container">
          {filtered.length === 0 ? <div className="no-data-message">✅ No expiry alerts for the selected period. Your stock is fresh!</div> : (
            <table className="expiry-table">
              <thead><tr><th>Status</th><th>Product</th><th>Batch</th><th>Expiry Date</th><th>Days Left</th><th>Quantity</th><th>Warehouse</th></tr></thead>
              <tbody>
                {filtered.map((item, i) => (
                  <tr key={i} style={{ backgroundColor: urgencyBg(item.urgency) }}>
                    <td><span className="urgency-badge" style={{ backgroundColor: urgencyColor(item.urgency), color: 'white' }}>{item.urgency}</span></td>
                    <td><strong>{item.product_name}</strong><br/><small className="sku">{item.sku}</small></td>
                    <td>{item.batch_number || '-'}</td><td>{item.expiry_date}</td>
                    <td style={{ color: urgencyColor(item.urgency), fontWeight: 700 }}>{item.days_until_expiry < 0 ? `${Math.abs(item.days_until_expiry)}d overdue` : `${item.days_until_expiry}d`}</td>
                    <td>{item.quantity}</td><td>{item.warehouse_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
export default ExpiryTracker;
