import React, { useState, useEffect, useCallback } from 'react';
import { inventoryAPI, warehouseAPI, productAPI } from '../services/api';
import { ArrowRightLeft, Plus, Trash2, Send, Package } from 'lucide-react';

export default function WarehouseTransfer() {
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [fromWh, setFromWh] = useState('');
  const [toWh, setToWh] = useState('');
  const [refNumber, setRefNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState([{ product_id: '', quantity: '' }]);
  const [comparison, setComparison] = useState(null);
  const [stockLevels, setStockLevels] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [results, setResults] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [wh, pr] = await Promise.all([warehouseAPI.list(), productAPI.getAll()]);
        setWarehouses(Array.isArray(wh) ? wh : (wh?.items || []));
        const pList = Array.isArray(pr?.data) ? pr.data : (Array.isArray(pr) ? pr : (pr?.items || []));
        setProducts(pList);
      } catch {}
    })();
  }, []);

  const loadComparison = useCallback(async () => {
    try {
      const data = await inventoryAPI.warehouseComparison();
      setComparison(data);
      // Build lookup: { productId: { whCode: qty } }
      const levels = {};
      (data.products || []).forEach(p => {
        levels[p.product_id] = {};
        Object.entries(p.warehouses || {}).forEach(([code, info]) => {
          levels[p.product_id][info.warehouse_id] = info.quantity;
        });
      });
      setStockLevels(levels);
    } catch {}
  }, []);

  useEffect(() => { loadComparison(); }, [loadComparison]);

  const addRow = () => setRows(r => [...r, { product_id: '', quantity: '' }]);
  const removeRow = (i) => setRows(r => r.filter((_, idx) => idx !== i));
  const updateRow = (i, field, val) => setRows(r => r.map((row, idx) => idx === i ? { ...row, [field]: val } : row));

  const getAvailable = (productId) => {
    if (!fromWh || !productId) return 0;
    return (stockLevels[parseInt(productId)] || {})[parseInt(fromWh)] || 0;
  };

  const handleTransfer = async () => {
    const items = rows.filter(r => r.product_id && parseFloat(r.quantity) > 0)
      .map(r => ({ product_id: parseInt(r.product_id), quantity: parseFloat(r.quantity) }));
    if (!fromWh || !toWh) { setMessage('Select source and destination warehouses'); return; }
    if (items.length === 0) { setMessage('Add at least one product to transfer'); return; }
    setLoading(true);
    setMessage('');
    try {
      const res = await inventoryAPI.batchTransfer({
        from_warehouse_id: parseInt(fromWh),
        to_warehouse_id: parseInt(toWh),
        reference_number: refNumber || undefined,
        notes: notes || undefined,
        items,
      });
      setResults(res);
      setMessage(res.message);
      setRows([{ product_id: '', quantity: '' }]);
      loadComparison();
    } catch (err) {
      setMessage('Transfer failed: ' + (err.response?.data?.detail || err.message));
    }
    setLoading(false);
  };

  const cardStyle = { background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', padding: 20, marginBottom: 20 };
  const inputStyle = { padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13 };
  const btnStyle = { padding: '8px 18px', background: '#1A7B5B', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 };

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <ArrowRightLeft size={28} color="#1A7B5B" />
        <h1 style={{ margin: 0, fontSize: 24, color: '#1a2332' }}>Warehouse Transfer</h1>
      </div>

      {message && (
        <div style={{ padding: '10px 16px', marginBottom: 16, borderRadius: 6, background: message.includes('fail') || message.includes('Select') || message.includes('Add at') ? '#fef2f2' : '#f0fdf4', color: message.includes('fail') || message.includes('Select') || message.includes('Add at') ? '#dc2626' : '#16a34a', fontSize: 13, fontWeight: 600 }}>
          {message}
        </div>
      )}

      {/* Transfer Form */}
      <div style={cardStyle}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16, color: '#1a2332' }}>New Transfer</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4, color: '#64748b' }}>FROM</label>
            <select value={fromWh} onChange={e => setFromWh(e.target.value)} style={{ ...inputStyle, minWidth: 200 }}>
              <option value="">Select source...</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
            </select>
          </div>
          <div style={{ fontSize: 24, color: '#94a3b8', paddingTop: 18 }}>&rarr;</div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4, color: '#64748b' }}>TO</label>
            <select value={toWh} onChange={e => setToWh(e.target.value)} style={{ ...inputStyle, minWidth: 200 }}>
              <option value="">Select destination...</option>
              {warehouses.filter(w => String(w.id) !== fromWh).map(w => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4, color: '#64748b' }}>Reference #</label>
            <input type="text" value={refNumber} onChange={e => setRefNumber(e.target.value)} placeholder="Auto-generated" style={{ ...inputStyle, width: 180 }} />
          </div>
        </div>

        {/* Transfer Items */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 16 }}>
          <thead>
            <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #e2e8f0' }}>
              <th style={{ padding: 8, textAlign: 'left' }}>Product</th>
              <th style={{ padding: 8, textAlign: 'right', width: 120 }}>Available</th>
              <th style={{ padding: 8, textAlign: 'right', width: 120 }}>Qty to Transfer</th>
              <th style={{ padding: 8, textAlign: 'center', width: 60 }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const avail = getAvailable(row.product_id);
              return (
                <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: 8 }}>
                    <select value={row.product_id} onChange={e => updateRow(i, 'product_id', e.target.value)} style={{ ...inputStyle, width: '100%' }}>
                      <option value="">Select product...</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                    </select>
                  </td>
                  <td style={{ padding: 8, textAlign: 'right', fontWeight: 600, color: avail > 0 ? '#16a34a' : '#dc2626' }}>
                    {avail.toFixed(3)}
                  </td>
                  <td style={{ padding: 8 }}>
                    <input type="number" step="0.001" min="0" max={avail} value={row.quantity}
                      onChange={e => updateRow(i, 'quantity', e.target.value)}
                      style={{ ...inputStyle, width: '100%', textAlign: 'right' }} placeholder="0.000" />
                  </td>
                  <td style={{ padding: 8, textAlign: 'center' }}>
                    {rows.length > 1 && (
                      <button onClick={() => removeRow(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <button onClick={addRow} style={{ ...btnStyle, background: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={14} /> Add Row
          </button>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4, color: '#64748b' }}>Notes</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
            style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', resize: 'vertical' }} placeholder="Transfer notes..." />
        </div>

        <button onClick={handleTransfer} disabled={loading}
          style={{ ...btnStyle, padding: '10px 28px', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8, opacity: loading ? 0.6 : 1 }}>
          <Send size={16} /> {loading ? 'Transferring...' : 'Execute Transfer'}
        </button>
      </div>

      {/* Transfer Results */}
      {results && results.items && (
        <div style={cardStyle}>
          <h3 style={{ margin: '0 0 12px', fontSize: 16, color: '#1a2332' }}>Transfer Results — {results.reference}</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: 8, textAlign: 'left' }}>Product</th>
                <th style={{ padding: 8, textAlign: 'right' }}>Quantity</th>
                <th style={{ padding: 8, textAlign: 'center' }}>Status</th>
                <th style={{ padding: 8, textAlign: 'left' }}>Message</th>
              </tr>
            </thead>
            <tbody>
              {results.items.map((item, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: 8, fontWeight: 500 }}>{item.product_name || `Product #${item.product_id}`}</td>
                  <td style={{ padding: 8, textAlign: 'right' }}>{item.quantity ? item.quantity.toFixed(3) : '--'}</td>
                  <td style={{ padding: 8, textAlign: 'center' }}>
                    <span style={{
                      padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                      background: item.status === 'transferred' ? '#dcfce7' : '#fef2f2',
                      color: item.status === 'transferred' ? '#16a34a' : '#dc2626',
                    }}>{item.status}</span>
                  </td>
                  <td style={{ padding: 8, color: '#64748b', fontSize: 12 }}>{item.message || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Stock Comparison Matrix */}
      {comparison && comparison.products && comparison.products.length > 0 && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Package size={18} color="#1A7B5B" />
            <h3 style={{ margin: 0, fontSize: 16, color: '#1a2332' }}>Stock Comparison Across Warehouses</h3>
            <span style={{ fontSize: 12, color: '#64748b', marginLeft: 8 }}>({comparison.total_products} products with stock)</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ padding: 8, textAlign: 'left', position: 'sticky', left: 0, background: '#f1f5f9', zIndex: 1 }}>Product</th>
                  <th style={{ padding: 8, textAlign: 'left' }}>SKU</th>
                  {comparison.warehouses.map(wh => (
                    <th key={wh.code} style={{ padding: 8, textAlign: 'right', whiteSpace: 'nowrap' }}>{wh.code}</th>
                  ))}
                  <th style={{ padding: 8, textAlign: 'right', fontWeight: 700 }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {comparison.products.map(p => (
                  <tr key={p.product_id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '6px 8px', fontWeight: 500, position: 'sticky', left: 0, background: '#fff', zIndex: 1 }}>{p.product_name}</td>
                    <td style={{ padding: '6px 8px', fontFamily: 'monospace', fontSize: 11, color: '#64748b' }}>{p.sku}</td>
                    {comparison.warehouses.map(wh => {
                      const qty = p.warehouses[wh.code]?.quantity || 0;
                      return (
                        <td key={wh.code} style={{ padding: '6px 8px', textAlign: 'right', color: qty > 0 ? '#1a2332' : '#cbd5e1', fontWeight: qty > 0 ? 600 : 400 }}>
                          {qty.toFixed(3)}
                        </td>
                      );
                    })}
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: '#1A7B5B' }}>{p.total_stock.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
