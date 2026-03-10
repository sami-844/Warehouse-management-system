// StockAdjustmentLog.js — Phase 10: Stock adjustment audit trail
import React, { useState, useEffect } from 'react';
import { inventoryAPI } from '../services/api';
import { ClipboardList } from 'lucide-react';
import './AdminPanel.css';

function StockAdjustmentLog() {
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));
  const [typeFilter, setTypeFilter] = useState('adjustment');

  useEffect(() => { load(); }, [fromDate, toDate, typeFilter]);

  const load = async () => {
    setLoading(true);
    try {
      const params = { from_date: fromDate, to_date: toDate };
      if (typeFilter) params.transaction_type = typeFilter;
      const data = await inventoryAPI.getMovements(params);
      setMovements(Array.isArray(data) ? data : (data?.movements || data?.data || []));
    } catch (e) {
      console.error(e);
      setMovements([]);
    } finally {
      setLoading(false);
    }
  };

  const typeColor = {
    adjustment: '#8b5cf6',
    receipt: '#16a34a',
    issue: '#dc2626',
    transfer: '#2563eb',
    stock_take: '#d97706',
  };

  const qtyColor = (qty) => Number(qty) >= 0 ? '#16a34a' : '#dc2626';

  return (
    <div className="admin-container">
      <div className="page-header">
        <div className="header-content">
          <div className="header-icon" style={{ background: '#8b5cf6' }}>
            <ClipboardList size={20} color="#fff" />
          </div>
          <div>
            <h1>Stock Adjustment Log</h1>
            <p>Audit trail for all inventory movements and adjustments</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <label>Type:</label>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="filter-input">
          <option value="">All Movements</option>
          <option value="adjustment">Adjustments</option>
          <option value="receipt">Receipts</option>
          <option value="issue">Issues</option>
          <option value="transfer">Transfers</option>
          <option value="stock_take">Stock Takes</option>
        </select>
        <label>From:</label>
        <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="filter-input" />
        <label>To:</label>
        <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="filter-input" />
        <button className="action-btn primary" onClick={load}>Refresh</button>
      </div>

      {/* Summary */}
      {!loading && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          {['adjustment', 'receipt', 'issue', 'transfer', 'stock_take'].map(t => {
            const count = movements.filter(m => (m.type || m.transaction_type) === t).length;
            if (count === 0) return null;
            return (
              <div key={t} style={{
                background: '#fff', border: `1px solid ${typeColor[t] || '#ccc'}`,
                borderRadius: 8, padding: '8px 14px', fontSize: 13,
                color: typeColor[t] || '#333', fontWeight: 600,
              }}>
                {t.replace('_', ' ')}: {count}
              </div>
            );
          })}
          <div style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 8, padding: '8px 14px', fontSize: 13, color: '#475569', fontWeight: 600 }}>
            Total: {movements.length}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="form-card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading...</div>
        ) : movements.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
            No movements found for the selected period and type.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Date</th>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Type</th>
                  <th>Qty</th>
                  <th>Warehouse</th>
                  <th>Reference</th>
                  <th>Notes</th>
                  <th>By</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m, i) => {
                  const mtype = m.type || m.transaction_type || '';
                  const qty = Number(m.qty || m.quantity_change || m.quantity || 0);
                  return (
                    <tr key={i}>
                      <td style={{ color: '#94a3b8', fontSize: 12 }}>{i + 1}</td>
                      <td style={{ whiteSpace: 'nowrap', fontSize: 13 }}>{m.date ? String(m.date).slice(0, 16).replace('T', ' ') : '-'}</td>
                      <td style={{ fontWeight: 500 }}>{m.product || m.product_name || '-'}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: 12, color: '#64748b' }}>{m.sku || '-'}</td>
                      <td>
                        <span style={{
                          background: typeColor[mtype] || '#e5e7eb',
                          color: typeColor[mtype] ? '#fff' : '#374151',
                          padding: '2px 8px', borderRadius: 4,
                          fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                        }}>
                          {mtype || '-'}
                        </span>
                      </td>
                      <td style={{ color: qtyColor(qty), fontWeight: 700, textAlign: 'right' }}>
                        {qty >= 0 ? '+' : ''}{qty}
                      </td>
                      <td style={{ fontSize: 12 }}>{m.warehouse || m.warehouse_name || '-'}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{m.reference || m.reference_number || '-'}</td>
                      <td style={{ fontSize: 12, color: '#64748b', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.notes || '-'}</td>
                      <td style={{ fontSize: 12 }}>{m.created_by || m.user || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default StockAdjustmentLog;
