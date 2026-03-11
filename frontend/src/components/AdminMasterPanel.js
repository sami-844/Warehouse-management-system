// frontend/src/components/AdminMasterPanel.js
import React, { useState, useEffect } from 'react';
import { adminAPI } from '../services/api';
import LoadingSpinner from './LoadingSpinner';
import { Shield } from 'lucide-react';
import './AdminPanel.css';

export default function AdminMasterPanel() {
  const [allUsers, setAllUsers] = useState([]);
  const [activityLog, setActivityLog] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [usersRes, logRes] = await Promise.all([
        adminAPI.listUsers(),
        adminAPI.getActivityLog({ limit: 100 }),
      ]);
      setAllUsers(Array.isArray(usersRes) ? usersRes : (usersRes?.items || []));
      setActivityLog(Array.isArray(logRes) ? logRes : (logRes?.items || []));
    } catch (err) {
      console.error('Master panel load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const isRecentlyActive = (lastActive) => {
    if (!lastActive) return false;
    return (Date.now() - new Date(lastActive).getTime()) < 30 * 60 * 1000;
  };

  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return 'Never';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  };

  const toggleUserStatus = async (user) => {
    try {
      await adminAPI.toggleUser(user.id);
      await loadData();
    } catch (err) {
      console.error('Toggle user status error:', err);
    }
  };

  const roleLabel = (r) => ({ admin: 'Admin', warehouse_manager: 'Warehouse Mgr', warehouse_staff: 'Warehouse Staff', sales_staff: 'Sales', delivery_driver: 'Driver', accountant: 'Accountant' }[(r || '').toLowerCase()] || r);
  const roleColor = (r) => ({ admin: '#dc2626', warehouse_manager: '#2563eb', warehouse_staff: '#6b7280', sales_staff: '#d97706', delivery_driver: '#059669', accountant: '#7c3aed' }[(r || '').toLowerCase()] || '#6b7280');

  const activeUsers = allUsers.filter(u => isRecentlyActive(u.last_active_at));

  if (loading) return <LoadingSpinner />;

  return (
    <div className="admin-container">
      <div className="page-header">
        <div className="header-content">
          <div className="header-icon"><Shield size={20} /></div>
          <div><h1>Admin Master Control</h1><p>Monitor all users and system activity in real time</p></div>
        </div>
      </div>

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Users', value: allUsers.length, color: '#1A3A5C' },
          { label: 'Active Now', value: activeUsers.length, color: '#28A745' },
          { label: 'Inactive Users', value: allUsers.filter(u => !u.is_active).length, color: '#DC3545' },
          { label: 'Total Logins', value: allUsers.reduce((sum, u) => sum + (u.login_count || 0), 0), color: '#17A2B8' },
        ].map(stat => (
          <div key={stat.label} style={{
            background: 'white', borderRadius: 8, padding: '16px 20px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)'
          }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: 13, color: '#6C757D', marginTop: 4 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Active Users */}
      {activeUsers.length > 0 && (
        <div style={{
          background: 'white', borderRadius: 8, padding: 20,
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: 24
        }}>
          <h3 style={{ margin: '0 0 16px', color: '#1A3A5C' }}>Currently Active Users</h3>
          {activeUsers.map(user => (
            <div key={user.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '8px 0', borderBottom: '1px solid #F0F0F0'
            }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#28A745' }} />
              <span style={{ fontWeight: 600 }}>{user.full_name || user.username}</span>
              <span className="status-pill" style={{ backgroundColor: roleColor(user.role) }}>{roleLabel(user.role)}</span>
              <span style={{ color: '#6C757D', fontSize: 12, marginLeft: 'auto' }}>
                Last seen: {formatTimeAgo(user.last_active_at)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* All Users Table */}
      <div style={{
        background: 'white', borderRadius: 8, padding: 20,
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: 24
      }}>
        <h3 style={{ margin: '0 0 16px', color: '#1A3A5C' }}>All Users Overview</h3>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>User</th><th>Role</th><th>Status</th><th>Logins</th>
                <th>Last Active</th><th>Warehouse</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {allUsers.map(user => (
                <tr key={user.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{user.full_name || user.username}</div>
                    <div style={{ fontSize: 11, color: '#6C757D' }}>{user.email || user.username}</div>
                  </td>
                  <td><span className="status-pill" style={{ backgroundColor: roleColor(user.role) }}>{roleLabel(user.role)}</span></td>
                  <td>
                    <span style={{ color: user.is_active ? '#28A745' : '#DC3545', fontWeight: 600, fontSize: 13 }}>
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>{user.login_count || 0}</td>
                  <td style={{ fontSize: 12, color: '#6C757D' }}>{formatTimeAgo(user.last_active_at)}</td>
                  <td style={{ fontSize: 12, color: '#6C757D' }}>{user.warehouse_group || '\u2014'}</td>
                  <td>
                    <button onClick={() => toggleUserStatus(user)} style={{
                      background: user.is_active ? '#FFF3CD' : '#D4EDDA',
                      color: user.is_active ? '#856404' : '#155724',
                      border: `1px solid ${user.is_active ? '#FFEAA7' : '#C3E6CB'}`,
                      borderRadius: 4, padding: '4px 10px', cursor: 'pointer', fontSize: 12
                    }}>
                      {user.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Activity Log */}
      <div style={{
        background: 'white', borderRadius: 8, padding: 20,
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)'
      }}>
        <h3 style={{ margin: '0 0 16px', color: '#1A3A5C' }}>Recent Activity Log</h3>
        {activityLog.length === 0 ? (
          <p style={{ color: '#6C757D', textAlign: 'center', padding: 20 }}>
            No activity recorded yet. Activity will appear here as users perform actions.
          </p>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr><th>User</th><th>Action</th><th>Module</th><th>Detail</th><th>Time</th></tr>
              </thead>
              <tbody>
                {activityLog.slice(0, 100).map(log => (
                  <tr key={log.id}>
                    <td style={{ fontWeight: 600 }}>{log.username}</td>
                    <td>
                      <span style={{
                        background: log.action === 'DELETE' ? '#F8D7DA' : log.action === 'CREATE' ? '#D4EDDA' : '#E3F2FD',
                        color: log.action === 'DELETE' ? '#721C24' : log.action === 'CREATE' ? '#155724' : '#1565C0',
                        padding: '1px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600
                      }}>{log.action}</span>
                    </td>
                    <td style={{ color: '#6C757D', fontSize: 13 }}>{log.module}</td>
                    <td style={{ fontSize: 12, maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.detail}
                    </td>
                    <td style={{ fontSize: 12, color: '#6C757D', whiteSpace: 'nowrap' }}>
                      {formatTimeAgo(log.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
