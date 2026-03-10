import axios from 'axios';
const API_BASE_URL = '';
const api = axios.create({ baseURL: API_BASE_URL, headers: { 'Content-Type': 'application/json' } });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
}, (error) => Promise.reject(error));

api.interceptors.response.use((r) => r, (error) => {
  if (error.response?.status === 401) { localStorage.removeItem('token'); localStorage.removeItem('user'); window.location.reload(); }
  return Promise.reject(error);
});

export const authAPI = {
  login: (username, password) => {
    const fd = new FormData(); fd.append('username', username); fd.append('password', password);
    return api.post('/api/auth/login', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  getCurrentUser: () => api.get('/api/auth/me'),
  logout: () => { localStorage.removeItem('token'); localStorage.removeItem('user'); return Promise.resolve(); },
};

export const productAPI = {
  getAll: (params = {}) => api.get('/api/products', { params }),
  getById: (id) => api.get(`/api/products/${id}`),
  create: (data) => api.post('/api/products', data),
  update: (id, data) => api.put(`/api/products/${id}`, data),
  delete: (id) => api.delete(`/api/products/${id}`),
  getByBarcode: (barcode) => api.get(`/api/products/barcode/${barcode}`),
};

export const categoryAPI = {
  getAll: () => api.get('/api/categories'),
  create: (data) => api.post('/api/categories', data),
};

export const inventoryAPI = {
  recordReceipt: async (data) => (await api.post('/api/inventory/receipt', null, { params: data })).data,
  recordIssue: async (data) => (await api.post('/api/inventory/issue', null, { params: data })).data,
  recordTransfer: async (data) => (await api.post('/api/inventory/transfer', null, { params: data })).data,
  recordAdjustment: async (data) => (await api.post('/api/inventory/adjustment', null, { params: data })).data,
  batchReceipt: async (data) => (await api.post('/api/inventory/batch-receipt', data)).data,
  getStockLevels: async (params = {}) => (await api.get('/api/inventory/stock-levels', { params })).data,
  getMovements: async (params = {}) => (await api.get('/api/inventory/movements', { params })).data,
  getLowStock: async () => (await api.get('/api/inventory/low-stock')).data,
  getSummary: async () => (await api.get('/api/inventory/summary')).data,
  getExpiryAlerts: async (days = 90) => (await api.get('/api/inventory/expiry-alerts', { params: { days } })).data,
  getValuation: async (params = {}) => (await api.get('/api/inventory/valuation', { params })).data,
  recordStockTake: async (data) => (await api.post('/api/inventory/stock-take', data)).data,
  getProductHistory: async (productId) => (await api.get(`/api/inventory/product/${productId}/history`)).data,
  getProductsForStocktake: async (warehouseId) => (await api.get('/api/inventory/products-for-stocktake', { params: { warehouse_id: warehouseId } })).data,
};

export const warehouseAPI = {
  list: async () => (await api.get('/api/warehouses')).data,
  getById: async (id) => (await api.get(`/api/warehouses/${id}`)).data,
  create: async (data) => (await api.post('/api/warehouses', data)).data,
  update: async (id, data) => (await api.put(`/api/warehouses/${id}`, data)).data,
};

export const supplierAPI = {
  list: async (params = {}) => (await api.get('/api/suppliers', { params })).data,
  getById: async (id) => (await api.get(`/api/suppliers/${id}`)).data,
  create: async (data) => (await api.post('/api/suppliers', data)).data,
  update: async (id, data) => (await api.put(`/api/suppliers/${id}`, data)).data,
};

export const purchaseAPI = {
  listOrders: async (params = {}) => (await api.get('/api/purchases/orders', { params })).data,
  getOrder: async (id) => (await api.get(`/api/purchases/orders/${id}`)).data,
  createOrder: async (data) => (await api.post('/api/purchases/orders', data)).data,
  updateOrder: async (id, data) => (await api.put(`/api/purchases/orders/${id}`, data)).data,
  sendOrder: async (id) => (await api.post(`/api/purchases/orders/${id}/send`)).data,
  closeOrder: async (id) => (await api.post(`/api/purchases/orders/${id}/close`)).data,
  receiveGoods: async (poId, data) => (await api.post(`/api/purchases/orders/${poId}/receive`, data)).data,
  addLandedCosts: async (poId, data) => (await api.post(`/api/purchases/orders/${poId}/landed-cost`, data)).data,
  getLandedCosts: async (poId) => (await api.get(`/api/purchases/orders/${poId}/landed-cost`)).data,
  listInvoices: async (params = {}) => (await api.get('/api/purchases/invoices', { params })).data,
  createInvoice: async (data) => (await api.post('/api/purchases/invoices', data)).data,
  recordPayment: async (invoiceId, data) => (await api.post(`/api/purchases/invoices/${invoiceId}/payment`, data)).data,
  agingReport: async () => (await api.get('/api/purchases/aging-report')).data,
};

export const customerAPI = {
  list: async (params = {}) => (await api.get('/api/customers', { params })).data,
  getById: async (id) => (await api.get(`/api/customers/${id}`)).data,
  create: async (data) => (await api.post('/api/customers', data)).data,
  update: async (id, data) => (await api.put(`/api/customers/${id}`, data)).data,
  getAreas: async () => (await api.get('/api/customers/areas')).data,
  getStatement: async (id, params = {}) => (await api.get(`/api/customers/${id}/statement`, { params })).data,
};

export const salesAPI = {
  listOrders: async (params = {}) => (await api.get('/api/sales/orders', { params })).data,
  getOrder: async (id) => (await api.get(`/api/sales/orders/${id}`)).data,
  createOrder: async (data) => (await api.post('/api/sales/orders', data)).data,
  updateOrder: async (id, data) => (await api.put(`/api/sales/orders/${id}`, data)).data,
  confirmOrder: async (id) => (await api.post(`/api/sales/orders/${id}/confirm`)).data,
  shipOrder: async (id, warehouseId = 1) => (await api.post(`/api/sales/orders/${id}/ship?warehouse_id=${warehouseId}`)).data,
  deliverOrder: async (id, data) => (await api.post(`/api/sales/orders/${id}/deliver`, data)).data,
  invoiceOrder: async (id) => (await api.post(`/api/sales/orders/${id}/invoice`)).data,
  listDeliveries: async (params = {}) => (await api.get('/api/sales/deliveries', { params })).data,
  todayDeliveries: async () => (await api.get('/api/sales/deliveries/today')).data,
  deliveriesByArea: async (area) => (await api.get(`/api/sales/deliveries/route/${area}`)).data,
  completeDelivery: async (id, data) => (await api.post(`/api/sales/deliveries/${id}/complete`, data)).data,
  listInvoices: async (params = {}) => (await api.get('/api/sales/invoices', { params })).data,
  overdueInvoices: async () => (await api.get('/api/sales/invoices/overdue')).data,
  recordPayment: async (invoiceId, data) => (await api.post(`/api/sales/invoices/${invoiceId}/payment`, data)).data,
  agingReport: async () => (await api.get('/api/sales/aging-report')).data,
  listPricingRules: async () => (await api.get('/api/sales/pricing/rules')).data,
  createPricingRule: async (data) => (await api.post('/api/sales/pricing/rules', data)).data,
  deletePricingRule: async (id) => (await api.delete(`/api/sales/pricing/rules/${id}`)).data,
  customerPrices: async (customerId) => (await api.get(`/api/sales/pricing/customer/${customerId}`)).data,
};

export const analyticsAPI = {
  dashboard: async (days = 30, categoryId = null) => {
    const params = { days };
    if (categoryId) params.category_id = categoryId;
    return (await api.get('/api/analytics/dashboard', { params })).data;
  },
  trends: async (days = 30, categoryId = null) => {
    const params = { days };
    if (categoryId) params.category_id = categoryId;
    return (await api.get('/api/analytics/trends', { params })).data;
  },
  categoryBreakdown: async (days = 30) => (await api.get('/api/analytics/category-breakdown', { params: { days } })).data,
  alerts: async () => (await api.get('/api/analytics/alerts')).data,
  categories: async () => (await api.get('/api/analytics/categories')).data,
  stockStatus: async () => (await api.get('/api/analytics/stock-status')).data,
  salesSummary: async (days = 30) => (await api.get('/api/analytics/sales-summary', { params: { days } })).data,
  lowStockProducts: async () => (await api.get('/api/analytics/low-stock-products')).data,
};

export const financialAPI = {
  dashboard: async () => (await api.get('/api/financial/dashboard')).data,
  profitLoss: async (params = {}) => (await api.get('/api/financial/profit-loss', { params })).data,
};

export const reportsAPI2 = {
  salesByItem: async (params = {}) => (await api.get('/api/reports/sales-by-item', { params })).data,
  purchasePayments: async (params = {}) => (await api.get('/api/reports/purchase-payments', { params })).data,
  salesPayments: async (params = {}) => (await api.get('/api/reports/sales-payments', { params })).data,
  customerOrders: async (params = {}) => (await api.get('/api/reports/customer-orders', { params })).data,
};

export const reportsAPI = {
  salesByCustomer: async (params = {}) => (await api.get('/api/reports/sales-by-customer', { params })).data,
  salesByProduct: async (params = {}) => (await api.get('/api/reports/sales-by-product', { params })).data,
  purchaseBySupplier: async (params = {}) => (await api.get('/api/reports/purchase-by-supplier', { params })).data,
  stockValuation: async () => (await api.get('/api/reports/stock-valuation')).data,
  inventoryMovements: async (params = {}) => (await api.get('/api/reports/inventory-movements', { params })).data,
  deadStock: async (days = 90) => (await api.get('/api/reports/dead-stock', { params: { days } })).data,
  deliveryPerformance: async (params = {}) => (await api.get('/api/reports/delivery-performance', { params })).data,
  receivablesAging: async () => (await api.get('/api/reports/receivables-aging')).data,
  payablesAging: async () => (await api.get('/api/reports/payables-aging')).data,
  expiryReport: async (days = 90) => (await api.get('/api/reports/expiry-report', { params: { days } })).data,
};

export const csvImportAPI = {
  importProducts: async (rows) => (await api.post('/api/products/import', rows)).data,
  importCustomers: async (rows) => (await api.post('/api/customers/import', rows)).data,
  importSuppliers: async (rows) => (await api.post('/api/suppliers/import', rows)).data,
};

export const adminAPI = {
  listUsers: async () => (await api.get('/api/admin/users')).data,
  getUser: async (id) => (await api.get(`/api/admin/users/${id}`)).data,
  createUser: async (data) => (await api.post('/api/admin/users', data)).data,
  updateUser: async (id, data) => (await api.put(`/api/admin/users/${id}`, data)).data,
  changePassword: async (id, data) => (await api.post(`/api/admin/users/${id}/password`, data)).data,
  toggleUser: async (id) => (await api.post(`/api/admin/users/${id}/deactivate`)).data,
  getSettings: async () => (await api.get('/api/admin/settings')).data,
  updateSetting: async (key, value) => (await api.put(`/api/admin/settings/${key}`, { value })).data,
  updateSettingsBulk: async (data) => (await api.post('/api/admin/settings/bulk', data)).data,
  getActivityLog: async (params = {}) => (await api.get('/api/admin/activity-log', { params })).data,
  createBackup: async () => (await api.post('/api/admin/backup')).data,
  listBackups: async () => (await api.get('/api/admin/backup/list')).data,
  exportTable: (table) => `${API_BASE_URL}/api/admin/export/${table}`,
  exportableList: async () => (await api.get('/api/admin/export-all')).data,
  exportJSON: async () => (await api.get('/api/admin/export-json')).data,
};

// ━━ Phase 5b: PDF, FIFO, RBAC ━━
export const pdfAPI = {
  getInvoiceData: async (orderId) => (await api.get(`/api/pdf/invoice/${orderId}`)).data,
  getDeliveryNoteData: async (deliveryId) => (await api.get(`/api/pdf/delivery-note/${deliveryId}`)).data,
  getStatementData: async (customerId, params = {}) => (await api.get(`/api/pdf/statement/${customerId}`, { params })).data,
};

export const fifoAPI = {
  listBatches: async (params = {}) => (await api.get('/api/fifo/batches', { params })).data,
  suggestPicks: async (productId, quantity) => (await api.get(`/api/fifo/suggest/${productId}`, { params: { quantity } })).data,
  issueFIFO: async (data) => (await api.post('/api/fifo/issue', data)).data,
  receiveBatch: async (params) => (await api.post('/api/fifo/receive', null, { params })).data,
  expiringBatches: async (days = 30) => (await api.get('/api/fifo/expiring', { params: { days } })).data,
  getSummary: async () => (await api.get('/api/fifo/summary')).data,
};

export const rbacAPI = {
  getNavItems: async (role) => (await api.get('/api/rbac/nav-items', { params: { role } })).data,
  getPermissions: async () => (await api.get('/api/rbac/permissions')).data,
};

// ━━ Phase 5c: Driver, Returns, Notifications, Barcodes, Currency ━━
export const driverAPI = {
  myDeliveries: async (driverName = '') => (await api.get('/api/driver/my-deliveries', { params: { driver_name: driverName } })).data,
  deliveryDetail: async (id) => (await api.get(`/api/driver/delivery/${id}`)).data,
  completeDelivery: async (id, data) => (await api.post(`/api/driver/delivery/${id}/complete`, data)).data,
  reorderDeliveries: async (ids) => (await api.post('/api/driver/reorder', { delivery_ids: ids })).data,
  stats: async (driverName = '') => (await api.get('/api/driver/stats', { params: { driver_name: driverName } })).data,
};

export const returnsAPI = {
  listReturns: async (params = {}) => (await api.get('/api/returns/returns', { params })).data,
  getReturn: async (id) => (await api.get(`/api/returns/returns/${id}`)).data,
  createReturn: async (data) => (await api.post('/api/returns/returns', data)).data,
  processReturn: async (id) => (await api.post(`/api/returns/returns/${id}/process`)).data,
  rejectReturn: async (id, reason = '') => (await api.post(`/api/returns/returns/${id}/reject`, null, { params: { reason } })).data,
  listCreditNotes: async (params = {}) => (await api.get('/api/returns/credit-notes', { params })).data,
  applyCreditNote: async (cnId, invoiceId) => (await api.post(`/api/returns/credit-notes/${cnId}/apply`, null, { params: { invoice_id: invoiceId } })).data,
  summary: async () => (await api.get('/api/returns/summary')).data,
};

export const notificationAPI = {
  getSettings: async () => (await api.get('/api/notifications/settings')).data,
  updateSettings: async (settings) => (await api.put('/api/notifications/settings', { settings })).data,
  testSMTP: async (email) => (await api.post('/api/notifications/test', null, { params: { email } })).data,
  triggerLowStock: async () => (await api.post('/api/notifications/trigger/low-stock')).data,
  triggerOverdue: async () => (await api.post('/api/notifications/trigger/overdue-payments')).data,
  triggerExpiring: async () => (await api.post('/api/notifications/trigger/expiring-stock')).data,
  getLog: async (params = {}) => (await api.get('/api/notifications/log', { params })).data,
};

export const barcodeAPI = {
  generate: async (text, opts = {}) => (await api.get('/api/barcodes/generate', { params: { text, ...opts } })).data,
  productLabels: async (productIds, labelSize = 'medium') => (await api.get('/api/barcodes/product-labels', { params: { product_ids: productIds, label_size: labelSize } })).data,
  batchLabels: async (batchIds) => (await api.get('/api/barcodes/batch-labels', { params: { batch_ids: batchIds } })).data,
};

export const currencyAPI = {
  getRates: async () => (await api.get('/api/currency/rates')).data,
  updateRate: async (currency, rate) => (await api.put(`/api/currency/rates/${currency}`, null, { params: { rate } })).data,
  dashboard: async (currencies = 'OMR,USD') => (await api.get('/api/currency/dashboard', { params: { currencies } })).data,
};

export default api;
