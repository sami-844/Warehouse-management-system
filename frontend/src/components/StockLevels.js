import React, { useState, useEffect } from 'react';
import { inventoryAPI, warehouseAPI } from '../services/api';
import './StockLevels.css';

function StockLevels() {
  const [stockLevels, setStockLevels] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);

  useEffect(() => { loadWarehouses(); }, []);
  useEffect(() => { loadStockLevels(); }, [selectedWarehouse, showLowStockOnly]);

  const loadWarehouses = async () => { try { setWarehouses(await warehouseAPI.list()); } catch(e) { console.error(e); } };
  const loadStockLevels = async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedWarehouse !== 'all') params.warehouse_id = selectedWarehouse;
      if (showLowStockOnly) params.low_stock_only = true;
      setStockLevels(await inventoryAPI.getStockLevels(params));
    } catch(e) { console.error(e); } finally { setLoading(false); }
  };

  const filtered = stockLevels.filter(i =>
    i.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatus = (item) => item.quantity_on_hand === 0 ? 'out-of-stock' : item.needs_reorder ? 'low-stock' : 'in-stock';
  const getStatusText = (item) => item.quantity_on_hand === 0 ? '🔴 Out of Stock' : item.needs_reorder ? '🟡 Low Stock' : '🟢 In Stock';

  const exportCSV = () => {
    const headers = ['Product', 'SKU', 'Warehouse', 'Quantity', 'Reorder Level', 'Unit', 'Stock Value (OMR)', 'Status'];
    const rows = filtered.map(i => [i.product_name, i.sku, i.warehouse_name, i.quantity_on_hand, i.reorder_level, i.unit_of_measure, i.stock_value, getStatus(i) === 'in-stock' ? 'OK' : getStatus(i) === 'low-stock' ? 'Low' : 'Out']);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `stock-levels-${new Date().toISOString().slice(0,10)}.csv`; a.click();
  };

  const totalValue = filtered.reduce((s, i) => s + (i.stock_value || 0), 0);
  const totalUnits = filtered.reduce((s, i) => s + i.quantity_on_hand, 0);

  return (
    <div className="stock-levels-container">
      <div className="page-header">
        <div className="header-content"><div className="header-icon levels">📊</div><div><h1>Stock Levels</h1><p>Real-time inventory across all locations</p></div></div>
        <div className="header-actions">
          <button className="action-btn" onClick={exportCSV}>📥 Export CSV</button>
          <button className="action-btn refresh" onClick={loadStockLevels}>🔄 Refresh</button>
        </div>
      </div>

      <div className="summary-stats">
        <div className="stat-card"><div className="stat-value">{filtered.length}</div><div className="stat-label">Products</div></div>
        <div className="stat-card"><div className="stat-value">{totalUnits.toLocaleString()}</div><div className="stat-label">Total Units</div></div>
        <div className="stat-card gold"><div className="stat-value">{totalValue.toFixed(3)}</div><div className="stat-label">Value (OMR)</div></div>
        <div className="stat-card alert"><div className="stat-value">{filtered.filter(i => i.needs_reorder).length}</div><div className="stat-label">Need Reorder</div></div>
        <div className="stat-card danger"><div className="stat-value">{filtered.filter(i => i.quantity_on_hand === 0).length}</div><div className="stat-label">Out of Stock</div></div>
      </div>

      <div className="filters-section">
        <div className="filter-group"><label>Warehouse:</label>
          <select value={selectedWarehouse} onChange={e => setSelectedWarehouse(e.target.value)}>
            <option value="all">All Warehouses</option>
            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
        <div className="filter-group"><label>Search:</label><input type="text" placeholder="Search products..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
        <div className="filter-checkbox"><label><input type="checkbox" checked={showLowStockOnly} onChange={e => setShowLowStockOnly(e.target.checked)} /> Low stock only</label></div>
      </div>

      {loading ? <div className="loading-state">Loading stock levels...</div> : (
        <div className="stock-table-container">
          <table className="stock-table">
            <thead><tr><th>Product</th><th>SKU</th><th>Warehouse</th><th>On Hand</th><th>Reorder Lvl</th><th>Unit</th><th>Value (OMR)</th><th>Status</th></tr></thead>
            <tbody>
              {filtered.length === 0 ? <tr><td colSpan="8" className="no-data">No stock data. Receive some products first!</td></tr> :
                filtered.map((item, idx) => (
                  <tr key={idx} className={`stock-row ${getStatus(item)}`}>
                    <td className="product-name">{item.product_name}</td>
                    <td className="sku">{item.sku}</td>
                    <td>{item.warehouse_name}</td>
                    <td className="quantity">{item.quantity_on_hand}</td>
                    <td>{item.reorder_level}</td>
                    <td>{item.unit_of_measure}</td>
                    <td className="value">{(item.stock_value || 0).toFixed(3)}</td>
                    <td><span className={`status-badge ${getStatus(item)}`}>{getStatusText(item)}</span></td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
export default StockLevels;
