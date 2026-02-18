/**
 * analyticsService — all API calls to FastAPI backend
 * Base URL: http://localhost:8000/api/analytics
 */

const API_BASE = '/api/analytics';

const get = async (path) => {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

const analyticsAPI = {
  /** All dashboard KPIs (supports ?days & ?category_id) */
  getDashboardData: (days = 30, categoryId = '') =>
    get(`/dashboard?days=${days}${categoryId ? `&category_id=${categoryId}` : ''}`),

  /** Daily sales & COGS trend */
  getTrends: (days = 30, categoryId = '') =>
    get(`/trends?days=${days}${categoryId ? `&category_id=${categoryId}` : ''}`),

  /** Per-category inventory breakdown */
  getCategoryBreakdown: (days = 30) =>
    get(`/category-breakdown?days=${days}`),

  /** Active alerts (low stock, overdue, dead stock) */
  getAlerts: () =>
    get('/alerts'),

  /** List of product categories for filter dropdown */
  getCategories: () =>
    get('/categories'),

  /* ---- legacy helpers (still used elsewhere) ---- */
  getInventoryTurnover:  (days = 30) => get(`/inventory-turnover?days=${days}`),
  getStockStatus:        ()          => get('/stock-status'),
  getSalesSummary:       (days = 30) => get(`/sales-summary?days=${days}`),
  getLowStockProducts:   ()          => get('/low-stock-products'),
};

export default analyticsAPI;