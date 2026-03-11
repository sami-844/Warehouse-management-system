// Deleted Items Archive — soft-deleted products with restore capability
import React, { useState, useEffect } from 'react';
import EmptyState from './EmptyState';
import { productAPI } from '../services/api';

function DeletedItems() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewItem, setViewItem] = useState(null);
  const [restoring, setRestoring] = useState(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await productAPI.getDeleted();
      setItems(Array.isArray(data) ? data : (data?.items || []));
      setError(null);
    } catch (err) {
      console.error('Error loading deleted items:', err);
      setError('Failed to load deleted items');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (item) => {
    if (!window.confirm(`Restore "${item.item_name}" back to active products?`)) return;
    try {
      setRestoring(item.id);
      await productAPI.restore(item.item_id);
      await loadData();
    } catch (err) {
      console.error('Error restoring item:', err);
      setError('Failed to restore item: ' + (err.response?.data?.detail || err.message));
    } finally {
      setRestoring(null);
    }
  };

  const filtered = items.filter(item => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (item.item_name || '').toLowerCase().includes(s) ||
           (item.item_sku || '').toLowerCase().includes(s) ||
           (item.deleted_by_name || '').toLowerCase().includes(s) ||
           (item.deleted_reason || '').toLowerCase().includes(s);
  });

  const parseItemData = (item) => {
    try { return JSON.parse(item.item_data || '{}'); } catch { return {}; }
  };

  if (loading) return <div className="loading">Loading deleted items...</div>;

  return (
    <div className="admin-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Deleted Items</h1>
          <p className="page-subtitle">Archive of soft-deleted products with audit trail</p>
        </div>
      </div>

      {/* KPI Summary */}
      <div className="wms-kpi-row">
        <div className="wms-kpi-card">
          <div className="wms-kpi-label">Total Deleted</div>
          <div className="wms-kpi-value">{items.length}</div>
        </div>
        <div className="wms-kpi-card">
          <div className="wms-kpi-label">Restored</div>
          <div className="wms-kpi-value green">{items.filter(i => i.is_restored).length}</div>
        </div>
        <div className="wms-kpi-card">
          <div className="wms-kpi-label">Pending</div>
          <div className="wms-kpi-value red">{items.filter(i => !i.is_restored).length}</div>
        </div>
      </div>

      {error && <div className="error" style={{ marginBottom: 12 }}>{error}</div>}

      <div className="filters" style={{ marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Search by name, SKU, deleted by, or reason..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="search-input"
          style={{ maxWidth: 400 }}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No deleted items" hint="Products you delete will appear here for audit and recovery" />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                <th style={thStyle}>Product</th>
                <th style={thStyle}>SKU</th>
                <th style={thStyle}>Deleted By</th>
                <th style={thStyle}>Deleted At</th>
                <th style={thStyle}>Reason</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => (
                <tr key={item.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={tdStyle}>{item.item_name || '—'}</td>
                  <td style={tdStyle}><code style={{ fontSize: 12, background: '#f1f5f9', padding: '2px 6px', borderRadius: 3 }}>{item.item_sku || '—'}</code></td>
                  <td style={tdStyle}>{item.deleted_by_name || '—'}</td>
                  <td style={tdStyle}>{item.deleted_at ? new Date(item.deleted_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                  <td style={{ ...tdStyle, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.deleted_reason || '—'}</td>
                  <td style={tdStyle}>
                    {item.is_restored
                      ? <span className="wms-badge completed">Restored</span>
                      : <span className="wms-badge unpaid">Deleted</span>}
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => setViewItem(item)}
                        style={{ padding: '4px 10px', fontSize: 12, borderRadius: 4, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontWeight: 600 }}>
                        View
                      </button>
                      {!item.is_restored && (
                        <button onClick={() => handleRestore(item)} disabled={restoring === item.id}
                          style={{ padding: '4px 10px', fontSize: 12, borderRadius: 4, border: 'none', background: '#16a34a', color: '#fff', cursor: 'pointer', fontWeight: 600, opacity: restoring === item.id ? 0.6 : 1 }}>
                          {restoring === item.id ? 'Restoring...' : 'Restore'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* View Details Modal */}
      {viewItem && (
        <div className="modal-overlay" onClick={() => setViewItem(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 520, padding: 24, maxHeight: '80vh', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 18 }}>Deleted Item Details</h3>
            <p style={{ margin: '0 0 16px', color: '#64748b', fontSize: 13 }}>{viewItem.item_name} ({viewItem.item_sku})</p>

            <div style={{ display: 'grid', gap: 10, fontSize: 14 }}>
              <DetailRow label="Item Type" value={viewItem.item_type || 'product'} />
              <DetailRow label="Deleted By" value={viewItem.deleted_by_name || '—'} />
              <DetailRow label="Deleted At" value={viewItem.deleted_at ? new Date(viewItem.deleted_at).toLocaleString('en-GB') : '—'} />
              <DetailRow label="Reason" value={viewItem.deleted_reason || 'No reason provided'} />
              <DetailRow label="Status" value={viewItem.is_restored ? 'Restored' : 'Deleted'} />
              {viewItem.is_restored && (
                <>
                  <DetailRow label="Restored By" value={viewItem.restored_by_name || '—'} />
                  <DetailRow label="Restored At" value={viewItem.restored_at ? new Date(viewItem.restored_at).toLocaleString('en-GB') : '—'} />
                </>
              )}
            </div>

            {/* Original product data snapshot */}
            {viewItem.item_data && (
              <div style={{ marginTop: 16, padding: 12, background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                <h4 style={{ margin: '0 0 8px', fontSize: 13, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>Original Data Snapshot</h4>
                {(() => {
                  const d = parseItemData(viewItem);
                  return Object.keys(d).length > 0 ? (
                    <div style={{ display: 'grid', gap: 6, fontSize: 13 }}>
                      {Object.entries(d).filter(([k]) => !['id', 'is_deleted', 'deleted_at', 'deleted_by', 'deleted_reason'].includes(k)).map(([k, v]) => (
                        <div key={k} style={{ display: 'flex', gap: 8 }}>
                          <span style={{ color: '#64748b', minWidth: 120 }}>{k.replace(/_/g, ' ')}:</span>
                          <span style={{ color: '#1a2332' }}>{v != null ? String(v) : '—'}</span>
                        </div>
                      ))}
                    </div>
                  ) : <p style={{ color: '#94a3b8', fontSize: 13 }}>No snapshot data available</p>;
                })()}
              </div>
            )}

            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              {!viewItem.is_restored && (
                <button onClick={() => { handleRestore(viewItem); setViewItem(null); }}
                  style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#16a34a', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                  Restore Product
                </button>
              )}
              <button onClick={() => setViewItem(null)}
                style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const thStyle = { padding: '10px 12px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' };
const tdStyle = { padding: '10px 12px', fontSize: 14, color: '#1a2332' };

function DetailRow({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <span style={{ color: '#64748b', minWidth: 100, fontWeight: 600, fontSize: 13 }}>{label}:</span>
      <span style={{ color: '#1a2332' }}>{value}</span>
    </div>
  );
}

export default DeletedItems;
