import React, { useState, useEffect } from 'react';
import { inventoryAPI } from '../services/api';
import './InventoryDashboard.css';

function InventoryDashboard() {
  const [summary, setSummary] = useState(null);
  const [lowStock, setLowStock] = useState([]);
  const [recentMovements, setRecentMovements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [summaryData, lowStockData, movementsData] = await Promise.all([
        inventoryAPI.getSummary(),
        inventoryAPI.getLowStock(),
        inventoryAPI.getMovements({ limit: 10 })
      ]);

      setSummary(summaryData);
      setLowStock(lowStockData.items || []);
      setRecentMovements(movementsData);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="inventory-dashboard-container">
        <div className="loading-state">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="inventory-dashboard-container">
      <div className="dashboard-header">
        <h1>📦 Inventory Dashboard</h1>
        <p>Real-time overview of your warehouse</p>
        <button className="refresh-btn" onClick={loadDashboardData}>
          🔄 Refresh
        </button>
      </div>

      {/* Summary Stats */}
      <div className="stats-grid">
        <div className="stat-card primary">
          <div className="stat-icon">📦</div>
          <div className="stat-content">
            <div className="stat-value">{summary?.total_products_in_stock || 0}</div>
            <div className="stat-label">Products in Stock</div>
          </div>
        </div>

        <div className="stat-card success">
          <div className="stat-icon">💰</div>
          <div className="stat-content">
            <div className="stat-value">OMR {summary?.total_stock_value?.toFixed(3) || '0.000'}</div>
            <div className="stat-label">Total Stock Value</div>
          </div>
        </div>

        <div className="stat-card warning">
          <div className="stat-icon">⚠️</div>
          <div className="stat-content">
            <div className="stat-value">{summary?.low_stock_items || 0}</div>
            <div className="stat-label">Low Stock Items</div>
          </div>
        </div>

        <div className="stat-card danger">
          <div className="stat-icon">🚫</div>
          <div className="stat-content">
            <div className="stat-value">{summary?.out_of_stock_items || 0}</div>
            <div className="stat-label">Out of Stock</div>
          </div>
        </div>
      </div>

      {/* Stock by Warehouse */}
      <div className="dashboard-section">
        <h2>Stock by Warehouse</h2>
        <div className="warehouse-grid">
          {summary?.stock_by_warehouse?.map((wh, idx) => (
            <div key={idx} className="warehouse-card">
              <div className="warehouse-name">{wh.warehouse}</div>
              <div className="warehouse-stats">
                <div className="wh-stat">
                  <span className="wh-label">Products:</span>
                  <span className="wh-value">{wh.product_count}</span>
                </div>
                <div className="wh-stat">
                  <span className="wh-label">Total Units:</span>
                  <span className="wh-value">{wh.total_units}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Low Stock Alerts */}
      {lowStock.length > 0 && (
        <div className="dashboard-section">
          <h2>⚠️ Low Stock Alerts</h2>
          <div className="alerts-container">
            {lowStock.map((item, idx) => (
              <div key={idx} className={`alert-item ${item.urgency?.toLowerCase()}`}>
                <div className="alert-header">
                  <span className="alert-product">{item.product_name}</span>
                  <span className={`urgency-badge ${item.urgency?.toLowerCase()}`}>
                    {item.urgency}
                  </span>
                </div>
                <div className="alert-details">
                  <span>On Hand: {item.quantity_on_hand}</span>
                  <span>Reorder Level: {item.reorder_level}</span>
                  <span>Shortage: {item.shortage}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Movements */}
      <div className="dashboard-section">
        <h2>Recent Movements</h2>
        <div className="movements-list">
          {recentMovements.slice(0, 8).map((movement, idx) => (
            <div key={idx} className="movement-item">
              <div className={`movement-type ${movement.transaction_type.toLowerCase()}`}>
                {movement.transaction_type === 'RECEIPT' ? '📦' : '📤'}
              </div>
              <div className="movement-content">
                <div className="movement-product">{movement.product_name}</div>
                <div className="movement-details">
                  {movement.warehouse_name} • {movement.reference_number}
                </div>
              </div>
              <div className="movement-quantity">
                {movement.transaction_type === 'RECEIPT' ? '+' : '-'}{movement.quantity}
              </div>
              <div className="movement-date">
                {new Date(movement.date).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default InventoryDashboard;