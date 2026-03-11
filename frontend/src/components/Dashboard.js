// Dashboard Component
import React, { useState, useEffect } from 'react';
import { productAPI, categoryAPI } from '../services/api';
import { PERMISSIONS } from '../constants/permissions';
import './Dashboard.css';

/* ── Permission helper ── */
const userRole = localStorage.getItem('userRole') || '';
const userPerms = JSON.parse(localStorage.getItem('userPermissions') || '[]');
const can = (perm) => {
  if (userRole.toLowerCase() === 'admin') return true;
  return userPerms.includes(perm);
};

function Dashboard({ user }) {
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalCategories: 0,
    activeProducts: 0,
    lowStockProducts: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load dashboard data when component mounts
  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch products and categories
      const [productsRes, categoriesRes] = await Promise.all([
        productAPI.getAll(),
        categoryAPI.getAll(),
      ]);

      const productsRaw = productsRes.data;
      const categoriesRaw = categoriesRes.data;
      const products = Array.isArray(productsRaw) ? productsRaw : (productsRaw?.data || productsRaw?.items || []);
      const categories = Array.isArray(categoriesRaw) ? categoriesRaw : (categoriesRaw?.data || categoriesRaw?.items || []);

      // Calculate statistics
      setStats({
        totalProducts: products.length,
        totalCategories: categories.length,
        activeProducts: products.filter(p => p.is_active).length,
        lowStockProducts: products.filter(p => p.reorder_level > 0).length,
      });

      setError(null);
    } catch (err) {
      console.error('Error loading dashboard:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="dashboard">
        <div className="loading">Loading dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard">
        <div className="error">{error}</div>
        <button onClick={loadDashboardData}>Retry</button>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="page-header">
        <div><h1 className="page-title">Dashboard</h1><p className="page-subtitle">Welcome back, {user.full_name}!</p></div>
      </div>

      {can(PERMISSIONS.DASHBOARD.WIDGET_INVENTORY) && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon"></div>
            <div className="stat-content">
              <h3>{stats.totalProducts}</h3>
              <p>Total Products</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon"></div>
            <div className="stat-content">
              <h3>{stats.totalCategories}</h3>
              <p>Categories</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon"></div>
            <div className="stat-content">
              <h3>{stats.activeProducts}</h3>
              <p>Active Products</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon"></div>
            <div className="stat-content">
              <h3>{stats.lowStockProducts}</h3>
              <p>Need Reorder</p>
            </div>
          </div>
        </div>
      )}

      <div className="quick-actions">
        <h3>Quick Actions</h3>
        <div className="action-buttons">
          <button className="action-btn">Add Product</button>
          <button className="action-btn">View Inventory</button>
          <button className="action-btn">View Orders</button>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;