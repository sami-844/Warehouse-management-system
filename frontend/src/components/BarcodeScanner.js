import React, { useState, useRef, useEffect } from 'react';
import { productAPI, inventoryAPI } from '../services/api';
import './BarcodeScanner.css';

function BarcodeScanner() {
  const [barcode, setBarcode] = useState('');
  const [product, setProduct] = useState(null);
  const [stockInfo, setStockInfo] = useState([]);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [scanHistory, setScanHistory] = useState([]);
  const inputRef = useRef(null);

  useEffect(() => { if (inputRef.current) inputRef.current.focus(); }, []);

  const handleScan = async (e) => {
    if (e.key === 'Enter' && barcode.trim()) {
      await lookupBarcode(barcode.trim());
    }
  };

  const lookupBarcode = async (code) => {
    setLoading(true); setError(''); setProduct(null); setStockInfo([]); setHistory([]);
    try {
      const res = await productAPI.getByBarcode(code);
      const prod = res.data;
      setProduct(prod);

      // Get stock levels
      const stocks = await inventoryAPI.getStockLevels({ product_id: prod.id });
      setStockInfo(stocks);

      // Get recent history
      const hist = await inventoryAPI.getProductHistory(prod.id);
      setHistory(hist.transactions?.slice(0, 5) || []);

      setScanHistory(prev => [{ barcode: code, product: prod.name, time: new Date().toLocaleTimeString() }, ...prev.slice(0, 9)]);
    } catch (err) {
      if (err.response?.status === 404) setError(`No product found for barcode: ${code}`);
      else setError(`Error: ${err.message}`);
    } finally { setLoading(false); setBarcode(''); if (inputRef.current) inputRef.current.focus(); }
  };

  const totalStock = stockInfo.reduce((s, i) => s + i.quantity_on_hand, 0);

  return (
    <div className="barcode-container">
      <div className="page-header"><div className="header-content"><div className="header-icon scanner">🔍</div><div><h1>Barcode Scanner</h1><p>Scan or type barcode for instant product lookup</p></div></div></div>

      <div className="scan-section">
        <div className="scan-input-wrapper">
          <span className="scan-icon">📷</span>
          <input ref={inputRef} type="text" className="scan-input" value={barcode} onChange={e => setBarcode(e.target.value)} onKeyDown={handleScan}
            placeholder="Scan barcode or type and press Enter..." autoFocus />
          <button className="scan-btn" onClick={() => lookupBarcode(barcode.trim())} disabled={!barcode.trim()}>Search</button>
        </div>
        <p className="scan-hint">USB barcode scanners will auto-submit. You can also type the barcode manually.</p>
      </div>

      {loading && <div className="loading-state">🔍 Looking up product...</div>}
      {error && <div className="message error">{error}</div>}

      {product && (
        <div className="product-result">
          <div className="result-grid">
            <div className="product-info-card">
              <h2>{product.name}</h2>
              <div className="product-details-grid">
                <div className="detail"><span className="label">SKU</span><span className="value">{product.sku}</span></div>
                <div className="detail"><span className="label">Barcode</span><span className="value">{product.barcode}</span></div>
                <div className="detail"><span className="label">Category</span><span className="value">{product.category?.name || 'N/A'}</span></div>
                <div className="detail"><span className="label">Unit</span><span className="value">{product.unit_of_measure}</span></div>
                <div className="detail"><span className="label">Cost</span><span className="value">{product.standard_cost} OMR</span></div>
                <div className="detail"><span className="label">Price</span><span className="value">{product.selling_price} OMR</span></div>
                <div className="detail"><span className="label">Reorder Level</span><span className="value">{product.reorder_level}</span></div>
              </div>
            </div>

            <div className="stock-info-card">
              <h3>Stock Status</h3>
              <div className={`total-stock ${totalStock === 0 ? 'danger' : totalStock < (product.reorder_level || 10) ? 'warning' : 'ok'}`}>
                <div className="big-number">{totalStock}</div>
                <div className="big-label">Total Stock</div>
              </div>
              {stockInfo.length > 0 && (
                <div className="stock-by-location">
                  {stockInfo.map((s, i) => (
                    <div key={i} className="location-row">
                      <span>{s.warehouse_name}</span>
                      <span className="qty">{s.quantity_on_hand} {product.unit_of_measure}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {history.length > 0 && (
            <div className="history-section">
              <h3>Recent Movements</h3>
              <table className="history-table">
                <thead><tr><th>Date</th><th>Type</th><th>Qty</th><th>Warehouse</th><th>Reference</th></tr></thead>
                <tbody>
                  {history.map((h, i) => (
                    <tr key={i}><td>{new Date(h.date).toLocaleDateString()}</td><td><span className={`type-badge ${h.type}`}>{h.type}</span></td>
                      <td className={h.type === 'ISSUE' ? 'negative' : 'positive'}>{h.type === 'ISSUE' ? '-' : '+'}{h.quantity}</td>
                      <td>{h.warehouse}</td><td>{h.reference || '-'}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {scanHistory.length > 0 && (
        <div className="scan-history"><h3>Scan History</h3>
          {scanHistory.map((s, i) => <div key={i} className="scan-entry"><span className="scan-time">{s.time}</span><span className="scan-product">{s.product}</span><span className="scan-code">{s.barcode}</span></div>)}
        </div>
      )}
    </div>
  );
}
export default BarcodeScanner;
