// frontend/src/constants/permissions.js
// MASTER PERMISSIONS FILE — all permissions defined here, nowhere else

export const PERMISSIONS = {

  // ── DASHBOARD WIDGETS ──
  DASHBOARD: {
    VIEW: 'dashboard.view',
    WIDGET_SALES: 'dashboard.widget_sales',
    WIDGET_PURCHASES: 'dashboard.widget_purchases',
    WIDGET_INVENTORY: 'dashboard.widget_inventory',
    WIDGET_CASH_FLOW: 'dashboard.widget_cash_flow',
    WIDGET_OVERDUE: 'dashboard.widget_overdue',
    WIDGET_WALLETS: 'dashboard.widget_wallets',
    WIDGET_PAYABLE_BILLS: 'dashboard.widget_payable_bills',
    WIDGET_PROFIT: 'dashboard.widget_profit',
  },

  // ── INVENTORY ──
  INVENTORY: {
    VIEW: 'inventory.view',
    PRODUCTS_VIEW: 'inventory.products.view',
    PRODUCTS_CREATE: 'inventory.products.create',
    PRODUCTS_EDIT: 'inventory.products.edit',
    PRODUCTS_DELETE: 'inventory.products.delete',
    PRODUCTS_IMPORT: 'inventory.products.import',
    STOCK_RECEIPT: 'inventory.stock_receipt',
    STOCK_ISSUE: 'inventory.stock_issue',
    STOCK_TAKE: 'inventory.stock_take',
    DAMAGE_ITEMS: 'inventory.damage_items',
    CATEGORIES_MANAGE: 'inventory.categories.manage',
    EXPIRY_TRACKER: 'inventory.expiry_tracker',
    BARCODE_PRINT: 'inventory.barcode_print',
    MANAGE_WAREHOUSES: 'inventory.warehouses.manage',
  },

  // ── SALES ──
  SALES: {
    VIEW: 'sales.view',
    INVOICE_LIST: 'sales.invoice.list',
    INVOICE_LIST_ALL_USERS: 'sales.invoice.list_all_users',
    INVOICE_CREATE: 'sales.invoice.create',
    INVOICE_EDIT: 'sales.invoice.edit',
    INVOICE_DELETE: 'sales.invoice.delete',
    INVOICE_PAYMENT: 'sales.invoice.payment',
    INVOICE_RETURN: 'sales.invoice.return',
    VIEW_COST_PRICE: 'sales.invoice.view_cost_price',
    DISABLE_PRICE_EDIT: 'sales.invoice.disable_price_edit',
    ORDERS_VIEW: 'sales.orders.view',
    ORDERS_CREATE: 'sales.orders.create',
    ORDERS_EDIT: 'sales.orders.edit',
    ORDERS_DELETE: 'sales.orders.delete',
    ESTIMATES_VIEW: 'sales.estimates.view',
    ESTIMATES_CREATE: 'sales.estimates.create',
    CUSTOMERS_VIEW: 'sales.customers.view',
    CUSTOMERS_CREATE: 'sales.customers.create',
    CUSTOMERS_EDIT: 'sales.customers.edit',
    CUSTOMERS_DELETE: 'sales.customers.delete',
    CUSTOMERS_IMPORT: 'sales.customers.import',
    CUSTOMER_STATEMENT: 'sales.customer_statement',
  },

  // ── PURCHASING ──
  PURCHASING: {
    VIEW: 'purchasing.view',
    ORDERS_VIEW: 'purchasing.orders.view',
    ORDERS_CREATE: 'purchasing.orders.create',
    ORDERS_EDIT: 'purchasing.orders.edit',
    ORDERS_DELETE: 'purchasing.orders.delete',
    INVOICES_VIEW: 'purchasing.invoices.view',
    INVOICES_CREATE: 'purchasing.invoices.create',
    INVOICES_PAYMENT: 'purchasing.invoices.payment',
    RETURNS_VIEW: 'purchasing.returns.view',
    RETURNS_CREATE: 'purchasing.returns.create',
    SUPPLIERS_VIEW: 'purchasing.suppliers.view',
    SUPPLIERS_CREATE: 'purchasing.suppliers.create',
    SUPPLIERS_EDIT: 'purchasing.suppliers.edit',
    SUPPLIERS_DELETE: 'purchasing.suppliers.delete',
    SUPPLIERS_IMPORT: 'purchasing.suppliers.import',
    BILLS_VIEW: 'purchasing.bills.view',
    BILLS_CREATE: 'purchasing.bills.create',
    BILLS_PAYMENT: 'purchasing.bills.payment',
  },

  // ── FINANCE ──
  FINANCE: {
    VIEW: 'finance.view',
    CASH_IN_OUT: 'finance.cash_in_out',
    JOURNAL_ENTRY: 'finance.journal_entry',
    WALLETS: 'finance.wallets',
    BANK_ACCOUNTS: 'finance.bank_accounts',
    BALANCE_SHEET: 'finance.balance_sheet',
    LEDGER: 'finance.ledger',
    VAT_PAYMENT: 'finance.vat_payment',
  },

  // ── REPORTS ──
  REPORTS: {
    VIEW: 'reports.view',
    SALES_REPORT: 'reports.sales',
    PURCHASE_REPORT: 'reports.purchase',
    STOCK_REPORT: 'reports.stock',
    PROFIT_LOSS: 'reports.profit_loss',
    VAT_REPORT: 'reports.vat',
    CUSTOMER_SUMMARY: 'reports.customer_summary',
    VENDOR_SUMMARY: 'reports.vendor_summary',
    EXPENSE_REPORT: 'reports.expense',
    SALES_RETURN_REPORT: 'reports.sales_return',
    PURCHASE_RETURN_REPORT: 'reports.purchase_return',
  },

  // ── DELIVERY ──
  DELIVERY: {
    VIEW: 'delivery.view',
    CREATE: 'delivery.create',
    EDIT: 'delivery.edit',
    DRIVER_APP: 'delivery.driver_app',
    VAN_SALES: 'delivery.van_sales',
  },

  // ── ADMIN ──
  ADMIN: {
    VIEW: 'admin.view',
    USERS_VIEW: 'admin.users.view',
    USERS_CREATE: 'admin.users.create',
    USERS_EDIT: 'admin.users.edit',
    USERS_DEACTIVATE: 'admin.users.deactivate',
    ROLES_VIEW: 'admin.roles.view',
    ROLES_CREATE: 'admin.roles.create',
    ROLES_EDIT: 'admin.roles.edit',
    COMPANY_SETTINGS: 'admin.company_settings',
    INVOICE_SETTINGS: 'admin.invoice_settings',
    VAT_SETTINGS: 'admin.vat_settings',
    DELETED_ITEMS: 'admin.deleted_items',
    ACTIVITY_LOG: 'admin.activity_log',
    MASTER_CONTROL: 'admin.master_control',
    RENAME_LABELS: 'admin.rename_labels',
  },
};

// Built-in role permission presets
export const ROLE_PRESETS = {
  admin: Object.values(PERMISSIONS).flatMap(g => Object.values(g)),

  warehouse_manager: [
    ...Object.values(PERMISSIONS.DASHBOARD),
    ...Object.values(PERMISSIONS.INVENTORY),
    PERMISSIONS.SALES.VIEW, PERMISSIONS.SALES.ORDERS_VIEW, PERMISSIONS.SALES.INVOICE_LIST,
    PERMISSIONS.PURCHASING.VIEW, PERMISSIONS.PURCHASING.ORDERS_VIEW,
    ...Object.values(PERMISSIONS.REPORTS),
  ],

  sales: [
    PERMISSIONS.DASHBOARD.VIEW, PERMISSIONS.DASHBOARD.WIDGET_SALES,
    PERMISSIONS.SALES.VIEW, PERMISSIONS.SALES.INVOICE_LIST,
    PERMISSIONS.SALES.INVOICE_CREATE, PERMISSIONS.SALES.INVOICE_EDIT,
    PERMISSIONS.SALES.INVOICE_PAYMENT, PERMISSIONS.SALES.ORDERS_VIEW,
    PERMISSIONS.SALES.ORDERS_CREATE, PERMISSIONS.SALES.CUSTOMERS_VIEW,
    PERMISSIONS.INVENTORY.PRODUCTS_VIEW,
    PERMISSIONS.REPORTS.SALES_REPORT,
  ],

  accountant: [
    PERMISSIONS.DASHBOARD.VIEW, PERMISSIONS.DASHBOARD.WIDGET_CASH_FLOW,
    PERMISSIONS.DASHBOARD.WIDGET_OVERDUE, PERMISSIONS.DASHBOARD.WIDGET_PAYABLE_BILLS,
    PERMISSIONS.SALES.INVOICE_LIST, PERMISSIONS.SALES.INVOICE_LIST_ALL_USERS,
    PERMISSIONS.PURCHASING.INVOICES_VIEW, PERMISSIONS.PURCHASING.BILLS_VIEW,
    ...Object.values(PERMISSIONS.FINANCE),
    ...Object.values(PERMISSIONS.REPORTS),
  ],

  driver: [
    PERMISSIONS.DASHBOARD.VIEW,
    PERMISSIONS.DELIVERY.VIEW, PERMISSIONS.DELIVERY.DRIVER_APP,
    PERMISSIONS.DELIVERY.VAN_SALES,
  ],

  warehouse_staff: [
    PERMISSIONS.DASHBOARD.VIEW,
    PERMISSIONS.INVENTORY.VIEW, PERMISSIONS.INVENTORY.PRODUCTS_VIEW,
    PERMISSIONS.INVENTORY.STOCK_RECEIPT, PERMISSIONS.INVENTORY.STOCK_ISSUE,
  ],
};
