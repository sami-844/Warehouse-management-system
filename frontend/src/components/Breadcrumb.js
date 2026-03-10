import React from 'react';
import { ChevronRight, Home } from 'lucide-react';

const PAGE_HIERARCHY = {
  'dashboard':            { section: null, label: 'Dashboard' },
  // Inventory
  'products':             { section: 'Inventory', label: 'Products' },
  'stock-receipt':        { section: 'Inventory', label: 'Stock Receipt' },
  'stock-levels':         { section: 'Inventory', label: 'Stock Levels' },
  'stock-take':           { section: 'Inventory', label: 'Stock Take' },
  'stock-issue':          { section: 'Inventory', label: 'Stock Issue' },
  'stock-log':            { section: 'Inventory', label: 'Stock Log' },
  'expiry-tracker':       { section: 'Inventory', label: 'Expiry Tracker' },
  'fifo-manager':         { section: 'Inventory', label: 'FIFO Manager' },
  'barcode-scanner':      { section: 'Inventory', label: 'Barcode Scanner' },
  'barcode-labels':       { section: 'Inventory', label: 'Barcode Labels' },
  'warehouses':           { section: 'Inventory', label: 'Warehouses' },
  'inventory-dashboard':  { section: 'Inventory', label: 'Overview' },
  // Purchasing
  'suppliers':            { section: 'Purchasing', label: 'Suppliers' },
  'purchase-orders':      { section: 'Purchasing', label: 'Purchase Orders' },
  'purchase-order-detail':{ section: 'Purchasing', label: 'PO Detail', parent: 'purchase-orders' },
  'purchase-invoices':    { section: 'Purchasing', label: 'PO Invoices' },
  // Sales
  'customers':            { section: 'Sales', label: 'Customers' },
  'sales-orders':         { section: 'Sales', label: 'Sales Orders' },
  'sales-order-detail':   { section: 'Sales', label: 'Order Detail', parent: 'sales-orders' },
  'sales-invoices':       { section: 'Sales', label: 'Invoices' },
  'pricing-rules':        { section: 'Sales', label: 'Pricing Rules' },
  'deliveries':           { section: 'Sales', label: 'Deliveries' },
  'customer-statement':   { section: 'Sales', label: 'Customer Statement' },
  'returns-manager':      { section: 'Sales', label: 'Returns' },
  // Delivery
  'driver-app':           { section: 'Delivery', label: 'Driver App' },
  'route-optimizer':      { section: 'Delivery', label: 'Route Optimizer' },
  // Finance
  'financial':            { section: 'Finance', label: 'Dashboard' },
  'chart-of-accounts':    { section: 'Finance', label: 'Chart of Accounts' },
  'money-transfer':       { section: 'Finance', label: 'Money Transfer' },
  'journal-entries':      { section: 'Finance', label: 'Journal Entries' },
  'cash-transactions':    { section: 'Finance', label: 'Cash Transactions' },
  'multi-currency':       { section: 'Finance', label: 'Multi-Currency' },
  'reports':              { section: 'Finance', label: 'Reports' },
  'vat-return':           { section: 'Finance', label: 'VAT Return' },
  'bank-recon':           { section: 'Finance', label: 'Bank Reconciliation' },
  // Admin
  'users':                { section: 'Admin', label: 'Users' },
  'settings':             { section: 'Admin', label: 'Settings' },
  'settings-lookup':      { section: 'Admin', label: 'Lookup Tables' },
  'notifications':        { section: 'Admin', label: 'Notifications' },
  'messaging':            { section: 'Admin', label: 'Messaging' },
  'activity-log':         { section: 'Admin', label: 'Activity Log' },
};

function Breadcrumb({ currentPage, onNavigate }) {
  const info = PAGE_HIERARCHY[currentPage];
  if (!info || currentPage === 'dashboard') return null;

  const crumbs = [{ label: 'Home', page: 'dashboard', isHome: true }];

  if (info.section) {
    crumbs.push({ label: info.section, page: null });
  }

  if (info.parent) {
    const parentInfo = PAGE_HIERARCHY[info.parent];
    if (parentInfo) {
      crumbs.push({ label: parentInfo.label, page: info.parent });
    }
  }

  crumbs.push({ label: info.label, page: null, active: true });

  return (
    <nav style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '10px 24px',
      background: '#fff',
      borderBottom: '1px solid #e2e8f0',
      fontSize: 13,
      fontFamily: 'Figtree, sans-serif',
      flexWrap: 'wrap',
    }}>
      {crumbs.map((crumb, i) => (
        <React.Fragment key={i}>
          {i > 0 && <ChevronRight size={12} color="#94a3b8" style={{ flexShrink: 0 }} />}
          {crumb.active ? (
            <span style={{ color: '#0f172a', fontWeight: 600 }}>{crumb.label}</span>
          ) : crumb.page ? (
            <button
              onClick={() => onNavigate(crumb.page)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#64748b', fontSize: 13, fontFamily: 'Figtree, sans-serif',
                padding: 0, display: 'flex', alignItems: 'center', gap: 4,
              }}
              onMouseEnter={e => (e.currentTarget.style.color = '#16a34a')}
              onMouseLeave={e => (e.currentTarget.style.color = '#64748b')}
            >
              {crumb.isHome && <Home size={13} />}
              {crumb.label}
            </button>
          ) : (
            <span style={{ color: '#94a3b8' }}>{crumb.label}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}

export default Breadcrumb;
