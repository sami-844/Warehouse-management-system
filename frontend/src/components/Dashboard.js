// Dashboard Component
import React, { useState, useEffect } from 'react';
import { productAPI, categoryAPI } from '../services/api';
import { PERMISSIONS } from '../constants/permissions';
import './Dashboard.css';

/* ── Permission helper ── */
const userRole = localStorage.getItem('userRole') || '';
const userPerms = (() => { try { return JSON.parse(localStorage.getItem('userPermissions') || '[]'); } catch { return []; } })();
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

      const results = await Promise.allSettled([
        productAPI.getAll(),
        categoryAPI.getAll(),
      ]);

      // Products
      let products = [];
      if (results[0].status === 'fulfilled') {
        const productsRaw = results[0].value?.data;
        products = Array.isArray(productsRaw) ? productsRaw : (productsRaw?.data || productsRaw?.items || []);
      } else {
        console.warn('Products fetch failed:', results[0].reason?.message);
      }

      // Categories
      let categories = [];
      if (results[1].status === 'fulfilled') {
        const categoriesRaw = results[1].value?.data;
        categories = Array.isArray(categoriesRaw) ? categoriesRaw : (categoriesRaw?.data || categoriesRaw?.items || []);
      } else {
        console.warn('Categories fetch failed:', results[1].reason?.message);
      }

      setStats({
        totalProducts: products.length,
        totalCategories: categories.length,
        activeProducts: products.filter(p => p.is_active).length,
        lowStockProducts: products.filter(p => p.reorder_level > 0).length,
      });

      setError(null);
    } catch (err) {
      console.error('Error loading dashboard:', err);
      setError(null); // still render with zeros rather than showing error
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

  /* error state removed — dashboard always renders with zeros as fallback */

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