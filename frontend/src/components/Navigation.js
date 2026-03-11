import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard, Package, ShoppingBag, ShoppingCart, Truck,
  DollarSign, Settings, ChevronRight, LogOut, User,
  PanelLeftClose, PanelLeftOpen, Menu,
} from 'lucide-react';
import './Navigation.css';

const SECTIONS = [
  {
    key: 'inventory',
    label: 'Inventory',
    Icon: Package,
    items: [
      { label: 'Products',        page: 'products' },
      { label: 'Stock Receipt',   page: 'stock-receipt' },
      { label: 'Stock Levels',    page: 'stock-levels' },
      { label: 'Stock Take',      page: 'stock-take' },
      { label: 'Stock Issue',     page: 'stock-issue' },
      { label: 'Damage Items',    page: 'damage-items' },
      { label: 'Stock Log',       page: 'stock-log' },
      { label: 'Categories',      page: 'categories' },
      { label: 'Expiry Tracker',  page: 'expiry-tracker' },
      { label: 'FIFO Manager',    page: 'fifo-manager' },
      { label: 'Barcode Scanner', page: 'barcode-scanner' },
      { label: 'Barcode Labels',  page: 'barcode-labels' },
      { label: 'Warehouses',      page: 'warehouses' },
      { label: 'Overview',        page: 'inventory-dashboard' },
    ],
  },
  {
    key: 'purchasing',
    label: 'Purchasing',
    Icon: ShoppingBag,
    items: [
      { label: 'Suppliers',       page: 'suppliers' },
      { label: 'Purchase Orders', page: 'purchase-orders' },
      { label: 'PO Invoices',     page: 'purchase-invoices' },
      { label: 'Landed Costs',    page: 'landed-costs' },
      { label: 'Purchase Returns', page: 'purchase-returns' },
      { label: 'Bills',            page: 'bills' },
    ],
  },
  {
    key: 'sales',
    label: 'Sales',
    Icon: ShoppingCart,
    items: [
      { label: 'Customers',       page: 'customers' },
      { label: 'Estimates',       page: 'estimates' },
      { label: 'Sales Orders',    page: 'sales-orders' },
      { label: 'Invoices',        page: 'sales-invoices' },
      { label: 'Pricing Rules',   page: 'pricing-rules' },
      { label: 'Deliveries',      page: 'deliveries' },
      { label: 'Returns',         page: 'returns-manager' },
    ],
  },
  {
    key: 'delivery',
    label: 'Delivery',
    Icon: Truck,
    items: [
      { label: 'Driver App',      page: 'driver-app' },
      { label: 'Route Optimizer', page: 'route-optimizer' },
    ],
  },
  {
    key: 'finance',
    label: 'Finance',
    Icon: DollarSign,
    items: [
      { label: 'Financial Dashboard', page: 'financial' },
      { label: 'Chart of Accounts',  page: 'chart-of-accounts' },
      { label: 'Bank Accounts',     page: 'bank-accounts' },
      { label: 'Money Transfer',     page: 'money-transfer' },
      { label: 'Journal Entries',    page: 'journal-entries' },
      { label: 'Cash Transactions',  page: 'cash-transactions' },
      { label: 'Multi-Currency',      page: 'multi-currency' },
      { label: 'Reports',             page: 'reports' },
      { label: 'Balance Sheet',      page: 'balance-sheet' },
      { label: 'General Ledger',     page: 'general-ledger' },
      { label: 'Vendor Ledger',      page: 'vendor-ledger' },
      { label: 'All Sales Report',  page: 'all-sales-report' },
      { label: 'Customer Summary',  page: 'customer-sales-summary' },
      { label: 'Product Sales',     page: 'product-sales' },
      { label: 'All Purchases',     page: 'all-purchases-report' },
      { label: 'Expense Breakdown', page: 'expense-breakdown' },
      { label: 'Sales Tax',         page: 'sales-tax' },
      { label: 'VAT Return',          page: 'vat-return' },
      { label: 'Bank Reconciliation', page: 'bank-recon' },
      { label: 'Advance Payments',   page: 'advance-payments' },
    ],
  },
  {
    key: 'admin',
    label: 'Admin',
    Icon: Settings,
    adminOnly: true,
    items: [
      { label: 'Users',           page: 'users' },
      { label: 'Settings',        page: 'settings' },
      { label: 'Lookup Tables',   page: 'settings-lookup' },
      { label: 'Product Brands',  page: 'product-brands' },
      { label: 'Variations',      page: 'variations' },
      { label: 'Notifications',   page: 'notifications' },
      { label: 'Messaging',       page: 'messaging' },
      { label: 'Deleted Items',   page: 'deleted-items' },
    ],
  },
];

function sectionForPage(page) {
  for (const s of SECTIONS) {
    if (s.items.some(i => i.page === page)) return s.key;
  }
  return null;
}

function Navigation({ currentPage, onNavigate, user, onLogout, onWidthChange }) {
  const [collapsed, setCollapsed] = useState(false);
  const [open, setOpen] = useState(() => sectionForPage(currentPage));
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [mobileOpen, setMobileOpen] = useState(false);

  const role = user?.role?.toUpperCase() || '';
  const isAdmin = role === 'ADMIN';

  // Close mobile sidebar when navigating
  const navigate = (page) => {
    if (isMobile) setMobileOpen(false);
    onNavigate(page);
  };

  useEffect(() => {
    const sec = sectionForPage(currentPage);
    if (sec) setOpen(sec);
  }, [currentPage]);

  // Track viewport width
  useEffect(() => {
    const handler = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setMobileOpen(false);
    };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // Broadcast sidebar width to App.js
  useEffect(() => {
    onWidthChange?.(isMobile ? 0 : (collapsed ? 60 : 220));
  }, [collapsed, isMobile, onWidthChange]);

  const toggleSection = (key) => {
    if (collapsed) return;
    setOpen(prev => (prev === key ? null : key));
  };

  const sidebarStyle = {
    position: 'fixed',
    top: isMobile ? 56 : 0,
    left: isMobile ? (mobileOpen ? 0 : -220) : 0,
    width: isMobile ? 220 : (collapsed ? 60 : 220),
    height: isMobile ? 'calc(100vh - 56px)' : '100vh',
    background: '#0f172a',
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
    overflowX: 'hidden',
    zIndex: 50,
    transition: isMobile ? 'left 0.2s ease' : 'width 0.2s ease',
    userSelect: 'none',
  };

  return (
    <>
      {/* Mobile top bar */}
      {isMobile && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, height: 56,
          background: '#0f172a', display: 'flex', alignItems: 'center',
          padding: '0 16px', zIndex: 51, borderBottom: '1px solid #1e293b',
        }}>
          <button
            onClick={() => setMobileOpen(o => !o)}
            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}
          >
            <Menu size={22} />
          </button>
          <div style={{ marginLeft: 12, color: '#fff', fontWeight: 700, fontSize: 15, fontFamily: 'Figtree, sans-serif' }}>
            AK WMS
          </div>
        </div>
      )}

      {/* Backdrop (mobile only, when open) */}
      {isMobile && mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 49, top: 56 }}
        />
      )}

      {/* Sidebar */}
      <div style={sidebarStyle}>
        {/* Brand + Toggle */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between',
          padding: collapsed ? '14px 0' : '14px 12px', borderBottom: '1px solid #1e293b',
          flexShrink: 0,
        }}>
          {!collapsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
              <div style={{
                width: 28, height: 28, background: '#16a34a', borderRadius: 6,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <span style={{ color: '#fff', fontWeight: 900, fontSize: 13, fontFamily: 'Figtree, sans-serif' }}>AK</span>
              </div>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ color: '#fff', fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap', fontFamily: 'Figtree, sans-serif', lineHeight: 1.2 }}>Al Mumayza</div>
                <div style={{ color: '#64748b', fontSize: 10, whiteSpace: 'nowrap', fontFamily: 'Figtree, sans-serif' }}>WMS v5.3</div>
              </div>
            </div>
          )}
          {/* Desktop collapse toggle — hidden on mobile */}
          {!isMobile && (
            <button
              onClick={() => setCollapsed(c => !c)}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', color: '#64748b',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 4, borderRadius: 4, flexShrink: 0,
              }}
              onMouseEnter={e => (e.currentTarget.style.color = '#94a3b8')}
              onMouseLeave={e => (e.currentTarget.style.color = '#64748b')}
            >
              {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            </button>
          )}
        </div>

        {/* Dashboard */}
        <NavItem
          icon={<LayoutDashboard size={16} />}
          label="Dashboard"
          active={currentPage === 'dashboard'}
          collapsed={collapsed}
          onClick={() => navigate('dashboard')}
        />

        {/* Sections */}
        <div style={{ flex: 1 }}>
          {SECTIONS.map(section => {
            if (section.adminOnly && !isAdmin) return null;

            const isOpen = open === section.key && !collapsed;
            const sectionActive = section.items.some(i => i.page === currentPage);

            return (
              <div key={section.key}>
                <button
                  onClick={() => toggleSection(section.key)}
                  title={collapsed ? section.label : undefined}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center',
                    gap: collapsed ? 0 : 8,
                    padding: collapsed ? '10px 0' : '10px 12px',
                    justifyContent: collapsed ? 'center' : 'space-between',
                    background: sectionActive && !isOpen ? '#1e293b' : 'transparent',
                    border: 'none', cursor: 'pointer',
                    color: sectionActive ? '#e2e8f0' : '#94a3b8',
                    transition: 'background 0.1s, color 0.1s',
                    borderLeft: sectionActive ? '2px solid #16a34a' : '2px solid transparent',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#1e293b'; e.currentTarget.style.color = '#e2e8f0'; }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = sectionActive && !isOpen ? '#1e293b' : 'transparent';
                    e.currentTarget.style.color = sectionActive ? '#e2e8f0' : '#94a3b8';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <section.Icon size={16} />
                    {!collapsed && (
                      <span style={{ fontSize: 12, fontWeight: 600, fontFamily: 'Figtree, sans-serif', whiteSpace: 'nowrap' }}>
                        {section.label}
                      </span>
                    )}
                  </div>
                  {!collapsed && (
                    <ChevronRight
                      size={14}
                      style={{
                        transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                        transition: 'transform 0.15s ease',
                        flexShrink: 0,
                      }}
                    />
                  )}
                </button>

                {isOpen && (
                  <div>
                    {section.items.map(item => (
                      <SubItem
                        key={item.page}
                        label={item.label}
                        active={currentPage === item.page}
                        onClick={() => navigate(item.page)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* User Section */}
        <div style={{ borderTop: '1px solid #1e293b', flexShrink: 0 }}>
          {!collapsed && (
            <div style={{ padding: '10px 12px 6px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 28, height: 28, background: '#1e293b', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <User size={14} color="#64748b" />
              </div>
              <div style={{ overflow: 'hidden', flex: 1 }}>
                <div style={{ color: '#e2e8f0', fontSize: 11, fontWeight: 600, fontFamily: 'Figtree, sans-serif', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user?.full_name || user?.username || 'User'}
                </div>
                <div style={{
                  display: 'inline-block', marginTop: 2, padding: '1px 6px',
                  background: '#16a34a', color: '#fff',
                  fontSize: 9, fontWeight: 700, fontFamily: 'Figtree, sans-serif',
                  borderRadius: 3, textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>
                  {(user?.role || 'user').replace(/_/g, ' ')}
                </div>
              </div>
            </div>
          )}
          <button
            onClick={onLogout}
            title="Logout"
            style={{
              width: '100%', display: 'flex', alignItems: 'center',
              gap: collapsed ? 0 : 8,
              padding: collapsed ? '10px 0' : '9px 12px',
              justifyContent: collapsed ? 'center' : 'flex-start',
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#64748b', fontSize: 12, fontFamily: 'Figtree, sans-serif', fontWeight: 600,
              transition: 'background 0.1s, color 0.1s',
              marginBottom: 4,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#1e293b'; e.currentTarget.style.color = '#f87171'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#64748b'; }}
          >
            <LogOut size={15} />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </div>
    </>
  );
}

function NavItem({ icon, label, active, collapsed, onClick }) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? label : undefined}
      style={{
        width: '100%', display: 'flex', alignItems: 'center',
        gap: collapsed ? 0 : 8,
        padding: collapsed ? '10px 0' : '10px 12px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        background: active ? '#dcfce7' : 'transparent',
        color: active ? '#15803d' : '#94a3b8',
        fontWeight: active ? 600 : 400,
        fontSize: 12, fontFamily: 'Figtree, sans-serif',
        border: 'none', cursor: 'pointer',
        transition: 'background 0.1s, color 0.1s',
        borderLeft: active ? '2px solid #16a34a' : '2px solid transparent',
        flexShrink: 0,
      }}
      onMouseEnter={e => { if (!active) { e.currentTarget.style.background = '#1e293b'; e.currentTarget.style.color = '#e2e8f0'; } }}
      onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94a3b8'; } }}
    >
      {icon}
      {!collapsed && <span style={{ whiteSpace: 'nowrap' }}>{label}</span>}
    </button>
  );
}

function SubItem({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', display: 'block', textAlign: 'left',
        padding: '7px 12px 7px 36px',
        background: active ? '#dcfce7' : 'transparent',
        color: active ? '#15803d' : '#94a3b8',
        fontWeight: active ? 600 : 400,
        fontSize: 12, fontFamily: 'Figtree, sans-serif',
        border: 'none', cursor: 'pointer',
        transition: 'background 0.1s, color 0.1s',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        borderLeft: active ? '2px solid #16a34a' : '2px solid transparent',
      }}
      onMouseEnter={e => { if (!active) { e.currentTarget.style.background = '#1e293b'; e.currentTarget.style.color = '#e2e8f0'; } }}
      onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94a3b8'; } }}
    >
      {label}
    </button>
  );
}

export default Navigation;
