import LoadingSpinner from './LoadingSpinner';
import React, { useState, useEffect } from 'react';
import { adminAPI } from '../services/api';
import './AdminPanel.css';
import { UserCog } from 'lucide-react';

function UserManagement() {
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showPwdModal, setShowPwdModal] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState({ text: '', type: '' });
  const [form, setForm] = useState({ username: '', email: '', full_name: '', password: '', role: 'warehouse_staff', phone: '', employee_id: '' });
  // Roles tab state
  const [roles, setRoles] = useState([]);
  const [allPermissions, setAllPermissions] = useState([]);
  const [editingRole, setEditingRole] = useState(null);
  const [roleForm, setRoleForm] = useState({ id: '', name: '', permissions: [] });

  useEffect(() => { load(); loadRoles(); }, []);
  const load = async () => { setLoading(true); try { setUsers(await adminAPI.listUsers()); } catch(e) { console.error(e); } finally { setLoading(false); } };
  const loadRoles = async () => { try { const d = await adminAPI.getRoles(); setRoles(d.roles || []); setAllPermissions(d.permissions || []); } catch(e) {} };

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
            {!editingId && <div className="form-row-3"><div className="form-group"><label>Password * (min 6 chars)</label>
              <input type="password" value={form.password} onChange={e => setForm(p => ({...p, password: e.target.value}))} required minLength="6" /></div></div>}
            <button type="submit" className="submit-btn">{editingId ? 'Update User' : 'Create User'}</button>
          </form>
        </div>
      )}

      {loading ? <LoadingSpinner /> : (
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

      </>}

      {/* ── Roles Tab ── */}
      {activeTab === 'roles' && (
        <div className="tab-content">
          {editingRole !== null && (
            <div className="form-card">
              <h3>{editingRole === 'new' ? 'Create Role' : `Edit Role: ${roleForm.name}`}</h3>
              <div className="form-row-2">
                <div className="form-group"><label>Role ID *</label>
                  <input value={roleForm.id} onChange={e => setRoleForm(p => ({...p, id: e.target.value.toLowerCase().replace(/\s+/g, '_')}))} placeholder="custom_role" disabled={editingRole !== 'new'} /></div>
                <div className="form-group"><label>Display Name *</label>
                  <input value={roleForm.name} onChange={e => setRoleForm(p => ({...p, name: e.target.value}))} placeholder="Custom Role" /></div>
              </div>
              <div className="form-group"><label>Permissions</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 8 }}>
                  {allPermissions.map(p => (
                    <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                      <input type="checkbox" checked={roleForm.permissions.includes(p.id)}
                        onChange={e => {
                          setRoleForm(prev => ({
                            ...prev,
                            permissions: e.target.checked ? [...prev.permissions, p.id] : prev.permissions.filter(x => x !== p.id)
                          }));
                        }} />
                      {p.label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="wms-flex-row" style={{ marginTop: 12 }}>
                <button className="submit-btn" onClick={async () => {
                  if (!roleForm.id || !roleForm.name) { setMessage({ text: 'Role ID and name are required', type: 'error' }); return; }
                  try {
                    const customRoles = roles.filter(r => !r.is_default);
                    const updated = editingRole === 'new'
                      ? [...customRoles, { ...roleForm, is_default: false }]
                      : customRoles.map(r => r.id === roleForm.id ? { ...roleForm, is_default: false } : r);
                    await adminAPI.updateRoles(updated);
                    setMessage({ text: `Role "${roleForm.name}" saved!`, type: 'success' });
                    setEditingRole(null);
                    loadRoles();
                  } catch(e) { setMessage({ text: e.response?.data?.detail || 'Failed to save role', type: 'error' }); }
                }}>Save Role</button>
                <button className="cancel-btn" onClick={() => setEditingRole(null)}>Cancel</button>
              </div>
            </div>
          )}

          <div className="wms-flex-between" style={{ marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>System Roles</h3>
            {editingRole === null && <button className="action-btn primary" onClick={() => { setEditingRole('new'); setRoleForm({ id: '', name: '', permissions: ['dashboard'] }); }}>+ New Role</button>}
          </div>

          <div className="table-container"><table className="data-table">
            <thead><tr><th>Role</th><th>Type</th><th>Permissions</th><th>Actions</th></tr></thead>
            <tbody>
              {roles.map(r => (
                <tr key={r.id}>
                  <td className="name">{r.name}</td>
                  <td>{r.is_default ? <span className="wms-badge active">Built-in</span> : <span className="wms-badge pending">Custom</span>}</td>
                  <td><div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {(r.permissions || []).map(p => <span key={p} className="wms-badge completed" style={{ fontSize: 10, padding: '1px 5px' }}>{p}</span>)}
                  </div></td>
                  <td>{!r.is_default && (
                    <div className="action-cell">
                      <button className="edit-btn" onClick={() => { setEditingRole(r.id); setRoleForm({ id: r.id, name: r.name, permissions: r.permissions || [] }); }}>Edit</button>
                      <button className="edit-btn" style={{ background: '#fee2e2', color: '#dc2626' }} onClick={async () => {
                        if (!window.confirm(`Delete role "${r.name}"?`)) return;
                        try {
                          const customRoles = roles.filter(cr => !cr.is_default && cr.id !== r.id);
                          await adminAPI.updateRoles(customRoles);
                          setMessage({ text: `Role "${r.name}" deleted`, type: 'success' });
                          loadRoles();
                        } catch(e) { setMessage({ text: 'Failed to delete role', type: 'error' }); }
                      }}>Delete</button>
                    </div>
                  )}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}
    </div>
  );
}
export default UserManagement;
