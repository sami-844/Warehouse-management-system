import React, { useState, useEffect } from 'react';
import { inventoryAPI, warehouseAPI } from '../services/api';
import './StockTake.css';
import { ClipboardList } from 'lucide-react';

function StockTake() {
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [products, setProducts] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState({ text: '', type: '' });

  useEffect(() => { loadWarehouses(); }, []);

  const loadWarehouses = async () => { try { setWarehouses(await warehouseAPI.list()); } catch(e) { console.error(e); } };

  const loadProducts = async (whId) => {
    setLoading(true); setResult(null); setMessage({ text: '', type: '' });
    try {
      const data = await inventoryAPI.getProductsForStocktake(whId);
      setProducts(data);
      const initial = {};
      data.forEach(p => { initial[p.product_id] = ''; });
      setCounts(initial);
    } catch(e) { console.error(e); } finally { setLoading(false); }
  };

  const handleWarehouseChange = (e) => {
    const id = e.target.value; setSelectedWarehouse(id);
    if (id) loadProducts(id);
    else { setProducts([]); setCounts({}); }
  };

  const handleCountChange = (productId, value) => setCounts(prev => ({ ...prev, [productId]: value }));

  const getCountedItems = () => products.filter(p => counts[p.product_id] !== '' && counts[p.product_id] !== undefined);
  const getDifferences = () => getCountedItems().filter(p => parseFloat(counts[p.product_id]) !== p.system_quantity);

  const handleSubmit = async () => {
    const items = getCountedItems();
    if (items.length === 0) { setMessage({ text: 'Enter at least one count before submitting.', type: 'error' }); return; }
    setSubmitting(true); setMessage({ text: '', type: '' });
    try {
      const res = await inventoryAPI.recordStockTake({
        warehouse_id: parseInt(selectedWarehouse),
        items: items.map(p => ({ product_id: p.product_id, counted_quantity: parseFloat(counts[p.product_id]) }))
      });
      setResult(res);
      setMessage({ text: `Stock take complete! ${res.adjustments_made} adjustments made out of ${res.total_counted} items counted.`, type: 'success' });
    } catch(e) { setMessage({ text: `${e.response?.data?.detail || e.message}`, type: 'error' }); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="stocktake-container">
      <div className="page-header"><div className="header-content"><div className="header-icon take"><ClipboardList size={20} /></div><div><h1>Stock Take</h1><p>Physical count and auto-adjustment</p></div></div></div>

      <div className="stocktake-controls">
        <div className="form-group"><label>Select Warehouse *</label>
          <select value={selectedWarehouse} onChange={handleWarehouseChange}>
            <option value="">Choose warehouse...</option>
            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
        {products.length > 0 && (
          <div className="count-summary">
            <span>{products.length} products</span>
            <span>{getCountedItems().length} counted</span>
            <span className={getDifferences().length > 0 ? 'has-diff' : ''}>{getDifferences().length} differences</span>
          </div>
        )}
      </div>

      {message.text && <div className={`message ${message.type}`}>{message.text}</div>}
      {loading && <div className="loading-state">Loading products...</div>}

      {products.length > 0 && !result && (
        <>
          <div className="stocktake-table-container">
            <table className="stocktake-table">
              <thead><tr><th>Product</th><th>SKU</th><th>System Qty</th><th>Counted Qty</th><th>Difference</th></tr></thead>
              <tbody>
                {products.map(p => {
                  const counted = counts[p.product_id];
                  const diff = counted !== '' ? (parseFloat(counted) - p.system_quantity) : null;
                  return (
                    <tr key={p.product_id} className={diff !== null && diff !== 0 ? 'has-difference' : ''}>
                      <td>{p.product_name}</td><td className="sku">{p.sku}</td><td className="sys-qty">{p.system_quantity}</td>
                      <td><input type="number" className="count-input" value={counts[p.product_id]} onChange={e => handleCountChange(p.product_id, e.target.value)} min="0" step="1" placeholder="Count..." /></td>
                      <td className={`diff ${diff > 0 ? 'positive' : diff < 0 ? 'negative' : ''}`}>{diff !== null ? (diff > 0 ? `+${diff}` : diff) : '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="stocktake-actions">
            <button className="submit-btn" onClick={handleSubmit} disabled={submitting || getCountedItems().length === 0}>
              {submitting ? 'Saving...' : `Submit Stock Take (${getCountedItems().length} items)`}
            </button>
          </div>
        </>
      )}

      {result && (
        <div className="stocktake-results">
          <h3>Stock Take Results — {result.warehouse}</h3>
          <div className="result-stats">
            <div className="stat">Total Counted: <strong>{result.total_counted}</strong></div>
            <div className="stat">Adjustments: <strong>{result.adjustments_made}</strong></div>
            <div className="stat">Matches: <strong>{result.total_counted - result.adjustments_made}</strong></div>
          </div>
          <table className="result-table">
            <thead><tr><th>Product</th><th>System</th><th>Counted</th><th>Difference</th><th>Status</th></tr></thead>
            <tbody>
              {result.items.map((r, i) => (
                <tr key={i} className={r.adjusted ? 'adjusted' : 'match'}>
                  <td>{r.product_name}</td><td>{r.system_quantity}</td><td>{r.counted_quantity}</td>
                  <td className={r.difference > 0 ? 'positive' : r.difference < 0 ? 'negative' : ''}>{r.difference > 0 ? '+' : ''}{r.difference}</td>
                  <td>{r.adjusted ? 'Adjusted' : 'Match'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="submit-btn" onClick={() => { setResult(null); loadProducts(selectedWarehouse); }}>New Stock Take</button>
        </div>
      )}
    </div>
  );
}
export default StockTake;
