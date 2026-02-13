import React, { useState, useEffect } from 'react';
import { productAPI, inventoryAPI, warehouseAPI } from '../services/api';
import './StockIssue.css';

function StockIssue() {
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [currentStock, setCurrentStock] = useState(null);
  const [formData, setFormData] = useState({ product_id: '', warehouse_id: '', quantity: '', customer_name: '', reference_number: '', notes: '' });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [recentIssues, setRecentIssues] = useState([]);

  useEffect(() => { loadProducts(); loadWarehouses(); loadRecent(); }, []);
  useEffect(() => { if (formData.product_id && formData.warehouse_id) checkStock(); else setCurrentStock(null); }, [formData.product_id, formData.warehouse_id]);

  const loadProducts = async () => { try { const res = await productAPI.getAll(); setProducts((res.data || []).filter(p => p.is_active)); } catch(e) { console.error(e); } };
  const loadWarehouses = async () => { try { const data = await warehouseAPI.list(); setWarehouses(data); if (data.length > 0 && !formData.warehouse_id) setFormData(p => ({...p, warehouse_id: data[0].id})); } catch(e) { console.error(e); } };
  const loadRecent = async () => { try { const m = await inventoryAPI.getMovements({ limit: 10 }); setRecentIssues(m.filter(x => x.transaction_type === 'ISSUE').slice(0, 5)); } catch(e) {} };
  const checkStock = async () => {
    try {
      const levels = await inventoryAPI.getStockLevels({ product_id: formData.product_id, warehouse_id: formData.warehouse_id });
      setCurrentStock(levels.length > 0 ? levels[0].quantity_on_hand : 0);
    } catch(e) { setCurrentStock(0); }
  };

  const handleChange = (e) => setFormData(p => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true); setMessage({ text: '', type: '' });
    const qty = parseFloat(formData.quantity);
    if (currentStock !== null && qty > currentStock) {
      setMessage({ text: `❌ Insufficient stock! Available: ${currentStock}, Requested: ${qty}`, type: 'error' }); setLoading(false); return;
    }
    try {
      const result = await inventoryAPI.recordIssue({
        product_id: parseInt(formData.product_id), warehouse_id: parseInt(formData.warehouse_id),
        quantity: qty, customer_name: formData.customer_name || null,
        reference_number: formData.reference_number || null, notes: formData.notes || null
      });
      setMessage({ text: `✅ Issued ${result.quantity_issued} × ${result.product_name}. Remaining: ${result.remaining_stock}`, type: 'success' });
      setFormData(p => ({ ...p, product_id: '', quantity: '', customer_name: '', reference_number: '', notes: '' }));
      setCurrentStock(null); loadRecent();
    } catch (error) { setMessage({ text: `❌ ${error.response?.data?.detail || error.message}`, type: 'error' }); }
    finally { setLoading(false); }
  };

  return (
    <div className="stock-issue-container">
      <div className="page-header"><div className="header-content"><div className="header-icon issue">📤</div><div><h1>Stock Issue</h1><p>Process deliveries and stock out</p></div></div></div>
      {message.text && <div className={`message ${message.type}`}>{message.text}</div>}
      <div className="issue-content">
        <div className="issue-form-section">
          <div className="section-badge issue">Goods Out</div>
          <form onSubmit={handleSubmit} className="issue-form">
            <div className="form-row">
              <div className="form-group"><label>Product *</label>
                <select name="product_id" value={formData.product_id} onChange={handleChange} required>
                  <option value="">Select product...</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                </select>
              </div>
              <div className="form-group"><label>Warehouse *</label>
                <select name="warehouse_id" value={formData.warehouse_id} onChange={handleChange} required>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
            </div>
            {currentStock !== null && (
              <div className={`stock-indicator ${currentStock === 0 ? 'danger' : currentStock < 20 ? 'warning' : 'ok'}`}>
                <span className="stock-label">Available Stock:</span>
                <span className="stock-value">{currentStock} units</span>
              </div>
            )}
            <div className="form-row">
              <div className="form-group"><label>Quantity *</label><input type="number" name="quantity" value={formData.quantity} onChange={handleChange} min="0.01" step="0.01" max={currentStock || undefined} required placeholder="25" /></div>
              <div className="form-group"><label>Customer / Shop Name</label><input type="text" name="customer_name" value={formData.customer_name} onChange={handleChange} placeholder="Al Wadi Grocery" /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Reference (SO / Delivery)</label><input type="text" name="reference_number" value={formData.reference_number} onChange={handleChange} placeholder="SO-2026-001" /></div>
              <div className="form-group"><label>Notes</label><input type="text" name="notes" value={formData.notes} onChange={handleChange} placeholder="Van 1, Driver Ali..." /></div>
            </div>
            <button type="submit" className="submit-btn issue" disabled={loading || !formData.product_id}>{loading ? '⏳ Processing...' : '📤 Issue Stock'}</button>
          </form>
        </div>
        <div className="recent-issues-sidebar">
          <h3>Recent Issues</h3>
          {recentIssues.length === 0 ? <p className="no-data">No recent issues</p> : (
            <div className="issue-list">
              {recentIssues.map((r, i) => (
                <div key={i} className="issue-item">
                  <div className="issue-header"><span className="issue-product">{r.product_name}</span><span className="issue-qty">-{r.quantity}</span></div>
                  <div className="issue-details"><span>{r.notes || r.reference_number || 'No ref'}</span><span>{new Date(r.date).toLocaleDateString()}</span></div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
export default StockIssue;
