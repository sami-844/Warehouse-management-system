import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  LayoutDashboard, Package, ShoppingBag, ShoppingCart, Truck,
  DollarSign, Settings, ChevronRight, LogOut, User,
  PanelLeftClose, PanelLeftOpen, Menu, Search, X,
  Users, FileText, ClipboardList,
} from 'lucide-react';
import { canAccessPage } from '../constants/pageAccess';
import { PERMISSIONS } from '../constants/permissions';
import { label } from '../utils/labels';
import { dashboardAPI } from '../services/api';
import './Navigation.css';

const _perms = (() => { try { return JSON.parse(localStorage.getItem('userPermissions') || '[]'); } catch { return []; } })();
const canPerm = (perm) => {
  const r = (localStorage.getItem('userRole') || '').toLowerCase();
  return r === 'admin' || _perms.includes(perm);
};

const getSections = () => [
  {
    key: 'inventory',
    label: label('section.inventory', 'Inventory'),
    Icon: Package,
    items: [
      { label: label('nav.products', 'Products'),               page: 'products' },
      { label: label('nav.stock-receipt', 'Stock Receipt'),      page: 'stock-receipt' },
      { label: label('nav.stock-levels', 'Stock Levels'),        page: 'stock-levels' },
      { label: label('nav.stock-take', 'Stock Take'),            page: 'stock-take' },
      { label: label('nav.stock-issue', 'Stock Issue'),          page: 'stock-issue' },
      { label: label('nav.stock-alerts', 'Stock Alerts'),        page: 'stock-alerts' },
      { label: label('nav.damage-items', 'Damage Items'),        page: 'damage-items' },
      { label: label('nav.stock-log', 'Stock Log'),              page: 'stock-log' },
      { label: label('nav.categories', 'Categories'),            page: 'categories' },
      { label: label('nav.expiry-tracker', 'Expiry Tracker'),    page: 'expiry-tracker' },
      { label: label('nav.fifo-manager', 'FIFO Manager'),        page: 'fifo-manager' },
      { label: label('nav.barcode-scanner', 'Barcode Scanner'),  page: 'barcode-scanner' },
      { label: label('nav.barcode-labels', 'Barcode Labels'),    page: 'barcode-labels' },
      { label: label('nav.warehouses', 'Warehouses'),            page: 'warehouses' },
      { label: label('nav.inventory-dashboard', 'Overview'),     page: 'inventory-dashboard' },
    ],
  },
  {
    key: 'purchasing',
    label: label('section.purchasing', 'Purchasing'),
    Icon: ShoppingBag,
    items: [
      { label: label('nav.suppliers', 'Suppliers'),              page: 'suppliers' },
      { label: label('nav.purchase-orders', 'Purchase Orders'),  page: 'purchase-orders' },
      { label: label('nav.purchase-invoices', 'PO Invoices'),    page: 'purchase-invoices' },
      { label: label('nav.landed-costs', 'Landed Costs'),        page: 'landed-costs' },
      { label: label('nav.purchase-returns', 'Purchase Returns'), page: 'purchase-returns' },
      { label: label('nav.bills', 'Bills'),                      page: 'bills' },
      { label: label('nav.approval-queue', 'Approval Queue'),     page: 'approval-queue' },
      { label: label('nav.supplier-price-lists', 'Supplier Price Lists'), page: 'supplier-price-lists' },
    ],
  },
  {
    key: 'sales',
    label: label('section.sales', 'Sales'),
    Icon: ShoppingCart,
    items: [
      { label: label('nav.customers', 'Customers'),             page: 'customers' },
      { label: label('nav.estimates', 'Estimates'),              page: 'estimates' },
      { label: label('nav.sales-orders', 'Sales Orders'),       page: 'sales-orders' },
      { label: label('nav.sales-invoices', 'Invoices'),          page: 'sales-invoices' },
      { label: label('nav.pricing-rules', 'Pricing Rules'),     page: 'pricing-rules' },
      { label: label('nav.deliveries', 'Deliveries'),            page: 'deliveries' },
      { label: label('nav.returns-manager', 'Returns'),          page: 'returns-manager' },
      { label: label('nav.collections', 'Collections & Aging'),  page: 'collections' },
    ],
  },
  {
    key: 'delivery',
    label: label('section.delivery', 'Delivery'),
    Icon: Truck,
    items: [
      { label: label('nav.van-load-sheet', 'Van Load Sheet'),           page: 'van-load-sheet' },
      { label: label('nav.van-sales', 'Van Sales'),                    page: 'van-sales' },
      { label: label('nav.van-sales-entry', 'Van Sales Entry'),       page: 'van-sales-entry' },
      { label: label('nav.driver-due-summary', 'Driver Due Summary'), page: 'driver-due-summary' },
      { label: label('nav.driver-settlement', 'Driver Settlement'),   page: 'driver-settlement' },
      { label: label('nav.driver-dashboard', 'Driver Dashboard'),     page: 'driver-dashboard' },
      { label: label('nav.driver-app', 'Driver App'),                 page: 'driver-app' },
      { label: label('nav.route-optimizer', 'Route Optimizer'),       page: 'route-optimizer' },
    ],
  },
  {
    key: 'finance',
    label: label('section.finance', 'Finance'),
    Icon: DollarSign,
    items: [
      { label: label('nav.financial', 'Financial Dashboard'),             page: 'financial' },
      { label: label('nav.chart-of-accounts', 'Chart of Accounts'),      page: 'chart-of-accounts' },
      { label: label('nav.bank-accounts', 'Bank Accounts'),              page: 'bank-accounts' },
      { label: label('nav.money-transfer', 'Money Transfer'),            page: 'money-transfer' },
      { label: label('nav.journal-entries', 'Journal Entries'),           page: 'journal-entries' },
      { label: label('nav.cash-transactions', 'Cash Transactions'),      page: 'cash-transactions' },
      { label: label('nav.multi-currency', 'Multi-Currency'),            page: 'multi-currency' },
      { label: label('nav.reports', 'Reports'),                          page: 'reports' },
      { label: label('nav.balance-sheet', 'Balance Sheet'),              page: 'balance-sheet' },
      { label: label('nav.profit-loss', 'Profit & Loss'),              page: 'profit-loss' },
      { label: label('nav.trial-balance', 'Trial Balance'),            page: 'trial-balance' },
      { label: label('nav.cash-flow', 'Cash Flow'),                    page: 'cash-flow' },
      { label: label('nav.general-ledger', 'General Ledger'),            page: 'general-ledger' },
      { label: label('nav.vendor-ledger', 'Vendor Ledger'),              page: 'vendor-ledger' },
      { label: label('nav.all-sales-report', 'All Sales Report'),        page: 'all-sales-report' },
      { label: label('nav.customer-sales-summary', 'Customer Summary'),  page: 'customer-sales-summary' },
      { label: label('nav.product-sales', 'Product Sales'),              page: 'product-sales' },
      { label: label('nav.all-purchases-report', 'All Purchases'),       page: 'all-purchases-report' },
      { label: label('nav.expense-breakdown', 'Expense Breakdown'),      page: 'expense-breakdown' },
      { label: label('nav.sales-tax', 'Sales Tax'),                      page: 'sales-tax' },
      { label: label('nav.vat-return', 'VAT Return'),                    page: 'vat-return' },
      { label: label('nav.fawtara-dashboard', 'Fawtara E-Invoicing'),    page: 'fawtara-dashboard' },
      { label: label('nav.bank-recon', 'Bank Reconciliation'),           page: 'bank-recon' },
      { label: label('nav.advance-payments', 'Advance Payments'),        page: 'advance-payments' },
    ],
  },
  {
    key: 'admin',
    label: label('section.admin', 'Admin'),
    Icon: Settings,
    items: [
      { label: label('nav.users', 'Users'),                       page: 'users' },
      { label: label('nav.settings', 'Settings'),                 page: 'settings' },
      { label: label('nav.settings-lookup', 'Lookup Tables'),     page: 'settings-lookup' },
      { label: label('nav.product-brands', 'Product Brands'),     page: 'product-brands' },
      { label: label('nav.variations', 'Variations'),             page: 'variations' },
      { label: label('nav.notifications', 'Notifications'),       page: 'notifications' },
      { label: label('nav.messaging', 'Messaging'),               page: 'messaging' },
      { label: label('nav.deleted-items', 'Deleted Items'),       page: 'deleted-items' },
      { label: label('nav.admin-master-panel', 'Master Control'), page: 'admin-master-panel' },
      { label: label('nav.label-editor', 'Label Editor'),         page: 'label-editor', perm: PERMISSIONS.ADMIN.RENAME_LABELS },
    ],
  },
];

function sectionForPage(page) {
  for (const s of getSections()) {
    if (s.items.some(i => i.page === page)) return s.key;
  }
  return null;
}

function Navigation({ currentPage, onNavigate, user, onLogout, onWidthChange }) {
  const [collapsed, setCollapsed] = useState(false);
  const [open, setOpen] = useState(() => sectionForPage(currentPage));
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef(null);
  const searchTimerRef = useRef(null);

  const userRole = user?.role || '';

  // Close mobile sidebar when navigating
  const navigate = (page) => {
    if (isMobile) setMobileOpen(false);
    setShowResults(false);
    setSearchQuery('');
    setSearchResults([]);
    onNavigate(page);
  };

  // Debounced search
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!searchQuery || searchQuery.trim().length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }
    searchTimerRef.current = setTimeout(async () => {
      try {
        const data = await dashboardAPI.search(searchQuery.trim());
        setSearchResults(data.results || []);
        setShowResults(true);
      } catch { setSearchResults([]); }
    }, 300);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [searchQuery]);

  // Click outside to close search
  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setShowResults(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const typeIcon = (type) => {
    switch (type) {
      case 'product': return <Package size={14} color="#16a34a" />;
      case 'customer': return <Users size={14} color="#2563eb" />;
      case 'supplier': return <Truck size={14} color="#d97706" />;
      case 'invoice': return <FileText size={14} color="#dc2626" />;
      case 'sales_order': return <ClipboardList size={14} color="#7c3aed" />;
      case 'purchase_order': return <ShoppingBag size={14} color="#0891b2" />;
      default: return <Search size={14} color="#94a3b8" />;
    }
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
    <nav className="no-print">
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
          label={label('nav.dashboard', 'Dashboard')}
          active={currentPage === 'dashboard'}
          collapsed={collapsed}
          onClick={() => navigate('dashboard')}
        />

        {/* Search Bar */}
        {!collapsed && (
          <div ref={searchRef} style={{ padding: '8px 12px', position: 'relative', flexShrink: 0 }}>
            <div style={{
              display: 'flex', alignItems: 'center', background: '#1e293b',
              borderRadius: 6, padding: '0 8px', border: '1px solid #334155',
            }}>
              <Search size={14} color="#64748b" style={{ flexShrink: 0 }} />
              <input
                type="text"
                placeholder="Search anything..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onFocus={() => { if (searchResults.length > 0) setShowResults(true); }}
                onKeyDown={e => { if (e.key === 'Escape') { setShowResults(false); setSearchQuery(''); } }}
                style={{
                  flex: 1, background: 'transparent', border: 'none', outline: 'none',
                  color: '#e2e8f0', fontSize: 12, fontFamily: 'Figtree, sans-serif',
                  padding: '7px 6px',
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(''); setSearchResults([]); setShowResults(false); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex' }}
                >
                  <X size={12} color="#64748b" />
                </button>
              )}
            </div>

            {/* Results Dropdown */}
            {showResults && searchResults.length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', left: 12, right: 12,
                background: '#fff', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                maxHeight: 320, overflowY: 'auto', zIndex: 100, border: '1px solid #e2e8f0',
              }}>
                {searchResults.map((r, i) => (
                  <button
                    key={`${r.type}-${r.id}-${i}`}
                    onClick={() => navigate(r.page)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 12px', background: 'transparent', border: 'none',
                      cursor: 'pointer', textAlign: 'left', borderBottom: '1px solid #f1f5f9',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    {typeIcon(r.type)}
                    <div style={{ overflow: 'hidden', flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2332', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</div>
                      <div style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.subtitle}</div>
                    </div>
                    <span style={{
                      fontSize: 9, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase',
                      padding: '2px 6px', background: '#f1f5f9', borderRadius: 3, flexShrink: 0,
                    }}>{r.type.replace('_', ' ')}</span>
                  </button>
                ))}
              </div>
            )}
            {showResults && searchQuery.trim().length >= 2 && searchResults.length === 0 && (
              <div style={{
                position: 'absolute', top: '100%', left: 12, right: 12,
                background: '#fff', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                padding: '16px 12px', zIndex: 100, border: '1px solid #e2e8f0',
                textAlign: 'center', color: '#94a3b8', fontSize: 12,
              }}>
                No results found
              </div>
            )}
          </div>
        )}

        {/* Sections */}
        <div style={{ flex: 1 }}>
          {getSections().map(section => {
            const visibleItems = section.items.filter(i => canAccessPage(i.page, userRole) && (!i.perm || canPerm(i.perm)));
            if (visibleItems.length === 0) return null;

            const isOpen = open === section.key && !collapsed;
            const sectionActive = visibleItems.some(i => i.page === currentPage);

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
                    {visibleItems.map(item => (
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
    </nav>
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
