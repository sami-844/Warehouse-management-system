// Van Load Sheet — load products from warehouse onto driver vans
import React, { useState, useEffect } from 'react';
import { vanSalesAPI } from '../services/api';

const emptyRow = { product_id: '', quantity: '' };

function VanLoadSheet() {
  const [drivers, setDrivers] = useState([]);
  const [products, setProducts] = useState([]);
  const [driverId, setDriverId] = useState('');
  const [loadDate, setLoadDate] = useState(new Date().toISOString().split('T')[0]);
  const [items, setItems] = useState([{ ...emptyRow }]);
  const [notes, setNotes] = useState('');
  const [vanStock, setVanStock] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');
  const [results, setResults] = useState(null);

  useEffect(() => { loadInit(); }, []);

  const loadInit = async () => {
    try {
      setLoading(true);
      const [d, p] = await Promise.all([vanSalesAPI.drivers(), vanSalesAPI.productsList()]);
      setDrivers(Array.isArray(d) ? d : []);
      setProducts(Array.isArray(p) ? p : []);
    } catch (e) { setError('Failed to load data'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (driverId) loadVanStock();
    else setVanStock(null);
  }, [driverId]); // eslint-disable-line

  const loadVanStock = async () => {
    try {
      const data = await vanSalesAPI.vanStock(driverId);
      setVanStock(data);
    } catch (e) { setVanStock(null); }
  };

  const handleProductSelect = (idx, productId) => {
    const updated = [...items];
    const p = products.find(x => x.id === parseInt(productId));
    updated[idx] = { ...updated[idx], product_id: productId, _product: p };
    setItems(updated);
  };

  const handleQtyChange = (idx, val) => {
    const updated = [...items];
    updated[idx] = { ...updated[idx], quantity: val };
    setItems(updated);
  };

  const addRow = () => setItems([...items, { ...emptyRow }]);
  const removeRow = (idx) => { if (items.length > 1) setItems(items.filter((_, i) => i !== idx)); };

  const getProduct = (id) => products.find(x => x.id === parseInt(id));

  const totalItems = items.filter(i => i.product_id && parseFloat(i.quantity) > 0).length;
  const totalValue = items.reduce((sum, i) => {
    const p = getProduct(i.product_id);
    const qty = parseFloat(i.quantity) || 0;
    return sum + (qty * (p ? p.cost_price : 0));
  }, 0);

  const handleLoad = async () => {
    if (!driverId) return setError('Select a driver');
    const validItems = items
      .filter(i => i.product_id && parseFloat(i.quantity) > 0)
      .map(i => ({ product_id: parseInt(i.product_id), quantity: parseFloat(i.quantity) }));
    if (!validItems.length) return setError('Add at least one item with quantity');

    setSaving(true); setError(null); setSuccess(''); setResults(null);
    try {
      const res = await vanSalesAPI.loadVan({
        driver_id: parseInt(driverId), items: validItems, date: loadDate, notes
      });
      setSuccess(res.message || 'Van loaded successfully');
      setResults(res.items || []);
      setItems([{ ...emptyRow }]);
      setNotes('');
      loadVanStock();
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to load van');
    } finally { setSaving(false); }
  };

  const handleReturnAll = async () => {
    if (!driverId || !vanStock?.items?.length) return;
    if (!window.confirm('Return ALL unsold stock from this van to main warehouse?')) return;

    // Need an account_id — find latest open account for this driver
    setSaving(true); setError(null); setSuccess('');
    try {
      const accounts = await vanSalesAPI.list({ driver_id: driverId });
      const arr = Array.isArray(accounts) ? accounts : [];
      if (!arr.length) {
        setError('No route account found for this driver. Create a van sales entry first.');
        setSaving(false);
        return;
      }
      const latest = arr[0]; // sorted by date desc
      const res = await vanSalesAPI.returnUnsold(latest.id, {});
      setSuccess(res.message || 'Unsold stock returned');
      loadVanStock();
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to return unsold stock');
    } finally { setSaving(false); }
  };

  if (loading) return <div style={{ padding: 32, textAlign: 'center' }}>Loading...</div>;

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1100 }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1a2332' }}>Van Load Sheet</h2>
        <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 13 }}>
          Load products from main warehouse onto delivery vans
        </p>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b',
          padding: '10px 14px', borderRadius: 6, marginBottom: 16, fontSize: 13 }}>{error}</div>
      )}
      {success && (
        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', color: '#166534',
          padding: '10px 14px', borderRadius: 6, marginBottom: 16, fontSize: 13 }}>{success}</div>
      )}

      {/* Driver + Date selection */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Driver</label>
          <select className="search-input" value={driverId}
            onChange={e => setDriverId(e.target.value)}
            style={{ width: '100%', padding: '8px 10px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 13 }}>
            <option value="">-- Select Driver --</option>
            {drivers.map(d => <option key={d.id} value={d.id}>{d.name} ({d.role})</option>)}
          </select>
        </div>
        <div style={{ minWidth: 160 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Date</label>
          <input type="date" className="search-input" value={loadDate}
            onChange={e => setLoadDate(e.target.value)}
            style={{ padding: '8px 10px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 13 }} />
        </div>
      </div>

      {/* KPI Summary cards */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div className="wms-kpi-card" style={{ flex: 1, minWidth: 150, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '14px 18px' }}>
          <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>Items to Load</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#1a2332', marginTop: 4 }}>{totalItems}</div>
        </div>
        <div className="wms-kpi-card" style={{ flex: 1, minWidth: 150, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '14px 18px' }}>
          <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>Load Value (Cost)</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#1a2332', marginTop: 4 }}>{totalValue.toFixed(3)} OMR</div>
        </div>
        {vanStock?.van_warehouse && (
          <div className="wms-kpi-card" style={{ flex: 1, minWidth: 150, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '14px 18px' }}>
            <div style={{ fontSize: 11, color: '#1e40af', fontWeight: 600, textTransform: 'uppercase' }}>Current Van Stock</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#1e40af', marginTop: 4 }}>{vanStock.total_items} items</div>
            <div style={{ fontSize: 12, color: '#3b82f6' }}>{(vanStock.total_value || 0).toFixed(3)} OMR</div>
          </div>
        )}
      </div>

      {/* Current Van Stock table */}
      {vanStock?.items?.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
            Current Stock on {vanStock.van_warehouse?.name || 'Van'}
          </h3>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f1f5f9' }}>
                <th style={thStyle}>Product</th>
                <th style={thStyle}>SKU</th>
                <th style={thStyle}>Qty</th>
                <th style={thStyle}>Unit</th>
                <th style={thStyle}>Value (OMR)</th>
              </tr>
            </thead>
            <tbody>
              {vanStock.items.map((s, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={tdStyle}>{s.product_name}</td>
                  <td style={tdStyle}>{s.sku}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{s.quantity_on_hand.toFixed(3)}</td>
                  <td style={tdStyle}>{s.unit}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{s.stock_value.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 8 }}>
            <button onClick={handleReturnAll} disabled={saving}
              style={{ padding: '7px 16px', fontSize: 12, background: '#dc2626', color: '#fff',
                border: 'none', borderRadius: 4, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Processing...' : 'Return All Unsold to Warehouse'}
            </button>
          </div>
        </div>
      )}

      {/* Loading form */}
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Load Products</h3>
        <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#f1f5f9' }}>
              <th style={{ ...thStyle, width: '40%' }}>Product</th>
              <th style={thStyle}>Main WH Stock</th>
              <th style={{ ...thStyle, width: '15%' }}>Qty to Load</th>
              <th style={thStyle}>Unit</th>
              <th style={thStyle}>Cost Value</th>
              <th style={{ ...thStyle, width: 50 }}></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const p = getProduct(item.product_id);
              const qty = parseFloat(item.quantity) || 0;
              return (
                <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={tdStyle}>
                    <select value={item.product_id} onChange={e => handleProductSelect(idx, e.target.value)}
                      style={{ width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 12 }}>
                      <option value="">-- Select Product --</option>
                      {products.map(pr => <option key={pr.id} value={pr.id}>{pr.name} ({pr.sku})</option>)}
                    </select>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: '#6b7280' }}>
                    {p ? '--' : ''}
                  </td>
                  <td style={tdStyle}>
                    <input type="number" min="0" step="1" value={item.quantity}
                      onChange={e => handleQtyChange(idx, e.target.value)}
                      style={{ width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 12, textAlign: 'right' }} />
                  </td>
                  <td style={tdStyle}>{p?.unit || 'CTN'}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>
                    {(qty * (p?.cost_price || 0)).toFixed(3)}
                  </td>
                  <td style={tdStyle}>
                    {items.length > 1 && (
                      <button onClick={() => removeRow(idx)}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 16 }}>x</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <button onClick={addRow}
          style={{ marginTop: 8, padding: '6px 14px', fontSize: 12, background: '#f1f5f9',
            border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>
          + Add Row
        </button>
      </div>

      {/* Notes */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Notes</label>
        <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="Optional loading notes..."
          style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 13 }} />
      </div>

      {/* Load button */}
      <button onClick={handleLoad} disabled={saving || !driverId}
        style={{ padding: '10px 28px', fontSize: 14, fontWeight: 600, background: '#1A7B5B', color: '#fff',
          border: 'none', borderRadius: 6, cursor: 'pointer', opacity: (saving || !driverId) ? 0.6 : 1 }}>
        {saving ? 'Loading...' : 'Load Van'}
      </button>

      {/* Results */}
      {results && results.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Loading Results</h3>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f1f5f9' }}>
                <th style={thStyle}>Product</th>
                <th style={thStyle}>Qty</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Details</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #e5e7eb',
                  background: r.status === 'error' ? '#fef2f2' : '#f0fdf4' }}>
                  <td style={tdStyle}>{r.product_name || `ID: ${r.product_id}`}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{r.quantity?.toFixed(3) || '--'}</td>
                  <td style={tdStyle}>
                    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                      background: r.status === 'loaded' ? '#dcfce7' : '#fee2e2',
                      color: r.status === 'loaded' ? '#166534' : '#991b1b' }}>
                      {r.status}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, fontSize: 11, color: '#6b7280' }}>
                    {r.message || (r.main_stock_remaining !== undefined ? `WH remaining: ${r.main_stock_remaining.toFixed(3)}` : '')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const thStyle = { padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#374151', borderBottom: '2px solid #e5e7eb' };
const tdStyle = { padding: '7px 10px' };

export default VanLoadSheet;
