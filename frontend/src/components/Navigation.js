import React, { useState, useEffect } from 'react';
import { rbacAPI } from '../services/api';
import './Navigation.css';

function Navigation({ currentPage, onNavigate, user, onLogout }) {
  const [perms, setPerms] = useState({
    dashboard:true, products:true, inventory:true, fifo:true,
    purchasing:true, sales:true, deliveries:true, financial:true,
    reports:true, admin:true, returns:true, notifications:true,
    barcodes:true, currency:true, driver_app:true, route_optimizer:true
  });

  useEffect(() => {
    if (user?.role) {
      rbacAPI.getNavItems(user.role.toUpperCase())
        .then(p => setPerms(p))
        .catch(() => {});
    }
  }, [user?.role]);

  const p = (key) => perms[key] !== false;

  const inventoryItems = [
    p('products')  && { id: 'products',            label: 'Products',           page: 'products' },
    p('inventory') && { id: 'stock-receipt',        label: 'Stock Receipt',      page: 'stock-receipt' },
    p('inventory') && { id: 'stock-levels',         label: 'Stock Levels',       page: 'stock-levels' },
    p('inventory') && { id: 'stock-take',           label: 'Stock Take',         page: 'stock-take' },
    p('inventory') && { id: 'stock-issue',          label: 'Stock Issue',        page: 'stock-issue' },
    p('inventory') && { id: 'expiry-tracker',       label: 'Expiry Tracker',     page: 'expiry-tracker' },
    p('fifo')      && { id: 'fifo-manager',         label: 'FIFO Batches',       page: 'fifo-manager' },
    p('barcodes')  && { id: 'barcode-labels',       label: 'Barcode Labels',     page: 'barcode-labels' },
    p('inventory') && { id: 'inventory-dashboard',  label: 'Inventory Overview', page: 'inventory-dashboard' },
    p('admin')     && { id: 'warehouses',           label: 'Warehouses',         page: 'warehouses' },
  ].filter(Boolean);

  const purchasingItems = [
    p('purchasing') && { id: 'suppliers',         label: 'Suppliers',         page: 'suppliers' },
    p('purchasing') && { id: 'purchase-orders',   label: 'Purchase Orders',   page: 'purchase-orders' },
    p('purchasing') && { id: 'purchase-invoices', label: 'Purchase Invoices', page: 'purchase-invoices' },
  ].filter(Boolean);

  const salesItems = [
    p('sales')      && { id: 'customers',          label: 'Customers',        page: 'customers' },
    p('sales')      && { id: 'sales-orders',       label: 'Sales Orders',     page: 'sales-orders' },
    p('sales')      && { id: 'sales-invoices',     label: 'Invoices',         page: 'sales-invoices' },
    p('sales')      && { id: 'pricing-rules',      label: 'Pricing Rules',    page: 'pricing-rules' },
    p('deliveries') && { id: 'deliveries',         label: 'Deliveries',       page: 'deliveries' },
    p('returns')    && { id: 'returns-manager',    label: 'Returns / Credits', page: 'returns-manager' },
  ].filter(Boolean);

  const deliveryItems = [
    p('driver_app')      && { id: 'driver-app',      label: 'Driver App',       page: 'driver-app' },
    p('route_optimizer') && { id: 'route-optimizer', label: 'Route Optimizer',  page: 'route-optimizer' },
  ].filter(Boolean);

  const financeItems = [
    p('financial') && { id: 'financial',      label: 'Dashboard',      page: 'financial' },
    p('currency')  && { id: 'multi-currency', label: 'Multi-Currency', page: 'multi-currency' },
    p('reports')   && { id: 'reports',        label: 'Reports',        page: 'reports' },
  ].filter(Boolean);

  const adminItems = [
    p('admin')         && { id: 'users',         label: 'Users',         page: 'users' },
    p('admin')         && { id: 'settings',       label: 'Settings',      page: 'settings' },
    p('notifications') && { id: 'notifications',  label: 'Notifications', page: 'notifications' },
    p('admin')         && { id: 'activity-log',   label: 'Activity Log',  page: 'activity-log' },
  ].filter(Boolean);

  const dropdowns = [
    { id: 'inventory',  label: 'Inventory ▾',  items: inventoryItems },
    { id: 'purchasing', label: 'Purchasing ▾', items: purchasingItems },
    { id: 'sales',      label: 'Sales ▾',      items: salesItems },
    { id: 'delivery',   label: 'Delivery ▾',   items: deliveryItems },
    { id: 'finance',    label: 'Finance ▾',    items: financeItems },
    { id: 'admin',      label: 'Admin ▾',      items: adminItems },
  ].filter(d => d.items.length > 0);

  return (
    <nav style={{
      background: '#1a2332', position: 'sticky', top: 0, zIndex: 1000,
      boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', padding: '0 20px',
        height: 52, maxWidth: 1800, margin: '0 auto', gap: 8
      }}>
        {/* Brand */}
        <div
          onClick={() => onNavigate('dashboard')}
          style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer', marginRight:16 }}
        >
          <div style={{
            width:32, height:32, background:'#16a34a', borderRadius:8,
            display:'flex', alignItems:'center', justifyContent:'center',
            color:'white', fontWeight:700, fontSize:13
          }}>AK</div>
          <div>
            <div style={{ color:'white', fontWeight:700, fontSize:14 }}>AK Al Momaiza</div>
            <div style={{ color:'rgba(255,255,255,0.5)', fontSize:11 }}>WMS v5.3</div>
          </div>
        </div>

        {/* Dashboard button */}
        <button
          onClick={() => onNavigate('dashboard')}
          style={{
            background: currentPage === 'dashboard' ? '#16a34a' : 'transparent',
            border: 'none', color: 'white', padding: '6px 14px', borderRadius: 6,
            cursor: 'pointer', fontSize: 13, fontWeight: 500
          }}
        >
          Dashboard
        </button>

        {/* CSS hover dropdowns */}
        {dropdowns.map(dd => (
          <div key={dd.id} className="css-dropdown">
            <button
              className="css-dropdown-btn"
              style={{
                background: dd.items.some(i => i.page === currentPage) ? '#16a34a' : 'transparent',
                border: 'none', color: 'white', padding: '6px 14px', borderRadius: 6,
                cursor: 'pointer', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap'
              }}
            >
              {dd.label}
            </button>
            <div className="css-dropdown-menu">
              {dd.items.map(item => (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.page)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    background: currentPage === item.page ? '#dcfce7' : 'transparent',
                    color: currentPage === item.page ? '#15803d' : '#333',
                    border: 'none', padding: '9px 16px', cursor: 'pointer',
                    fontSize: 13, fontWeight: currentPage === item.page ? 600 : 400,
                    borderRadius: 6
                  }}
                  onMouseEnter={e => e.target.style.background = '#f0fdf4'}
                  onMouseLeave={e => e.target.style.background = currentPage === item.page ? '#dcfce7' : 'transparent'}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        ))}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* User info + logout */}
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          {user?.role && (
            <span style={{
              background:'rgba(22,163,74,0.2)', color:'#86efac',
              padding:'3px 8px', borderRadius:4, fontSize:11, fontWeight:600
            }}>
              {user.role.replace(/_/g,' ')}
            </span>
          )}
          <span style={{ color:'rgba(255,255,255,0.7)', fontSize:13 }}>
            {user?.full_name || user?.username}
          </span>
          <button
            onClick={onLogout}
            style={{
              background:'transparent', border:'1px solid rgba(255,255,255,0.3)',
              color:'white', padding:'5px 14px', borderRadius:6,
              cursor:'pointer', fontSize:13
            }}
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}

export default Navigation;