/**
 * ExportUtils — CSV download + PDF via print
 */

/* ------------------------------------------------
   CSV export
   Builds a multi-section CSV and triggers download
   ------------------------------------------------ */
export function exportToCSV(dashboardData, trendsData = [], categoryData = [], period = 30) {
  if (!dashboardData) return;

  const { kpis = {}, sales_orders = {}, inventory_status = {} } = dashboardData;
  const now = new Date().toISOString().split('T')[0];

  const rows = [];

  /* header */
  rows.push([`Al Noor Distribution — Dashboard Export`, `Generated: ${now}`, `Period: ${period} days`]);
  rows.push([]);

  /* --- KPIs --- */
  rows.push(['=== KEY PERFORMANCE INDICATORS ===']);
  rows.push(['Metric', 'Value', 'Unit']);
  rows.push(['Inventory Turnover Ratio',  kpis.inventory_turnover_ratio || 0,  '']);
  rows.push(['Average Inventory',         kpis.average_inventory || 0,          'OMR']);
  rows.push(['Cost of Goods Sold (COGS)', kpis.cost_of_goods_sold || 0,         'OMR']);
  rows.push(['Service Level',             kpis.service_level || 0,              '%']);
  rows.push(['Days to Sell Inventory',    kpis.days_to_sell_inventory || 0,     'days']);
  rows.push(['Lead Time',                 kpis.lead_time || 0,                  'days']);
  rows.push(['Perfect Order Rate',        kpis.perfect_order_rate || 0,         '%']);
  rows.push(['Rate of Return',            kpis.rate_of_return || 0,             '%']);
  rows.push([]);

  /* --- Sales Orders --- */
  rows.push(['=== SALES ORDERS SUMMARY ===']);
  rows.push(['Status', 'Count']);
  rows.push(['Completed',   sales_orders.completed || 0]);
  rows.push(['In Progress', sales_orders.in_progress || 0]);
  rows.push(['Returns',     sales_orders.returns || 0]);
  rows.push(['Overdue',     sales_orders.overdue_shipping || 0]);
  rows.push([]);

  /* --- Inventory Status --- */
  rows.push(['=== INVENTORY STATUS ===']);
  rows.push(['Status', 'Items']);
  rows.push(['In Stock',      inventory_status.in_stock_items || 0]);
  rows.push(['Low Stock',     inventory_status.low_stock_items || 0]);
  rows.push(['Out of Stock',  inventory_status.out_of_stock_items || 0]);
  rows.push(['Dead Stock',    inventory_status.dead_stock_items || 0]);
  rows.push([]);

  /* --- Category Breakdown --- */
  if (categoryData.length > 0) {
    rows.push(['=== INVENTORY BY CATEGORY ===']);
    rows.push(['Category', 'Products', 'Total Stock', 'Value (OMR)', 'Low Stock', 'Out of Stock']);
    categoryData.forEach(c => {
      rows.push([c.category, c.product_count, c.total_stock, c.total_value, c.low_stock, c.out_of_stock]);
    });
    rows.push([]);
  }

  /* --- Daily Trends --- */
  if (trendsData.length > 0) {
    rows.push(['=== DAILY SALES TREND ===']);
    rows.push(['Date', 'Sales (OMR)', 'COGS (OMR)', 'Orders']);
    trendsData.forEach(t => {
      rows.push([t.date, t.sales, t.cogs, t.order_count]);
    });
  }

  /* build CSV string — handle commas/quotes */
  const escapeCsv = (val) => {
    const s = String(val ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const csvBody = rows.map(row => row.map(escapeCsv).join(',')).join('\n');
  triggerDownload(csvBody, `dashboard_${now}.csv`, 'text/csv;charset=utf-8');
}

/* ------------------------------------------------
   PDF export — uses browser print dialog
   ------------------------------------------------ */
export function exportToPDF() {
  window.print();
}

/* ------------------------------------------------
   helper: Blob → download
   ------------------------------------------------ */
function triggerDownload(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}