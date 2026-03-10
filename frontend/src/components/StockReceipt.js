import React, { useState, useEffect } from 'react';
import { productAPI, inventoryAPI, warehouseAPI } from '../services/api';
import './StockReceipt.css';
import { PackagePlus } from 'lucide-react';

function StockReceipt() {
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [mode, setMode] = useState('single'); // 'single' or 'batch'
  const [formData, setFormData] = useState({ product_id: '', warehouse_id: '', quantity: '', batch_number: '', expiry_date: '', unit_cost: '', reference_number: '', notes: '' });
  const [batchItems, setBatchItems] = useState([]);
  const [batchRef, setBatchRef] = useState({ warehouse_id: '', reference_number: '', container_reference: '' });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [recentReceipts, setRecentReceipts] = useState([]);

  useEffect(() => { loadProducts(); loadWarehouses(); loadRecent(); }, []);

  const loadProducts = async () => {
    try { const res = await productAPI.getAll(); setProducts((res.data || []).filter(p => p.is_active)); }
    catch (e) { console.error('Failed to load products:', e); }
  };
  const loadWarehouses = async () => {
    try { const data = await warehouseAPI.list(); setWarehouses(data); if (data.length > 0 && !formData.warehouse_id) setFormData(p => ({...p, warehouse_id: data[0].id})); if (data.length > 0 && !batchRef.warehouse_id) setBatchRef(p => ({...p, warehouse_id: data[0].id})); }
    catch (e) { console.error('Failed to load warehouses:', e); }
  };
  const loadRecent = async () => {
    try { const movements = await inventoryAPI.getMovements({ limit: 10 }); setRecentReceipts(movements.filter(m => m.transaction_type === 'RECEIPT').slice(0, 5)); }
    catch (e) { console.error(e); }
  };

  const handleChange = (e) => { setFormData(p => ({ ...p, [e.target.name]: e.target.value })); };

  // Single receipt submit
  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true); setMessage({ text: '', type: '' });
    try {
      const result = await inventoryAPI.recordReceipt({
        product_id: parseInt(formData.product_id), warehouse_id: parseInt(formData.warehouse_id),
        quantity: parseFloat(formData.quantity), batch_number: formData.batch_number || null,
        expiry_date: formData.expiry_date || null, unit_cost: formData.unit_cost ? parseFloat(formData.unit_cost) : null,
        reference_number: formData.reference_number || null, notes: formData.notes || null
      });
      setMessage({ text: `Received ${result.quantity} × ${result.product_name}. New stock: ${result.new_stock_level}`, type: 'success' });
      setFormData(p => ({ ...p, product_id: '', quantity: '', batch_number: '', expiry_date: '', unit_cost: '', notes: '' }));
      loadRecent();
    } catch (error) {
      setMessage({ text: `${error.response?.data?.detail || error.message}`, type: 'error' });
    } finally { setLoading(false); }
  };

  // Batch mode: add item to list
  const addBatchItem = () => {
    if (!formData.product_id || !formData.quantity) return;
    const prod = products.find(p => p.id === parseInt(formData.product_id));
    setBatchItems(prev => [...prev, {
      product_id: parseInt(formData.product_id), product_name: prod?.name || '', quantity: parseFloat(formData.quantity),
      batch_number: formData.batch_number || null, expiry_date: formData.expiry_date || null,
      unit_cost: formData.unit_cost ? parseFloat(formData.unit_cost) : null
    }]);
    setFormData(p => ({ ...p, product_id: '', quantity: '', batch_number: '', expiry_date: '', unit_cost: '' }));
  };

  const removeBatchItem = (idx) => setBatchItems(prev => prev.filter((_, i) => i !== idx));

  // Submit entire batch
  const submitBatch = async () => {
    if (batchItems.length === 0) return;
    setLoading(true); setMessage({ text: '', type: '' });
    try {
      const result = await inventoryAPI.batchReceipt({
        warehouse_id: parseInt(batchRef.warehouse_id), reference_number: batchRef.reference_number || null,
        container_reference: batchRef.container_reference || null,
        items: batchItems.map(i => ({ product_id: i.product_id, quantity: i.quantity, batch_number: i.batch_number, expiry_date: i.expiry_date, unit_cost: i.unit_cost }))
      });
      setMessage({ text: `Container received! ${result.total_items_received} products, ${result.total_quantity} total units.`, type: 'success' });
      setBatchItems([]); loadRecent();
    } catch (error) {
      setMessage({ text: `${error.response?.data?.detail || error.message}`, type: 'error' });
    } finally { setLoading(false); }
  };

  return (
    <div className="stock-receipt-container">
      <div className="page-header">
        <div className="header-content">
          <div className="header-icon"><PackagePlus size={20} /></div>
          <div><h1>Stock Receipt</h1><p>Record goods received from suppliers</p></div>
        </div>
        <div className="mode-toggle">
          <button className={`toggle-btn ${mode === 'single' ? 'active' : ''}`} onClick={() => setMode('single')}>Single Item</button>
          <button className={`toggle-btn ${mode === 'batch' ? 'active' : ''}`} onClick={() => setMode('batch')}>Container / Batch</button>
        </div>
      </div>

      {message.text && <div className={`message ${message.type}`}>{message.text}</div>}

      <div className="receipt-content">
        <div className="receipt-form-section">
          <div className="section-badge">{mode === 'batch' ? 'Container Receiving' : 'Goods In'}</div>

          {mode === 'batch' && (
            <div className="batch-header-fields">
              <div className="form-row">
                <div className="form-group">
                  <label>Warehouse *</label>
                  <select value={batchRef.warehouse_id} onChange={e => setBatchRef(p => ({...p, warehouse_id: e.target.value}))}>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Container Reference</label>
                  <input type="text" value={batchRef.container_reference} onChange={e => setBatchRef(p => ({...p, container_reference: e.target.value}))} placeholder="CONT-2026-001" />
                </div>
                <div className="form-group">
                  <label>PO / Reference</label>
                  <input type="text" value={batchRef.reference_number} onChange={e => setBatchRef(p => ({...p, reference_number: e.target.value}))} placeholder="PO-2026-001" />
                </div>
              </div>
            </div>
          )}

          <form onSubmit={mode === 'single' ? handleSubmit : (e) => { e.preventDefault(); addBatchItem(); }} className="receipt-form">
            <div className="form-row">
              <div className="form-group">
                <label>Product *</label>
                <select name="product_id" value={formData.product_id} onChange={handleChange} required>
                  <option value="">Select product...</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                </select>
              </div>
              {mode === 'single' && (
                <div className="form-group">
                  <label>Warehouse *</label>
                  <select name="warehouse_id" value={formData.warehouse_id} onChange={handleChange} required>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className="form-row">
              <div className="form-group"><label>Quantity *</label><input type="number" name="quantity" value={formData.quantity} onChange={handleChange} min="0.01" step="0.01" required placeholder="100" /></div>
              <div className="form-group"><label>Unit Cost (OMR)</label><input type="number" name="unit_cost" value={formData.unit_cost} onChange={handleChange} min="0" step="0.001" placeholder="0.350" /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Batch Number</label><input type="text" name="batch_number" value={formData.batch_number} onChange={handleChange} placeholder="BATCH-2026-001" /></div>
              <div className="form-group"><label>Expiry Date</label><input type="date" name="expiry_date" value={formData.expiry_date} onChange={handleChange} /></div>
            </div>
            {mode === 'single' && (
              <>
                <div className="form-group full-width"><label>Reference (Container/PO)</label><input type="text" name="reference_number" value={formData.reference_number} onChange={handleChange} placeholder="CONTAINER-FEB-2026" /></div>
                <div className="form-group full-width"><label>Notes</label><textarea name="notes" value={formData.notes} onChange={handleChange} rows="2" placeholder="Notes..." /></div>
                <button type="submit" className="submit-btn" disabled={loading}>{loading ? 'Recording...' : 'Record Receipt'}</button>
              </>
            )}
            {mode === 'batch' && <button type="submit" className="submit-btn add-btn">Add to Batch</button>}
          </form>

          {mode === 'batch' && batchItems.length > 0 && (
            <div className="batch-items-list">
              <h3>Items in Batch ({batchItems.length})</h3>
              <table className="batch-table">
                <thead><tr><th>Product</th><th>Qty</th><th>Batch</th><th>Expiry</th><th>Cost</th><th></th></tr></thead>
                <tbody>
                  {batchItems.map((item, idx) => (
                    <tr key={idx}>
                      <td>{item.product_name}</td><td>{item.quantity}</td><td>{item.batch_number || '-'}</td>
                      <td>{item.expiry_date || '-'}</td><td>{item.unit_cost ? `${item.unit_cost} OMR` : '-'}</td>
                      <td><button className="remove-btn" onClick={() => removeBatchItem(idx)}>✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="batch-summary">
                <span>Total: {batchItems.reduce((s, i) => s + i.quantity, 0)} units</span>
                <button className="submit-btn" onClick={submitBatch} disabled={loading}>{loading ? 'Submitting...' : 'Receive Entire Batch'}</button>
              </div>
            </div>
          )}
        </div>

        <div className="recent-receipts-sidebar">
          <h3>Recent Receipts</h3>
          {recentReceipts.length === 0 ? <p className="no-data">No recent receipts</p> : (
            <div className="receipt-list">
              {recentReceipts.map((r, i) => (
                <div key={i} className="receipt-item">
                  <div className="receipt-header"><span className="receipt-product">{r.product_name}</span><span className="receipt-qty">+{r.quantity}</span></div>
                  <div className="receipt-details"><span>{r.reference_number || 'No ref'}</span><span>{new Date(r.date).toLocaleDateString()}</span></div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
export default StockReceipt;
