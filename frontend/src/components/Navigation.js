import React, { useState, useEffect, useRef } from 'react';
import { rbacAPI } from '../services/api';
import './Navigation.css';

function Navigation({ currentPage, onNavigate, user, onLogout }) {
  const [perms, setPerms] = useState({});
  const [openDropdown, setOpenDropdown] = useState('');
  const navRef = useRef(null);

  useEffect(() => {
    if (user?.role) {
      rbacAPI.getNavItems(user.role.toUpperCase())
        .then(p => setPerms(p))
        .catch(() => {
          if (user.role.toUpperCase() === 'ADMIN') {
            setPerms({ dashboard:true, products:true, inventory:true, fifo:true, purchasing:true, sales:true, deliveries:true, financial:true, reports:true, admin:true, returns:true, notifications:true, barcodes:true, currency:true, driver_app:true, route_optimizer:true });
          } else { setPerms({}); }
        });
    }
  }, [user?.role]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClick = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) {
        setOpenDropdown('');
      }
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('touchstart', handleClick);
    return () => { document.removeEventListener('mousedown', handleClick); document.removeEventListener('touchstart', handleClick); };
  }, []);

  const p = (key) => perms[key] !== false;

  const inventoryItems = [
    p('products')  && { id: 'products', icon: '▣', label: 'Products', page: 'products' },
    p('inventory') && { id: 'stock-receipt', icon: '↓', label: 'Stock Receipt', page: 'stock-receipt' },
    p('inventory') && { id: 'stock-levels', icon: '≡', label: 'Stock Levels', page: 'stock-levels' },
    p('inventory') && { id: 'stock-take', icon: '✓', label: 'Stock Take', page: 'stock-take' },
    p('inventory') && { id: 'stock-issue', icon: '↑', label: 'Stock Issue', page: 'stock-issue' },
    p('inventory') && { id: 'expiry-tracker', icon: '◷', label: 'Expiry Tracker', page: 'expiry-tracker' },
    p('fifo')      && { id: 'fifo-manager', icon: '⇄', label: 'FIFO Batches', page: 'fifo-manager' },
    p('barcodes')  && { id: 'barcode-labels', icon: '▤', label: 'Barcode Labels', page: 'barcode-labels' },
    p('barcodes')  && { id: 'barcode-scanner', icon: '◫', label: 'Barcode Scanner', page: 'barcode-scanner' },
    p('inventory') && { id: 'inventory-dashboard', icon: '◈', label: 'Inventory Overview', page: 'inventory-dashboard' },
    p('admin')     && { id: 'warehouses', icon: '⬡', label: 'Warehouses', page: 'warehouses' },
  ].filter(Boolean);

  const purchasingItems = [
    p('purchasing') && { id: 'suppliers', icon: '◉', label: 'Suppliers', page: 'suppliers' },
    p('purchasing') && { id: 'purchase-orders', icon: '□', label: 'Purchase Orders', page: 'purchase-orders' },
    p('purchasing') && { id: 'purchase-invoices', icon: '◧', label: 'Purchase Invoices', page: 'purchase-invoices' },
  ].filter(Boolean);

  const salesItems = [
    p('sales') && { id: 'customers', icon: '◎', label: 'Customers', page: 'customers' },
    p('sales') && { id: 'sales-orders', icon: '◻', label: 'Sales Orders', page: 'sales-orders' },
    p('sales') && { id: 'sales-invoices', icon: '◨', label: 'Invoices', page: 'sales-invoices' },
    p('sales') && { id: 'pricing-rules', icon: '%', label: 'Pricing Rules', page: 'pricing-rules' },
    p('deliveries') && { id: 'deliveries', icon: '→', label: 'Deliveries', page: 'deliveries' },
    p('sales') && { id: 'customer-statement', icon: '≣', label: 'Statement', page: 'customer-statement' },
    p('returns') && { id: 'returns-manager', icon: '↩', label: 'Returns / Credits', page: 'returns-manager' },
  ].filter(Boolean);

  const deliveryItems = [
    p('driver_app') && { id: 'driver-app', icon: '◁', label: 'Driver App', page: 'driver-app' },
    p('route_optimizer') && { id: 'route-optimizer', icon: '⊕', label: 'Route Optimizer', page: 'route-optimizer' },
  ].filter(Boolean);

  const financeItems = [
    p('financial') && { id: 'financial', icon: '◈', label: 'Dashboard', page: 'financial' },
    p('currency')  && { id: 'multi-currency', icon: '⇌', label: 'Multi-Currency', page: 'multi-currency' },
    p('reports')   && { id: 'reports', icon: '▦', label: 'Reports', page: 'reports' },
  ].filter(Boolean);

  const adminItems = [
    p('admin') && { id: 'users', icon: '◯', label: 'Users', page: 'users' },
    p('admin') && { id: 'settings', icon: '◎', label: 'Settings', page: 'settings' },
    p('notifications') && { id: 'notifications', icon: '◉', label: 'Notifications', page: 'notifications' },
    p('admin') && { id: 'activity-log', icon: '≡', label: 'Activity Log', page: 'activity-log' },
  ].filter(Boolean);

  const dropdowns = [
    inventoryItems.length > 0  && { id: 'inventory', label: 'Inventory', items: inventoryItems },
    purchasingItems.length > 0 && { id: 'purchasing', label: 'Purchasing', items: purchasingItems },
    salesItems.length > 0      && { id: 'sales', label: 'Sales', items: salesItems },
    deliveryItems.length > 0   && { id: 'delivery', label: 'Delivery', items: deliveryItems },
    financeItems.length > 0    && { id: 'finance', label: 'Finance', items: financeItems },
    adminItems.length > 0      && { id: 'admin', label: 'Admin', items: adminItems },
  ].filter(Boolean);

  const toggleDropdown = (id) => setOpenDropdown(prev => prev === id ? '' : id);

  return (
    <nav className="navigation" ref={navRef}>
      <div className="nav-container">
        <div className="nav-brand" onClick={() => { onNavigate('dashboard'); setOpenDropdown(''); }}>
          <div className="brand-logo">AK</div>
          <div>
            <div className="brand-name">AK Al Momaiza</div>
            <div className="brand-subtitle">WMS v5.3</div>
          </div>
        </div>

        <div className="nav-items">
          <button
            className={`nav-item ${currentPage === 'dashboard' ? 'active' : ''}`}
            onClick={() => { onNavigate('dashboard'); setOpenDropdown(''); }}>
            <span className="nav-label">Dashboard</span>
          </button>

          {dropdowns.map(dd => (
            <div key={dd.id} className="nav-dropdown">
              <button
                className={`nav-item ${dd.items.some(i => i.page === currentPage) ? 'active' : ''}`}
                onClick={() => toggleDropdown(dd.id)}>
                <span className="nav-label">{dd.label}</span>
                <span className="nav-chevron">{openDropdown === dd.id ? '▴' : '▾'}</span>
              </button>
              {openDropdown === dd.id && (
                <div className="dropdown-menu">
                  {dd.items.map(item => (
                    <button key={item.id}
                      className={`dropdown-item ${currentPage === item.page ? 'active' : ''}`}
                      onClick={() => { onNavigate(item.page); setOpenDropdown(''); }}>
                      <span className="dropdown-icon">{item.icon}</span>
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="nav-user-section">
          <div className="nav-user-info">
            {user?.role && <span className="nav-role-badge">{user.role.replace(/_/g, ' ')}</span>}
            <span className="nav-username">{user?.full_name || user?.username}</span>
          </div>
          <button className="nav-logout-btn" onClick={onLogout}>Logout</button>
        </div>
      </div>
    </nav>
  );
}

export default Navigation;
