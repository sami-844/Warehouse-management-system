import LoadingSpinner from './LoadingSpinner';
import React, { useState, useEffect } from 'react';
import { adminAPI } from '../services/api';
import { PERMISSIONS } from '../constants/permissions';
import './AdminPanel.css';
import { UserCog } from 'lucide-react';

const permissionGroups = [
  {
    title: 'Sales & Payment',
    perms: [
      { key: PERMISSIONS.SALES.INVOICE_LIST, label: 'Invoice List' },
      { key: PERMISSIONS.SALES.INVOICE_LIST_ALL_USERS, label: 'Show All Users Invoices' },
      { key: PERMISSIONS.SALES.INVOICE_CREATE, label: 'Invoice Create' },
      { key: PERMISSIONS.SALES.INVOICE_EDIT, label: 'Invoice Edit' },
      { key: PERMISSIONS.SALES.INVOICE_DELETE, label: 'Invoice Delete' },
      { key: PERMISSIONS.SALES.INVOICE_PAYMENT, label: 'Invoice Payment' },
      { key: PERMISSIONS.SALES.INVOICE_RETURN, label: 'Invoice Return' },
      { key: PERMISSIONS.SALES.VIEW_COST_PRICE, label: 'View Cost Price on Invoice' },
      { key: PERMISSIONS.SALES.DISABLE_PRICE_EDIT, label: 'Disable Price Editing on Invoice' },
      { key: PERMISSIONS.SALES.ORDERS_VIEW, label: 'Sales Orders View' },
      { key: PERMISSIONS.SALES.ORDERS_CREATE, label: 'Sales Orders Create' },
      { key: PERMISSIONS.SALES.ESTIMATES_VIEW, label: 'Estimates View' },
      { key: PERMISSIONS.SALES.ESTIMATES_CREATE, label: 'Estimates Create' },
    ]
  },
  {
    title: 'Items & Inventory',
    perms: [
      { key: PERMISSIONS.INVENTORY.PRODUCTS_VIEW, label: 'Products View' },
      { key: PERMISSIONS.INVENTORY.PRODUCTS_CREATE, label: 'Products Create' },
      { key: PERMISSIONS.INVENTORY.PRODUCTS_EDIT, label: 'Products Edit' },
      { key: PERMISSIONS.INVENTORY.PRODUCTS_DELETE, label: 'Products Delete' },
      { key: PERMISSIONS.INVENTORY.PRODUCTS_IMPORT, label: 'Products Import' },
      { key: PERMISSIONS.INVENTORY.STOCK_RECEIPT, label: 'Stock Receipt' },
      { key: PERMISSIONS.INVENTORY.STOCK_ISSUE, label: 'Stock Issue' },
      { key: PERMISSIONS.INVENTORY.STOCK_TAKE, label: 'Stock Take' },
      { key: PERMISSIONS.INVENTORY.DAMAGE_ITEMS, label: 'Damage Items' },
      { key: PERMISSIONS.INVENTORY.EXPIRY_TRACKER, label: 'Expiry Tracker' },
      { key: PERMISSIONS.INVENTORY.BARCODE_PRINT, label: 'Barcode Print' },
      { key: PERMISSIONS.INVENTORY.CATEGORIES_MANAGE, label: 'Manage Categories' },
      { key: PERMISSIONS.INVENTORY.MANAGE_WAREHOUSES, label: 'Manage Warehouses' },
    ]
  },
  {
    title: 'Purchasing & Bills',
    perms: [
      { key: PERMISSIONS.PURCHASING.ORDERS_VIEW, label: 'Purchase Orders View' },
      { key: PERMISSIONS.PURCHASING.ORDERS_CREATE, label: 'Purchase Orders Create' },
      { key: PERMISSIONS.PURCHASING.ORDERS_EDIT, label: 'Purchase Orders Edit' },
      { key: PERMISSIONS.PURCHASING.INVOICES_VIEW, label: 'Purchase Invoices View' },
      { key: PERMISSIONS.PURCHASING.INVOICES_CREATE, label: 'Purchase Invoices Create' },
      { key: PERMISSIONS.PURCHASING.INVOICES_PAYMENT, label: 'Purchase Payments' },
      { key: PERMISSIONS.PURCHASING.RETURNS_VIEW, label: 'Purchase Returns View' },
      { key: PERMISSIONS.PURCHASING.RETURNS_CREATE, label: 'Purchase Returns Create' },
      { key: PERMISSIONS.PURCHASING.BILLS_VIEW, label: 'Bills View' },
      { key: PERMISSIONS.PURCHASING.BILLS_CREATE, label: 'Bills Create' },
      { key: PERMISSIONS.PURCHASING.BILLS_PAYMENT, label: 'Bills Payment' },
      { key: PERMISSIONS.PURCHASING.SUPPLIERS_VIEW, label: 'Suppliers View' },
      { key: PERMISSIONS.PURCHASING.SUPPLIERS_CREATE, label: 'Suppliers Create' },
      { key: PERMISSIONS.PURCHASING.SUPPLIERS_EDIT, label: 'Suppliers Edit' },
      { key: PERMISSIONS.PURCHASING.SUPPLIERS_DELETE, label: 'Suppliers Delete' },
      { key: PERMISSIONS.PURCHASING.SUPPLIERS_IMPORT, label: 'Suppliers Import' },
    ]
  },
  {
    title: 'Customers',
    perms: [
      { key: PERMISSIONS.SALES.CUSTOMERS_VIEW, label: 'Customers View' },
      { key: PERMISSIONS.SALES.CUSTOMERS_CREATE, label: 'Customers Create' },
      { key: PERMISSIONS.SALES.CUSTOMERS_EDIT, label: 'Customers Edit' },
      { key: PERMISSIONS.SALES.CUSTOMERS_DELETE, label: 'Customers Delete' },
      { key: PERMISSIONS.SALES.CUSTOMERS_IMPORT, label: 'Customers Import' },
      { key: PERMISSIONS.SALES.CUSTOMER_STATEMENT, label: 'Customer Statement' },
    ]
  },
  {
    title: 'Finance & Accounting',
    perms: [
      { key: PERMISSIONS.FINANCE.CASH_IN_OUT, label: 'Cash In / Out' },
      { key: PERMISSIONS.FINANCE.JOURNAL_ENTRY, label: 'Manual Journal Entry' },
      { key: PERMISSIONS.FINANCE.WALLETS, label: 'Wallets' },
      { key: PERMISSIONS.FINANCE.BANK_ACCOUNTS, label: 'Bank Accounts' },
      { key: PERMISSIONS.FINANCE.BALANCE_SHEET, label: 'Balance Sheet' },
      { key: PERMISSIONS.FINANCE.LEDGER, label: 'Ledger Reports' },
      { key: PERMISSIONS.FINANCE.VAT_PAYMENT, label: 'VAT Payment' },
    ]
  },
  {
    title: 'Reports',
    perms: [
      { key: PERMISSIONS.REPORTS.SALES_REPORT, label: 'Sales Report' },
      { key: PERMISSIONS.REPORTS.PURCHASE_REPORT, label: 'Purchase Report' },
      { key: PERMISSIONS.REPORTS.STOCK_REPORT, label: 'Stock Report' },
      { key: PERMISSIONS.REPORTS.PROFIT_LOSS, label: 'Profit & Loss' },
      { key: PERMISSIONS.REPORTS.VAT_REPORT, label: 'VAT Report' },
      { key: PERMISSIONS.REPORTS.CUSTOMER_SUMMARY, label: 'Customer Summary' },
      { key: PERMISSIONS.REPORTS.VENDOR_SUMMARY, label: 'Vendor Summary' },
      { key: PERMISSIONS.REPORTS.EXPENSE_REPORT, label: 'Expense Report' },
      { key: PERMISSIONS.REPORTS.SALES_RETURN_REPORT, label: 'Sales Return Report' },
      { key: PERMISSIONS.REPORTS.PURCHASE_RETURN_REPORT, label: 'Purchase Return Report' },
    ]
  },
  {
    title: 'Dashboard Widgets',
    perms: [
      { key: PERMISSIONS.DASHBOARD.WIDGET_SALES, label: 'Sales Widget' },
      { key: PERMISSIONS.DASHBOARD.WIDGET_PURCHASES, label: 'Purchases Widget' },
      { key: PERMISSIONS.DASHBOARD.WIDGET_INVENTORY, label: 'Inventory Widget' },
      { key: PERMISSIONS.DASHBOARD.WIDGET_CASH_FLOW, label: 'Cash Flow Widget' },
      { key: PERMISSIONS.DASHBOARD.WIDGET_OVERDUE, label: 'Overdue Invoices Widget' },
      { key: PERMISSIONS.DASHBOARD.WIDGET_WALLETS, label: 'Wallets Widget' },
      { key: PERMISSIONS.DASHBOARD.WIDGET_PAYABLE_BILLS, label: 'Payable Bills Widget' },
      { key: PERMISSIONS.DASHBOARD.WIDGET_PROFIT, label: 'Profit Widget' },
    ]
  },
  {
    title: 'Delivery',
    perms: [
      { key: PERMISSIONS.DELIVERY.VIEW, label: 'Delivery View' },
      { key: PERMISSIONS.DELIVERY.CREATE, label: 'Delivery Create' },
      { key: PERMISSIONS.DELIVERY.EDIT, label: 'Delivery Edit' },
      { key: PERMISSIONS.DELIVERY.DRIVER_APP, label: 'Driver App Access' },
      { key: PERMISSIONS.DELIVERY.VAN_SALES, label: 'Van Sales Access' },
      { key: PERMISSIONS.DELIVERY.VAN_LOAD, label: 'Van Load Sheet' },
    ]
  },
  {
    title: 'Admin & Settings',
    perms: [
      { key: PERMISSIONS.ADMIN.USERS_VIEW, label: 'Users View' },
      { key: PERMISSIONS.ADMIN.USERS_CREATE, label: 'Users Create' },
      { key: PERMISSIONS.ADMIN.USERS_EDIT, label: 'Users Edit' },
      { key: PERMISSIONS.ADMIN.USERS_DEACTIVATE, label: 'Users Deactivate' },
      { key: PERMISSIONS.ADMIN.ROLES_VIEW, label: 'Roles View' },
      { key: PERMISSIONS.ADMIN.ROLES_CREATE, label: 'Roles Create' },
      { key: PERMISSIONS.ADMIN.ROLES_EDIT, label: 'Roles Edit' },
      { key: PERMISSIONS.ADMIN.COMPANY_SETTINGS, label: 'Company Settings' },
      { key: PERMISSIONS.ADMIN.INVOICE_SETTINGS, label: 'Invoice Settings' },
      { key: PERMISSIONS.ADMIN.VAT_SETTINGS, label: 'VAT Settings' },
      { key: PERMISSIONS.ADMIN.DELETED_ITEMS, label: 'Deleted Items Archive' },
      { key: PERMISSIONS.ADMIN.ACTIVITY_LOG, label: 'Activity Log' },
      { key: PERMISSIONS.ADMIN.MASTER_CONTROL, label: 'Master Control Panel' },
      { key: PERMISSIONS.ADMIN.RENAME_LABELS, label: 'Rename Labels' },
    ]
  },
];

function UserManagement() {
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showPwdModal, setShowPwdModal] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState({ text: '', type: '' });
  const [form, setForm] = useState({ username: '', email: '', full_name: '', password: '', role: 'warehouse_staff', phone: '', employee_id: '', warehouse_group: '' });
  // Roles tab state
  const [roles, setRoles] = useState([]);
  // Permission panel state
  const [showPermPanel, setShowPermPanel] = useState(false);
  const [permEditingRole, setPermEditingRole] = useState(null);
  const [selectedPerms, setSelectedPerms] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); loadRoles(); }, []);
  const load = async () => { setLoading(true); try { setUsers(await adminAPI.listUsers()); } catch(e) { console.error(e); } finally { setLoading(false); } };
  const loadRoles = async () => { try { const d = await adminAPI.getRoles(); setRoles(Array.isArray(d) ? d : (d.roles || [])); } catch(e) {} };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        const { password, username, ...updateData } = form;
        await adminAPI.updateUser(editingId, updateData);
        setMessage({ text: 'User updated!', type: 'success' });
      } else {
        if (form.password.length < 6) { setMessage({ text: 'Password must be at least 6 characters', type: 'error' }); return; }
        await adminAPI.createUser(form);
        setMessage({ text: 'User created!', type: 'success' });
      }
      setShowForm(false); setEditingId(null); resetForm(); load();
    } catch(e) { setMessage({ text: `${e.response?.data?.detail || e.message}`, type: 'error' }); }
  };

  const editUser = (u) => {
    setForm({ username: u.username, email: u.email, full_name: u.full_name, password: '', role: u.role, phone: u.phone || '', employee_id: u.employee_id || '', warehouse_group: u.warehouse_group || '' });
    setEditingId(u.id); setShowForm(true);
  };

  const toggleUser = async (userId) => {
    try {
      const result = await adminAPI.toggleUser(userId);
      setMessage({ text: `${result.message}`, type: 'success' });
      load();
    } catch(e) { setMessage({ text: `${e.response?.data?.detail || e.message}`, type: 'error' }); }
  };

  const changePassword = async () => {
    if (newPassword.length < 6) { setMessage({ text: 'Password must be at least 6 characters', type: 'error' }); return; }
    try {
      await adminAPI.changePassword(showPwdModal.id, { new_password: newPassword });
      setMessage({ text: `Password changed for ${showPwdModal.username}`, type: 'success' });
      setShowPwdModal(null); setNewPassword('');
    } catch(e) { setMessage({ text: `${e.response?.data?.detail || e.message}`, type: 'error' }); }
  };

  const resetForm = () => setForm({ username: '', email: '', full_name: '', password: '', role: 'warehouse_staff', phone: '', employee_id: '', warehouse_group: '' });

  const rl = (r) => (r || '').toLowerCase();
  const roleLabel = (r) => ({ admin: 'Admin', warehouse_manager: 'Warehouse Mgr', warehouse_staff: 'Warehouse Staff', sales_staff: 'Sales', delivery_driver: 'Driver', accountant: 'Accountant' }[rl(r)] || r);
  const roleColor = (r) => ({ admin: '#dc2626', warehouse_manager: '#2563eb', warehouse_staff: '#6b7280', sales_staff: '#d97706', delivery_driver: '#059669', accountant: '#7c3aed' }[rl(r)] || '#6b7280');
  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return 'Never';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return new Date(dateStr).toLocaleDateString('en-GB', {day:'2-digit', month:'short', year:'numeric'});
  };

  return (
    <div className="admin-container">
      <div className="page-header"><div className="header-content"><div className="header-icon users"><UserCog size={20} /></div><div><h1>User Management</h1><p>Manage system users and roles</p></div></div>
        {activeTab === 'users' && <button className="action-btn primary" onClick={() => { resetForm(); setEditingId(null); setShowForm(!showForm); }}>{showForm ? '✕ Cancel' : '+ New User'}</button>}</div>

      {message.text && <div className={`message ${message.type}`}>{message.text}</div>}

      <div className="tab-bar">
        <button className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>Users</button>
        <button className={`tab-btn ${activeTab === 'roles' ? 'active' : ''}`} onClick={() => setActiveTab('roles')}>Roles & Permissions</button>
      </div>

      {/* ── Users Tab ── */}
      {activeTab === 'users' && <>
      {/* Password Modal */}
      {showPwdModal && (
        <div className="modal-overlay" onClick={() => setShowPwdModal(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h3>Change Password — {showPwdModal.username}</h3>
            <div className="form-group"><label>New Password (min 6 chars)</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Enter new password" /></div>
            <div className="modal-actions"><button className="submit-btn" onClick={changePassword}>Change Password</button>
              <button className="cancel-btn" onClick={() => setShowPwdModal(null)}>Cancel</button></div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="form-card"><h3>{editingId ? 'Edit User' : 'Create User'}</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-row-3">
              <div className="form-group"><label>Username *</label><input value={form.username} onChange={e => setForm(p => ({...p, username: e.target.value}))} required disabled={!!editingId} /></div>
              <div className="form-group"><label>Full Name *</label><input value={form.full_name} onChange={e => setForm(p => ({...p, full_name: e.target.value}))} required /></div>
              <div className="form-group"><label>Email *</label><input type="email" value={form.email} onChange={e => setForm(p => ({...p, email: e.target.value}))} required /></div>
            </div>
            <div className="form-row-3">
              <div className="form-group"><label>Role</label>
                <select value={form.role} onChange={e => setForm(p => ({...p, role: e.target.value}))}>
                  <option value="admin">Admin</option><option value="warehouse_manager">Warehouse Manager</option>
                  <option value="warehouse_staff">Warehouse Staff</option><option value="sales_staff">Sales Staff</option>
                  <option value="delivery_driver">Delivery Driver</option><option value="accountant">Accountant</option>
                </select></div>
              <div className="form-group"><label>Phone</label><input value={form.phone} onChange={e => setForm(p => ({...p, phone: e.target.value}))} /></div>
              <div className="form-group"><label>Employee ID</label><input value={form.employee_id} onChange={e => setForm(p => ({...p, employee_id: e.target.value}))} /></div>
            </div>
            <div className="form-row-3">
              <div className="form-group"><label>Warehouse Group</label>
                <input value={form.warehouse_group} onChange={e => setForm(p => ({...p, warehouse_group: e.target.value}))} placeholder="e.g. Main, North, South..." /></div>
            </div>
            {!editingId && <div className="form-row-3"><div className="form-group"><label>Password * (min 6 chars)</label>
              <input type="password" value={form.password} onChange={e => setForm(p => ({...p, password: e.target.value}))} required minLength="6" /></div></div>}
            <button type="submit" className="submit-btn">{editingId ? 'Update User' : 'Create User'}</button>
          </form>
        </div>
      )}

      {loading ? <LoadingSpinner /> : (
        <div className="table-container"><table className="data-table">
          <thead><tr><th>Username</th><th>Name</th><th>Email</th><th>Role</th><th>Phone</th><th>Status</th><th>Last Active</th><th>Logins</th><th>Actions</th></tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className={!u.is_active ? 'inactive' : ''}>
                <td className="code">{u.username}</td><td className="name">{u.full_name}</td><td>{u.email}</td>
                <td><span className="status-pill" style={{ backgroundColor: roleColor(u.role) }}>{roleLabel(u.role)}</span></td>
                <td>{u.phone || '-'}</td>
                <td>{u.is_active ? <span className="positive">Active</span> : <span className="negative">Inactive</span>}</td>
                <td style={{fontSize: 12, color: '#6C757D'}}>{formatTimeAgo(u.last_active_at)}</td>
                <td style={{textAlign: 'center'}}>{u.login_count || 0}</td>
                <td className="action-cell">
                  <button className="edit-btn" onClick={() => editUser(u)} title="Edit">Edit</button>
                  <button className="edit-btn" onClick={() => { setShowPwdModal(u); setNewPassword(''); }} title="Password">Pwd</button>
                  <button className="edit-btn" onClick={() => toggleUser(u.id)} title={u.is_active ? 'Deactivate' : 'Activate'}>{u.is_active ? 'Off' : 'On'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}

      </>}

      {/* ── Roles Tab ── */}
      {activeTab === 'roles' && (
        <div className="tab-content">
          <div className="table-container"><table className="data-table">
            <thead><tr><th>ROLE</th><th>DESCRIPTION</th><th>TYPE</th><th>STATUS</th><th>USERS</th><th>ACTIONS</th></tr></thead>
            <tbody>
              {roles.map(role => (
                <tr key={role.id}>
                  <td>
                    <div style={{fontWeight: 600}}>{role.display_name || role.name}</div>
                    <div style={{fontSize: 11, color: '#6C757D'}}>{role.name}</div>
                  </td>
                  <td style={{color: '#6C757D', fontSize: 13}}>{role.description || '\u2014'}</td>
                  <td>
                    <span style={{
                      background: role.role_type === 'system' ? '#E3F2FD' : '#E8F5E9',
                      color: role.role_type === 'system' ? '#1565C0' : '#2E7D32',
                      padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600
                    }}>
                      {role.role_type === 'system' ? 'SYSTEM' : 'CUSTOM'}
                    </span>
                  </td>
                  <td>
                    <button onClick={async () => {
                      try {
                        await adminAPI.updateRole(role.id, { ...role, is_active: !role.is_active });
                        await loadRoles();
                      } catch(err) { console.error('Toggle role status error:', err); }
                    }} style={{
                      background: role.is_active ? '#28A745' : '#6C757D',
                      color: 'white', border: 'none', borderRadius: 12,
                      padding: '3px 12px', cursor: 'pointer', fontSize: 12
                    }}>
                      {role.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td style={{textAlign: 'center'}}>{role.user_count || 0}</td>
                  <td>
                    <button onClick={() => {
                      setPermEditingRole(role);
                      setSelectedPerms(role.permissions || []);
                      setShowPermPanel(true);
                    }} style={{
                      background: '#17A2B8', color: 'white', border: 'none',
                      borderRadius: 4, padding: '5px 12px',
                      cursor: 'pointer', fontSize: 12, marginRight: 6
                    }}>Set Permissions</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}

      {/* ── Permission Panel Modal ── */}
      {showPermPanel && permEditingRole && (
        <div className="modal-overlay" onClick={() => setShowPermPanel(false)}>
          <div style={{
            background: 'white', borderRadius: 8, padding: 24,
            width: '90%', maxWidth: 900, maxHeight: '90vh',
            overflow: 'auto', position: 'relative'
          }} onClick={e => e.stopPropagation()}>
            <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: 20}}>
              <div>
                <h2 style={{margin: 0, color: '#1A3A5C'}}>
                  Set Permissions - {permEditingRole.display_name || permEditingRole.name}
                </h2>
                <p style={{margin: '4px 0 0', color: '#6C757D', fontSize: 13}}>
                  Select which actions this role can perform
                </p>
              </div>
              <button onClick={() => setShowPermPanel(false)}
                style={{background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', padding: '4px 8px'}}>X</button>
            </div>

            {/* Select All */}
            <div style={{marginBottom: 16, padding: '10px 14px', background: '#F0F7FF', borderRadius: 6}}>
              <label style={{display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600}}>
                <input type="checkbox"
                  checked={permissionGroups.every(g => g.perms.every(p => selectedPerms.includes(p.key)))}
                  onChange={e => {
                    if (e.target.checked) {
                      setSelectedPerms(permissionGroups.flatMap(g => g.perms.map(p => p.key)));
                    } else {
                      setSelectedPerms([]);
                    }
                  }}
                />
                Select All Permissions ({selectedPerms.length} selected)
              </label>
            </div>

            {/* Permission Groups */}
            {permissionGroups.map(group => (
              <div key={group.title} style={{marginBottom: 16}}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: '#1A3A5C', color: 'white', padding: '8px 14px',
                  borderRadius: '6px 6px 0 0', fontWeight: 600
                }}>
                  <span>{group.title}</span>
                  <label style={{display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13}}>
                    <input type="checkbox"
                      checked={group.perms.every(p => selectedPerms.includes(p.key))}
                      onChange={e => {
                        const keys = group.perms.map(p => p.key);
                        setSelectedPerms(prev => {
                          const without = prev.filter(p => !keys.includes(p));
                          return e.target.checked ? [...without, ...keys] : without;
                        });
                      }}
                    />
                    Select All
                  </label>
                </div>
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 8, padding: 14,
                  border: '1px solid #DEE2E6', borderTop: 'none',
                  borderRadius: '0 0 6px 6px'
                }}>
                  {group.perms.map(perm => (
                    <label key={perm.key}
                      style={{display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13}}>
                      <input type="checkbox"
                        checked={selectedPerms.includes(perm.key)}
                        onChange={e => {
                          setSelectedPerms(prev =>
                            e.target.checked ? [...prev, perm.key] : prev.filter(p => p !== perm.key)
                          );
                        }}
                      />
                      {perm.label}
                    </label>
                  ))}
                </div>
              </div>
            ))}

            {/* Save Button */}
            <div style={{display: 'flex', gap: 10, marginTop: 20}}>
              <button onClick={async () => {
                try {
                  setSaving(true);
                  await adminAPI.updateRole(permEditingRole.id, {
                    ...permEditingRole,
                    permissions: selectedPerms
                  });
                  setShowPermPanel(false);
                  setMessage({ text: `Permissions saved for ${permEditingRole.display_name || permEditingRole.name}`, type: 'success' });
                  await loadRoles();
                } catch(err) {
                  console.error('Save permissions error:', err);
                  setMessage({ text: 'Failed to save permissions', type: 'error' });
                } finally {
                  setSaving(false);
                }
              }} disabled={saving}
                style={{
                  background: '#28A745', color: 'white', border: 'none',
                  borderRadius: 4, padding: '10px 24px',
                  cursor: 'pointer', fontSize: 14, fontWeight: 600
                }}>
                {saving ? 'Saving...' : `Save Permissions (${selectedPerms.length})`}
              </button>
              <button onClick={() => setShowPermPanel(false)}
                style={{background: '#6C757D', color: 'white', border: 'none',
                  borderRadius: 4, padding: '10px 24px', cursor: 'pointer', fontSize: 14}}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default UserManagement;
