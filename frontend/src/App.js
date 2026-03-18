import React, { useState, useEffect } from 'react';
import Navigation from './components/Navigation';
import { authAPI, adminAPI } from './services/api';
import { canAccessPage } from './constants/pageAccess';
import './App.css';

// ── Phase 1-4: Core Components ──
import AnalyticsDashboard from './components/AnalyticsDashboard';
import ProductList from './components/ProductList';
import StockReceipt from './components/StockReceipt';
import StockLevels from './components/StockLevels';
import StockTake from './components/StockTake';
import StockIssue from './components/StockIssue';
import StockAlerts from './components/StockAlerts';
import ExpiryTracker from './components/ExpiryTracker';
import InventoryDashboard from './components/InventoryDashboard';
import BarcodeScanner from './components/BarcodeScanner';
import WarehouseManager from './components/WarehouseManager';
import SupplierList from './components/SupplierList';
import PurchaseOrderList from './components/PurchaseOrderList';
import PurchaseOrderDetail from './components/PurchaseOrderDetail';
import PurchaseInvoices from './components/PurchaseInvoices';
import CustomerList from './components/CustomerList';
import SalesOrderList from './components/SalesOrderList';
import SalesOrderDetail from './components/SalesOrderDetail';
import SalesInvoices from './components/SalesInvoices';
import CollectionsDashboard from './components/CollectionsDashboard';
import DeliveryManager from './components/DeliveryManager';
import PricingRules from './components/PricingRules';
import FinancialDashboard from './components/FinancialDashboard';
import ReportsPage from './components/ReportsPage';
import UserManagement from './components/UserManagement';
import CompanySettings from './components/CompanySettings';

// ── Phase 5b: PDF + FIFO ──
import InvoicePDF from './components/InvoicePDF';
import DeliveryNotePDF from './components/DeliveryNotePDF';
import CustomerStatementPDF from './components/CustomerStatementPDF';
import FIFOStockManager from './components/FIFOStockManager';
import './components/PrintPDF.css';

// ── Phase 5c: New Features ──
import DriverApp from './components/DriverApp';
import RouteOptimizer from './components/RouteOptimizer';
import BarcodeLabelPrinter from './components/BarcodeLabelPrinter';
import MultiCurrencyDashboard from './components/MultiCurrencyDashboard';
import ReturnsManager from './components/ReturnsManager';
import ChartOfAccounts from './components/ChartOfAccounts';
import MoneyTransfer from './components/MoneyTransfer';
import JournalEntries from './components/JournalEntries';
import VATReturn from './components/VATReturn';
import BankReconciliation from './components/BankReconciliation';
import LandedCosts from './components/LandedCosts';
import CashTransactions from './components/CashTransactions';
import EstimateList from './components/EstimateList';
import PurchaseReturnList from './components/PurchaseReturnList';
import BillsList from './components/BillsList';
import AdvancePayments from './components/AdvancePayments';
import BankAccounts from './components/BankAccounts';
import BalanceSheet from './components/BalanceSheet';
import ProfitLoss from './components/ProfitLoss';
import TrialBalance from './components/TrialBalance';
import CashFlowStatement from './components/CashFlowStatement';
import FawtaraDashboard from './components/FawtaraDashboard';
import GeneralLedger from './components/GeneralLedger';
import VendorLedger from './components/VendorLedger';
import AllSalesReport from './components/AllSalesReport';
import CustomerSalesSummary from './components/CustomerSalesSummary';
import ProductSalesReport from './components/ProductSalesReport';
import AllPurchasesReport from './components/AllPurchasesReport';
import ExpenseBreakdown from './components/ExpenseBreakdown';
import SalesTaxReport from './components/SalesTaxReport';
import CategoryList from './components/CategoryList';
import ProductBrands from './components/ProductBrands';
import VariationTemplates from './components/VariationTemplates';
import DamageItems from './components/DamageItems';
import DeletedItems from './components/DeletedItems';
import AdminMasterPanel from './components/AdminMasterPanel';
import VanSalesEntry from './components/VanSalesEntry';
import VanLoadSheet from './components/VanLoadSheet';
import VanSales from './components/VanSales';
import DriverDueSummary from './components/DriverDueSummary';
import DriverSettlement from './components/DriverSettlement';
import WarehouseTransfer from './components/WarehouseTransfer';
import DriverPerformance from './components/DriverPerformance';
import ApprovalQueue from './components/ApprovalQueue';
import SupplierPriceList from './components/SupplierPriceList';
import DriverDashboard from './components/DriverDashboard';
import NotificationSettings from './components/NotificationSettings';
import MessagingSettings from './components/MessagingSettings';
import Breadcrumb from './components/Breadcrumb';
import SettingsPages from './components/SettingsPages';
import StockAdjustmentLog from './components/StockAdjustmentLog';
import LabelEditor from './components/LabelEditor';
import ToastContainer from './components/Toast';
import { loadLabels } from './utils/labels';

// ── Apply saved font on startup ──
const savedFont = localStorage.getItem('app_font');
if (savedFont) {
  document.documentElement.style.setProperty('--font-main', savedFont);
  document.documentElement.style.fontFamily = savedFont;
}

// ── Error Boundary ──
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { console.error('Page crash:', error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '60px 24px', textAlign: 'center' }}>
          <h2 style={{ color: '#e67e22', marginTop: 16 }}>Something went wrong</h2>
          <p style={{ color: '#888', marginTop: 8 }}>{this.state.error?.message || 'An error occurred loading this page.'}</p>
          <button onClick={() => { this.setState({ hasError: false, error: null }); this.props.onReset?.(); }}
            style={{ marginTop: 16, padding: '10px 24px', background: '#0d7a3e', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>
            ← Back to Dashboard
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Decode JWT ──
function decodeJWT(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(window.atob(base64));
  } catch (e) { return null; }
}

// PAGE_ROLE_MAP + canAccessPage imported from constants/pageAccess.js

function App() {
  const [user, setUser] = useState(null);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [sidebarWidth, setSidebarWidth] = useState(220);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  // Phase 47: Data safety
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [sessionWarning, setSessionWarning] = useState(false);

  // Drill-down state
  const [viewPOId, setViewPOId] = useState(null);
  const [viewSOId, setViewSOId] = useState(null);
  const [printInvoiceOrderId, setPrintInvoiceOrderId] = useState(null);
  const [printDeliveryNoteId, setPrintDeliveryNoteId] = useState(null);

  const isDriverMode = new URLSearchParams(window.location.search).get('mode') === 'driver';

  useEffect(() => {
    loadLabels();
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (token && savedUser) {
      try { setUser(JSON.parse(savedUser)); } catch(e) { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  // Silent redirect: if user somehow lands on a page they can't access, go to dashboard
  useEffect(() => {
    if (user && !canAccessPage(currentPage, user.role)) {
      setCurrentPage('dashboard');
    }
  }, [currentPage, user]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (loggingIn) return;
    setLoginError('');
    setLoggingIn(true);
    try {
      const res = await authAPI.login(loginForm.username, loginForm.password);
      const token = res.data.access_token;
      localStorage.setItem('token', token);
      const payload = decodeJWT(token);
      const userData = {
        username: payload?.sub || loginForm.username,
        role: payload?.role || 'admin',
        full_name: payload?.full_name || payload?.sub || loginForm.username,
        id: payload?.user_id || payload?.id,
      };
      localStorage.setItem('user', JSON.stringify(userData));
      localStorage.setItem('userRole', userData.role || '');
      // Fetch and store role permissions for widget/feature guards
      try {
        const permRes = await adminAPI.getRolePermissions(userData.role);
        localStorage.setItem('userPermissions', JSON.stringify(permRes.permissions || []));
      } catch (e) {
        localStorage.setItem('userPermissions', '[]');
      }
      setUser(userData);
      setCurrentPage(userData?.role?.toUpperCase() === 'DELIVERY_DRIVER' ? 'driver-app' : 'dashboard');

      // Phase 47: Check if password change is required
      if (res.data.must_change_password) {
        setShowPasswordChange(true);
      }

      // Phase 47: Session expiry warning — warn 5 minutes before token expires
      const TOKEN_LIFETIME_MS = 480 * 60 * 1000; // 8 hours
      const WARNING_BEFORE_MS = 5 * 60 * 1000;   // 5 minutes
      setTimeout(() => { setSessionWarning(true); }, TOKEN_LIFETIME_MS - WARNING_BEFORE_MS);
    } catch (err) {
      setLoginError(err.response?.data?.detail || 'Login failed — check backend is running');
    }
    setLoggingIn(false);
  };

  const handleLogout = () => { authAPI.logout(); setUser(null); setCurrentPage('dashboard'); };

  const navigate = (page) => {
    setCurrentPage(page);
    setViewPOId(null);
    setViewSOId(null);
    setPrintInvoiceOrderId(null);
    setPrintDeliveryNoteId(null);
  };

  // Drill-down helpers
  const viewPurchaseOrder = (id) => { setViewPOId(id); setCurrentPage('purchase-order-detail'); };
  const viewSalesOrder = (id) => { setViewSOId(id); setCurrentPage('sales-order-detail'); };
  const printInvoice = (orderId) => { setPrintInvoiceOrderId(orderId); setCurrentPage('print-invoice'); };
  // eslint-disable-next-line no-unused-vars
  const printDeliveryNote = (deliveryId) => { setPrintDeliveryNoteId(deliveryId); setCurrentPage('print-delivery-note'); };
  const closePDF = () => { setPrintInvoiceOrderId(null); setPrintDeliveryNoteId(null); setCurrentPage('dashboard'); };

  // ── Login Screen ──
  if (!user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #1a2332, #2c3e50)' }}>
        <div style={{ background: '#fff', borderRadius: 16, padding: '48px 36px', width: 380, boxShadow: '0 12px 40px rgba(0,0,0,0.3)' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <h1 style={{ color: '#1a7b5b', fontSize: 24, marginTop: 8 }}>Warehouse Management</h1>
            <h2 style={{ color: '#888', fontSize: 14, fontWeight: 400, marginTop: 4 }}>AK Al Mumayza Trading</h2>
          </div>
          {loginError && <div style={{ background: '#fce4e4', color: '#c0392b', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>{loginError}</div>}
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: '#555' }}>Username</label>
              <input type="text" value={loginForm.username}
                onChange={e => setLoginForm({ ...loginForm, username: e.target.value })}
                placeholder="Enter username" required disabled={loggingIn}
                style={{ width: '100%', padding: '12px 16px', borderRadius: 8, border: '2px solid #e0e0e0', fontSize: 14, boxSizing: 'border-box', outline: 'none' }} />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: '#555' }}>Password</label>
              <input type="password" value={loginForm.password}
                onChange={e => setLoginForm({ ...loginForm, password: e.target.value })}
                placeholder="Enter password" required disabled={loggingIn}
                style={{ width: '100%', padding: '12px 16px', borderRadius: 8, border: '2px solid #e0e0e0', fontSize: 14, boxSizing: 'border-box', outline: 'none' }} />
            </div>
            <button type="submit" disabled={loggingIn} style={{
              width: '100%', padding: '14px', background: loggingIn ? '#85c7a6' : '#1a7b5b', color: '#fff',
              border: 'none', borderRadius: 8, fontSize: 16, fontWeight: 700, cursor: loggingIn ? 'not-allowed' : 'pointer',
            }}>
              {loggingIn ? 'Logging in...' : 'Login'}
            </button>
          </form>
          <div style={{ marginTop: 24, textAlign: 'center', color: '#999', fontSize: 12 }}>
            <p style={{ marginBottom: 4 }}>Test accounts:</p>
            <p>admin / admin123 · warehouse_mgr / warehouse123</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Driver Mode (PWA fullscreen) ──
  if (isDriverMode || (currentPage === 'driver-app' && user?.role?.toUpperCase() === 'DELIVERY_DRIVER')) {
    return <DriverApp user={user} onClose={() => navigate('dashboard')} />;
  }

  // ── Page Router — ALL 33 components ──
  const renderPage = () => {
    if (!canAccessPage(currentPage, user?.role)) return null;

    switch (currentPage) {
      // ★ Dashboard (Analytics with graphs, KPIs, charts)
      case 'dashboard':            return <AnalyticsDashboard onNavigate={navigate} />;

      // ── Inventory ──
      case 'products':             return <ProductList />;
      case 'stock-receipt':        return <StockReceipt />;
      case 'stock-levels':         return <StockLevels />;
      case 'stock-alerts':         return <StockAlerts />;
      case 'stock-take':           return <StockTake />;
      case 'stock-issue':          return <StockIssue />;
      case 'expiry-tracker':       return <ExpiryTracker />;
      case 'inventory-dashboard':  return <InventoryDashboard />;
      case 'barcode-scanner':      return <BarcodeScanner />;
      case 'fifo-manager':         return <FIFOStockManager />;
      case 'barcode-labels':       return <BarcodeLabelPrinter />;
      case 'warehouses':           return <WarehouseManager />;

      // ── Purchasing ──
      case 'suppliers':            return <SupplierList />;
      case 'purchase-orders':      return <PurchaseOrderList onViewOrder={viewPurchaseOrder} />;
      case 'purchase-order-detail': return <PurchaseOrderDetail poId={viewPOId} onBack={() => navigate('purchase-orders')} />;
      case 'purchase-invoices':    return <PurchaseInvoices />;
      case 'landed-costs':         return <LandedCosts />;
      case 'purchase-returns':     return <PurchaseReturnList />;
      case 'bills':                return <BillsList />;
      case 'approval-queue':       return <ApprovalQueue />;
      case 'supplier-price-lists': return <SupplierPriceList />;

      // ── Sales ──
      case 'customers':            return <CustomerList onNavigate={navigate} />;
      case 'estimates':            return <EstimateList />;
      case 'sales-orders':         return <SalesOrderList onViewOrder={viewSalesOrder} onPrintInvoice={printInvoice} />;
      case 'sales-order-detail':   return <SalesOrderDetail soId={viewSOId} onBack={() => navigate('sales-orders')} />;
      case 'sales-invoices':       return <SalesInvoices />;
      case 'pricing-rules':        return <PricingRules />;
      case 'deliveries':           return <DeliveryManager />;
      case 'customer-statement':   return <CustomerStatementPDF />;
      case 'collections':          return <CollectionsDashboard />;
      case 'returns-manager':      return <ReturnsManager />;

      // ── Delivery ──
      case 'van-sales':            return <VanSales />;
      case 'van-sales-entry':      return <VanSalesEntry />;
      case 'van-load-sheet':       return <VanLoadSheet />;
      case 'driver-due-summary':   return <DriverDueSummary />;
      case 'driver-settlement':    return <DriverSettlement />;
      case 'driver-performance':   return <DriverPerformance />;
      case 'warehouse-transfer':   return <WarehouseTransfer />;
      case 'driver-dashboard':     return <DriverDashboard />;
      case 'driver-app':           return <DriverApp user={user} onClose={() => navigate('dashboard')} />;
      case 'route-optimizer':      return <RouteOptimizer />;

      // ── Finance ──
      case 'financial':            return <FinancialDashboard />;
      case 'chart-of-accounts':    return <ChartOfAccounts />;
      case 'money-transfer':       return <MoneyTransfer />;
      case 'journal-entries':      return <JournalEntries />;
      case 'cash-transactions':    return <CashTransactions />;
      case 'multi-currency':       return <MultiCurrencyDashboard />;
      case 'reports':              return <ReportsPage />;
      case 'vat-return':           return <VATReturn />;
      case 'bank-recon':           return <BankReconciliation />;
      case 'advance-payments':     return <AdvancePayments />;
      case 'bank-accounts':        return <BankAccounts />;
      case 'balance-sheet':        return <BalanceSheet />;
      case 'profit-loss':          return <ProfitLoss />;
      case 'trial-balance':        return <TrialBalance />;
      case 'cash-flow':            return <CashFlowStatement />;
      case 'fawtara-dashboard':    return <FawtaraDashboard />;
      case 'general-ledger':       return <GeneralLedger />;
      case 'vendor-ledger':        return <VendorLedger />;
      case 'all-sales-report':     return <AllSalesReport />;
      case 'customer-sales-summary': return <CustomerSalesSummary />;
      case 'product-sales':        return <ProductSalesReport />;
      case 'all-purchases-report': return <AllPurchasesReport />;
      case 'expense-breakdown':    return <ExpenseBreakdown />;
      case 'sales-tax':            return <SalesTaxReport />;

      // ── Admin ──
      case 'users':                return <UserManagement />;
      case 'settings':             return <CompanySettings />;
      case 'settings-lookup':      return <SettingsPages />;
      case 'notifications':        return <NotificationSettings />;
      case 'messaging':            return <MessagingSettings />;
      case 'activity-log':         return <UserManagement />;
      case 'stock-log':            return <StockAdjustmentLog />;
      case 'categories':           return <CategoryList />;
      case 'product-brands':       return <ProductBrands />;
      case 'variations':           return <VariationTemplates />;
      case 'damage-items':         return <DamageItems />;
      case 'deleted-items':        return <DeletedItems />;
      case 'admin-master-panel':   return <AdminMasterPanel />;
      case 'label-editor':         return <LabelEditor />;

      // ── PDF Print (hidden pages, accessed via buttons) ──
      case 'print-invoice':        return <InvoicePDF orderId={printInvoiceOrderId} onClose={closePDF} />;
      case 'print-delivery-note':  return <DeliveryNotePDF deliveryId={printDeliveryNoteId} onClose={closePDF} />;

      default:
        return (
          <div style={{ padding: '40px 24px', textAlign: 'center' }}>
            <h2 style={{ color: '#333' }}>{currentPage.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</h2>
            <p style={{ color: '#888' }}>Page "{currentPage}" — component not mapped yet.</p>
          </div>
        );
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9' }}>
      <ToastContainer />

      {/* Phase 47: Session expiry warning */}
      {sessionWarning && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
          background: '#fef3c7', borderBottom: '2px solid #f59e0b',
          padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
          fontSize: 13, color: '#92400e', fontWeight: 600,
        }}>
          Your session will expire soon. Save your work and refresh to continue.
          <button onClick={() => window.location.reload()}
            style={{ padding: '4px 12px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
            Refresh Now
          </button>
        </div>
      )}

      {/* Phase 47: Forced password change modal */}
      {showPasswordChange && <PasswordChangeModal onDone={() => setShowPasswordChange(false)} />}

      <Navigation
        currentPage={currentPage} onNavigate={navigate}
        user={user} onLogout={handleLogout}
        onWidthChange={setSidebarWidth}
      />
      <div className="main-content" style={{ marginLeft: sidebarWidth, paddingTop: isMobile ? 56 : 0, transition: 'margin-left 0.2s ease', minHeight: '100vh' }}>
        <Breadcrumb currentPage={currentPage} onNavigate={navigate} />
        <ErrorBoundary key={currentPage} onReset={() => setCurrentPage('dashboard')}>
          {renderPage()}
        </ErrorBoundary>
      </div>
    </div>
  );
}

// Phase 47: Password Change Modal (blocks UI until password is changed)
function PasswordChangeModal({ onDone }) {
  const [form, setForm] = useState({ current: '', newPw: '', confirm: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.newPw.length < 8) return setError('Password must be at least 8 characters');
    if (!/[A-Z]/.test(form.newPw)) return setError('Must contain an uppercase letter');
    if (!/[a-z]/.test(form.newPw)) return setError('Must contain a lowercase letter');
    if (!/[0-9]/.test(form.newPw)) return setError('Must contain a number');
    if (form.newPw !== form.confirm) return setError('Passwords do not match');
    if (form.newPw === form.current) return setError('New password must be different');

    setSaving(true);
    try {
      await authAPI.changePassword({ current_password: form.current, new_password: form.newPw });
      onDone();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to change password');
    }
    setSaving(false);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: '32px 28px', width: 380, boxShadow: '0 12px 40px rgba(0,0,0,0.3)' }}>
        <h2 style={{ margin: '0 0 8px', fontSize: 18, color: '#dc2626' }}>Password Change Required</h2>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: '#6b7280' }}>
          Your account requires a password change before continuing.
        </p>
        {error && <div style={{ background: '#fef2f2', color: '#991b1b', padding: '8px 12px', borderRadius: 6, marginBottom: 12, fontSize: 13 }}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Current Password</label>
            <input type="password" value={form.current} onChange={e => setForm({ ...form, current: e.target.value })} required
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>New Password</label>
            <input type="password" value={form.newPw} onChange={e => setForm({ ...form, newPw: e.target.value })} required
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }} />
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>Min 8 chars, uppercase, lowercase, number</div>
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Confirm New Password</label>
            <input type="password" value={form.confirm} onChange={e => setForm({ ...form, confirm: e.target.value })} required
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }} />
          </div>
          <button type="submit" disabled={saving} style={{
            width: '100%', padding: '12px', background: saving ? '#9ca3af' : '#dc2626', color: '#fff',
            border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
          }}>
            {saving ? 'Changing...' : 'Change Password'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default App;