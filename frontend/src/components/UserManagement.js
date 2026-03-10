import React, { useState, useEffect } from 'react';
import { adminAPI } from '../services/api';
import './AdminPanel.css';
import { UserCog } from 'lucide-react';

function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showPwdModal, setShowPwdModal] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState({ text: '', type: '' });
  const [form, setForm] = useState({ username: '', email: '', full_name: '', password: '', role: 'warehouse_staff', phone: '', employee_id: '' });

  useEffect(() => { load(); }, []);
  const load = async () => { setLoading(true); try { setUsers(await adminAPI.listUsers()); } catch(e) { console.error(e); } finally { setLoading(false); } };

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
    setForm({ username: u.username, email: u.email, full_name: u.full_name, password: '', role: u.role, phone: u.phone || '', employee_id: u.employee_id || '' });
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

  const resetForm = () => setForm({ username: '', email: '', full_name: '', password: '', role: 'warehouse_staff', phone: '', employee_id: '' });

  const roleLabel = (r) => ({ admin: 'Admin', warehouse_manager: 'Warehouse Mgr', warehouse_staff: 'Warehouse Staff', sales_staff: 'Sales', delivery_driver: 'Driver', accountant: 'Accountant' }[r] || r);
  const roleColor = (r) => ({ admin: '#dc2626', warehouse_manager: '#2563eb', warehouse_staff: '#6b7280', sales_staff: '#d97706', delivery_driver: '#059669', accountant: '#7c3aed' }[r] || '#6b7280');

  return (
    <div className="admin-container">
      <div className="page-header"><div className="header-content"><div className="header-icon users"><UserCog size={20} /></div><div><h1>User Management</h1><p>Manage system users and roles</p></div></div>
        <button className="action-btn primary" onClick={() => { resetForm(); setEditingId(null); setShowForm(!showForm); }}>{showForm ? '✕ Cancel' : '+ New User'}</button></div>

      {message.text && <div className={`message ${message.type}`}>{message.text}</div>}

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
            {!editingId && <div className="form-row-3"><div className="form-group"><label>Password * (min 6 chars)</label>
              <input type="password" value={form.password} onChange={e => setForm(p => ({...p, password: e.target.value}))} required minLength="6" /></div></div>}
            <button type="submit" className="submit-btn">{editingId ? 'Update User' : 'Create User'}</button>
          </form>
        </div>
      )}

      {loading ? <div className="loading-state">Loading...</div> : (
        <div className="table-container"><table className="data-table">
          <thead><tr><th>Username</th><th>Name</th><th>Email</th><th>Role</th><th>Phone</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className={!u.is_active ? 'inactive' : ''}>
                <td className="code">{u.username}</td><td className="name">{u.full_name}</td><td>{u.email}</td>
                <td><span className="status-pill" style={{ backgroundColor: roleColor(u.role) }}>{roleLabel(u.role)}</span></td>
                <td>{u.phone || '-'}</td>
                <td>{u.is_active ? <span className="positive">Active</span> : <span className="negative">Inactive</span>}</td>
                <td>{u.created_at ? u.created_at.slice(0, 10) : '-'}</td>
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

      <div className="role-legend">
        <h4>Role Permissions</h4>
        <div className="role-grid">
          <div className="role-item"><span className="status-pill" style={{backgroundColor:'#dc2626'}}>Admin</span> Full access — all features</div>
          <div className="role-item"><span className="status-pill" style={{backgroundColor:'#2563eb'}}>Warehouse Mgr</span> Inventory, stock, receipts, adjustments</div>
          <div className="role-item"><span className="status-pill" style={{backgroundColor:'#d97706'}}>Sales</span> Customers, sales orders, pricing</div>
          <div className="role-item"><span className="status-pill" style={{backgroundColor:'#059669'}}>Driver</span> Deliveries, mark delivered</div>
          <div className="role-item"><span className="status-pill" style={{backgroundColor:'#7c3aed'}}>Accountant</span> Financial, reports, invoices, payments</div>
        </div>
      </div>
    </div>
  );
}
export default UserManagement;
