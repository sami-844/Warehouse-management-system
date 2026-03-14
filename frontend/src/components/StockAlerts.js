import LoadingSpinner from './LoadingSpinner';
import EmptyState from './EmptyState';
import React, { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

function StockAlerts() {
  const [alerts, setAlerts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState([]);
  const [quantities, setQuantities] = useState({});
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState({ text: '', type: '' });

  useEffect(() => { loadAlerts(); }, []);

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/alerts/stock', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      setAlerts(data);
      const qtys = {};
      [...(data.out_of_stock || []), ...(data.critical || []), ...(data.low || [])].forEach(p => {
        qtys[p.id] = p.suggested_order;
      });
      setQuantities(qtys);
    } catch (err) {
      setMessage({ text: 'Failed to load stock alerts', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const selectAll = () => {
    if (!alerts) return;
    const all = [
      ...(alerts.out_of_stock || []),
      ...(alerts.critical || []),
      ...(alerts.low || [])
    ].map(p => p.id);
    setSelected(selected.length === all.length ? [] : all);
  };

  const createPOs = async () => {
    if (selected.length === 0) return;
    setCreating(true);
    try {
      const res = await fetch('/api/alerts/auto-reorder', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ product_ids: selected, quantities })
      });
      const data = await res.json();
      setResult(data);
      setSelected([]);
      setMessage({ text: data.message || 'Purchase orders created', type: 'success' });
    } catch (err) {
      setMessage({ text: 'Failed to create purchase orders', type: 'error' });
    } finally {
      setCreating(false);
    }
  };

  const AlertSection = ({ title, color, bg, items }) => {
    if (!items || items.length === 0) return null;
    return (
      <div style={{ marginBottom: 24 }}>
        <div style={{
          background: bg, color: color,
          padding: '10px 16px', borderRadius: '6px 6px 0 0',
          fontWeight: 700, fontSize: 14,
          display: 'flex', alignItems: 'center', gap: 8
        }}>
          {title} ({items.length})
        </div>
        <div style={{
          border: `1px solid ${color}`, borderTop: 'none',
          borderRadius: '0 0 6px 6px', overflow: 'hidden'
        }}>
          {items.map((item, i) => (
            <div key={item.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 16px',
              background: i % 2 === 0 ? '#FFFFFF' : '#FAFAFA',
              borderBottom: i < items.length - 1 ? '1px solid #F0F0F0' : 'none',
              flexWrap: 'wrap'
            }}>
              <input
                type="checkbox"
                checked={selected.includes(item.id)}
                onChange={() => toggleSelect(item.id)}
                style={{ width: 16, height: 16, cursor: 'pointer' }}
              />
              <div style={{ minWidth: 80, fontSize: 12, color: '#6C757D', fontFamily: 'monospace' }}>
                {item.sku || '-'}
              </div>
              <div style={{ flex: 1, fontWeight: 500, minWidth: 120 }}>{item.name}</div>
              <div style={{ minWidth: 100, textAlign: 'right' }}>
                <span style={{ color, fontWeight: 700 }}>
                  {item.current_stock.toFixed(3)}
                </span>
                {item.reorder_level > 0 && (
                  <div style={{ fontSize: 11, color: '#6C757D' }}>
                    Reorder at: {item.reorder_level.toFixed(3)}
                  </div>
                )}
              </div>
              <div style={{ minWidth: 140, fontSize: 12, color: '#6C757D' }}>
                {item.supplier_name}
              </div>
              <div style={{ minWidth: 120 }}>
                <input
                  type="number"
                  step="0.001"
                  style={{ padding: '4px 8px', fontSize: 12, textAlign: 'right', width: '100%', border: '1px solid #DEE2E6', borderRadius: 4 }}
                  value={quantities[item.id] || ''}
                  onChange={e => setQuantities(prev => ({
                    ...prev, [item.id]: e.target.value
                  }))}
                  placeholder="Qty to order"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: '24px 32px' }}>
      <div className="page-header">
        <div className="header-content">
          <div className="header-icon"><AlertTriangle size={20} /></div>
          <div>
            <h1>Stock Alerts</h1>
            <p>{alerts ? (alerts.total_alerts === 0 ? 'All products are at healthy stock levels' : `${alerts.total_alerts} product(s) need attention`) : 'Loading...'}</p>
          </div>
        </div>
      </div>

      {message.text && <div className={`message ${message.type}`}>{message.text}</div>}

      {loading ? <LoadingSpinner /> : (
        <>
          {/* Success result */}
          {result && (
            <div style={{
              background: '#F0FFF4', border: '1px solid #C3E6CB',
              borderRadius: 8, padding: 16, marginBottom: 24
            }}>
              <div style={{ fontWeight: 700, color: '#28A745', marginBottom: 8 }}>
                {result.message}
              </div>
              {result.purchase_orders?.map(po => (
                <div key={po.po_id} style={{ fontSize: 13, marginTop: 4 }}>
                  {po.po_number} -- {po.supplier} -- {po.items} items -- {po.total.toFixed(3)} OMR
                </div>
              ))}
              <button
                className="submit-btn"
                style={{ marginTop: 12, fontSize: 12 }}
                onClick={() => { setResult(null); loadAlerts(); }}
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Summary cards */}
          {alerts && alerts.total_alerts > 0 && (
            <>
              <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
                {[
                  { label: 'Out of Stock', count: alerts.summary?.out_of_stock_count || 0, color: '#DC3545', bg: '#FFEBEE' },
                  { label: 'Critical', count: alerts.summary?.critical_count || 0, color: '#E65100', bg: '#FFF3E0' },
                  { label: 'Low Stock', count: alerts.summary?.low_count || 0, color: '#F57F17', bg: '#FFFDE7' },
                ].map(card => (
                  <div key={card.label} style={{
                    background: card.bg, border: `1px solid ${card.color}`,
                    borderRadius: 8, padding: '12px 20px', flex: 1, textAlign: 'center'
                  }}>
                    <div style={{ fontSize: 28, fontWeight: 700, color: card.color }}>{card.count}</div>
                    <div style={{ fontSize: 12, color: card.color, fontWeight: 600 }}>{card.label}</div>
                  </div>
                ))}
              </div>

              {/* Action bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={selected.length === alerts.total_alerts && alerts.total_alerts > 0}
                    onChange={selectAll}
                  />
                  Select all for auto-reorder
                </label>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="cancel-btn" onClick={loadAlerts}>Refresh</button>
                  {selected.length > 0 && (
                    <button
                      className="submit-btn"
                      onClick={createPOs}
                      disabled={creating}
                    >
                      {creating ? 'Creating...' : `Create PO for ${selected.length} product(s)`}
                    </button>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Alert sections */}
          <AlertSection title="Out of Stock" color="#DC3545" bg="#FFEBEE" items={alerts?.out_of_stock} />
          <AlertSection title="Critical -- Below Minimum" color="#E65100" bg="#FFF3E0" items={alerts?.critical} />
          <AlertSection title="Low Stock -- Below Reorder Level" color="#F57F17" bg="#FFFDE7" items={alerts?.low} />

          {/* All good state */}
          {alerts && alerts.total_alerts === 0 && (
            <EmptyState title="All products are well stocked" hint="No products are at or below their reorder level" />
          )}
        </>
      )}
    </div>
  );
}

export default StockAlerts;
