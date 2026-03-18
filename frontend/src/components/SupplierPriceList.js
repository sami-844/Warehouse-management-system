import React, { useState, useEffect, useCallback } from 'react';
import { supplierAPI, productAPI } from '../services/api';
import { Tag, Save, Plus, Check } from 'lucide-react';

export default function SupplierPriceList() {
  const [suppliers, setSuppliers] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [prices, setPrices] = useState([]);
  const [products, setProducts] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [addingNew, setAddingNew] = useState(false);
  const [newRow, setNewRow] = useState({ product_id: '', unit_price: '', min_order_qty: '1', lead_time_days: '7', notes: '' });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [s, p] = await Promise.all([supplierAPI.list(), productAPI.list()]);
        setSuppliers(Array.isArray(s) ? s : (s?.items || []));
        setProducts(Array.isArray(p) ? p : (p?.items || []));
      } catch {}
    })();
  }, []);

  const loadPrices = useCallback(async () => {
    if (!selectedSupplier) { setPrices([]); return; }
    setLoading(true);
    try {
      const d = await supplierAPI.priceList(selectedSupplier);
      setPrices(Array.isArray(d) ? d : []);
    } catch { setPrices([]); }
    setLoading(false);
  }, [selectedSupplier]);

  useEffect(() => { loadPrices(); }, [loadPrices]);

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditForm({ unit_price: item.unit_price.toFixed(3), min_order_qty: item.min_order_qty, lead_time_days: item.lead_time_days, notes: item.notes });
  };

  const saveEdit = async (item) => {
    try {
      await supplierAPI.upsertPrice(selectedSupplier, {
        product_id: item.product_id,
        unit_price: parseFloat(editForm.unit_price),
        min_order_qty: parseFloat(editForm.min_order_qty),
        lead_time_days: parseInt(editForm.lead_time_days),
        notes: editForm.notes,
      });
      setEditingId(null);
      setMessage('Price updated');
      loadPrices();
    } catch (err) { setMessage(err.response?.data?.detail || 'Error saving'); }
  };

  const saveNewRow = async () => {
    if (!newRow.product_id || !newRow.unit_price) return;
    try {
      await supplierAPI.upsertPrice(selectedSupplier, {
        product_id: parseInt(newRow.product_id),
        unit_price: parseFloat(newRow.unit_price),
        min_order_qty: parseFloat(newRow.min_order_qty || 1),
        lead_time_days: parseInt(newRow.lead_time_days || 7),
        notes: newRow.notes,
      });
      setAddingNew(false);
      setNewRow({ product_id: '', unit_price: '', min_order_qty: '1', lead_time_days: '7', notes: '' });
      setMessage('Price added');
      loadPrices();
    } catch (err) { setMessage(err.response?.data?.detail || 'Error adding'); }
  };

  const addAllProducts = async () => {
    const existingIds = new Set(prices.map(p => p.product_id));
    const missing = products.filter(p => !existingIds.has(p.id));
    if (missing.length === 0) { setMessage('All products already in the list'); return; }
    try {
      const items = missing.map(p => ({ product_id: p.id, unit_price: 0, min_order_qty: 1, lead_time_days: 7, notes: '' }));
      const res = await supplierAPI.bulkUpsertPrices(selectedSupplier, items);
      setMessage(`Added ${res.saved} products — fill in prices`);
      loadPrices();
    } catch (err) { setMessage(err.response?.data?.detail || 'Error adding products'); }
  };

  const cardStyle = { background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', padding: 20, marginBottom: 20 };
  const inputStyle = { padding: '4px 8px', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 12 };
  const btnStyle = { padding: '6px 14px', background: '#1A7B5B', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 };

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Tag size={28} color="#1A7B5B" />
        <h1 style={{ margin: 0, fontSize: 24, color: '#1a2332' }}>Supplier Price Lists</h1>
      </div>

      {message && (
        <div style={{ padding: '10px 16px', marginBottom: 16, borderRadius: 6, background: message.includes('Error') ? '#fef2f2' : '#f0fdf4', color: message.includes('Error') ? '#dc2626' : '#16a34a', fontSize: 13, fontWeight: 600 }}>
          {message}
        </div>
      )}

      {/* Supplier Selection */}
      <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, marginRight: 8 }}>Supplier:</label>
          <select style={{ ...inputStyle, minWidth: 250 }} value={selectedSupplier} onChange={e => setSelectedSupplier(e.target.value)}>
            <option value="">Select supplier...</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
          </select>
        </div>
        {selectedSupplier && (
          <>
            <button style={btnStyle} onClick={() => setAddingNew(true)}>
              <Plus size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />Add Price
            </button>
            <button style={{ ...btnStyle, background: '#7c3aed' }} onClick={addAllProducts}>
              Add All Products
            </button>
            <span style={{ fontSize: 12, color: '#64748b' }}>{prices.length} product(s) in list</span>
          </>
        )}
      </div>

      {/* Price Table */}
      {selectedSupplier && (
        <div style={cardStyle}>
          {loading ? (
            <p style={{ color: '#94a3b8', textAlign: 'center', padding: 24 }}>Loading...</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: 8, textAlign: 'left' }}>Product</th>
                    <th style={{ padding: 8, textAlign: 'left' }}>SKU</th>
                    <th style={{ padding: 8, textAlign: 'right' }}>Unit Price (OMR)</th>
                    <th style={{ padding: 8, textAlign: 'right' }}>Min Qty</th>
                    <th style={{ padding: 8, textAlign: 'center' }}>Lead Time</th>
                    <th style={{ padding: 8, textAlign: 'left' }}>Notes</th>
                    <th style={{ padding: 8, textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Add new row */}
                  {addingNew && (
                    <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f0fdf4' }}>
                      <td style={{ padding: 8 }} colSpan={2}>
                        <select style={{ ...inputStyle, width: '100%' }} value={newRow.product_id} onChange={e => setNewRow(r => ({ ...r, product_id: e.target.value }))}>
                          <option value="">Select product...</option>
                          {products.filter(p => !prices.some(pr => pr.product_id === p.id)).map(p => (
                            <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ padding: 8 }}><input type="number" step="0.001" style={{ ...inputStyle, width: 90, textAlign: 'right' }} value={newRow.unit_price} onChange={e => setNewRow(r => ({ ...r, unit_price: e.target.value }))} placeholder="0.000" /></td>
                      <td style={{ padding: 8 }}><input type="number" step="0.001" style={{ ...inputStyle, width: 60, textAlign: 'right' }} value={newRow.min_order_qty} onChange={e => setNewRow(r => ({ ...r, min_order_qty: e.target.value }))} /></td>
                      <td style={{ padding: 8, textAlign: 'center' }}><input type="number" style={{ ...inputStyle, width: 50, textAlign: 'center' }} value={newRow.lead_time_days} onChange={e => setNewRow(r => ({ ...r, lead_time_days: e.target.value }))} /></td>
                      <td style={{ padding: 8 }}><input type="text" style={{ ...inputStyle, width: '100%' }} value={newRow.notes} onChange={e => setNewRow(r => ({ ...r, notes: e.target.value }))} placeholder="Notes" /></td>
                      <td style={{ padding: 8, textAlign: 'center' }}>
                        <button style={{ ...btnStyle, padding: '4px 10px' }} onClick={saveNewRow}><Save size={13} /></button>
                        <button style={{ padding: '4px 10px', background: 'none', border: '1px solid #cbd5e1', borderRadius: 4, cursor: 'pointer', marginLeft: 4, fontSize: 12 }} onClick={() => setAddingNew(false)}>Cancel</button>
                      </td>
                    </tr>
                  )}
                  {prices.map(item => (
                    <tr key={item.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: 8, fontWeight: 500 }}>{item.product_name}</td>
                      <td style={{ padding: 8, fontFamily: 'monospace', fontSize: 11, color: '#64748b' }}>{item.sku}</td>
                      {editingId === item.id ? (
                        <>
                          <td style={{ padding: 8 }}><input type="number" step="0.001" style={{ ...inputStyle, width: 90, textAlign: 'right' }} value={editForm.unit_price} onChange={e => setEditForm(f => ({ ...f, unit_price: e.target.value }))} /></td>
                          <td style={{ padding: 8 }}><input type="number" step="0.001" style={{ ...inputStyle, width: 60, textAlign: 'right' }} value={editForm.min_order_qty} onChange={e => setEditForm(f => ({ ...f, min_order_qty: e.target.value }))} /></td>
                          <td style={{ padding: 8, textAlign: 'center' }}><input type="number" style={{ ...inputStyle, width: 50, textAlign: 'center' }} value={editForm.lead_time_days} onChange={e => setEditForm(f => ({ ...f, lead_time_days: e.target.value }))} /></td>
                          <td style={{ padding: 8 }}><input type="text" style={{ ...inputStyle, width: '100%' }} value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} /></td>
                          <td style={{ padding: 8, textAlign: 'center' }}>
                            <button style={{ ...btnStyle, padding: '4px 10px' }} onClick={() => saveEdit(item)}><Check size={13} /></button>
                            <button style={{ padding: '4px 10px', background: 'none', border: '1px solid #cbd5e1', borderRadius: 4, cursor: 'pointer', marginLeft: 4, fontSize: 12 }} onClick={() => setEditingId(null)}>Cancel</button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td style={{ padding: 8, textAlign: 'right', fontWeight: 600, color: item.unit_price > 0 ? '#1a2332' : '#dc2626' }}>{item.unit_price.toFixed(3)}</td>
                          <td style={{ padding: 8, textAlign: 'right' }}>{item.min_order_qty}</td>
                          <td style={{ padding: 8, textAlign: 'center' }}>{item.lead_time_days}d</td>
                          <td style={{ padding: 8, color: '#64748b' }}>{item.notes || '—'}</td>
                          <td style={{ padding: 8, textAlign: 'center' }}>
                            <button style={{ padding: '4px 10px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600 }} onClick={() => startEdit(item)}>Edit</button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                  {prices.length === 0 && !addingNew && (
                    <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>No prices configured for this supplier</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
