import React, { useState, useEffect } from 'react';
import { barcodeAPI, productAPI } from '../services/api';
import './BarcodeLabelPrinter.css';

function BarcodeLabelPrinter() {
  const [products, setProducts] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [labels, setLabels] = useState([]);
  const [labelSize, setLabelSize] = useState('medium');
  const [loading, setLoading] = useState(false);
  const [columns, setColumns] = useState(3);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    productAPI.getAll({ limit: 500 })
      .then(res => setProducts(Array.isArray(res?.data) ? res.data : (res?.data?.products || [])))
      .catch(() => {});
  }, []);

  const toggleProduct = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const selectAll = () => {
    const filtered = getFilteredProducts();
    const allIds = filtered.map(p => p.id);
    setSelectedIds(allIds);
  };

  const clearSelection = () => setSelectedIds([]);

  const generateLabels = () => {
    if (selectedIds.length === 0) return;
    setLoading(true);
    barcodeAPI.productLabels(selectedIds.join(','), labelSize)
      .then(res => {
        setLabels(res.labels || []);
        setColumns(res.columns || 3);
        setLoading(false);
      })
      .catch(() => { setLoading(false); });
  };

  const printLabels = () => window.print();

  const getFilteredProducts = () => {
    if (!searchTerm) return products;
    const term = searchTerm.toLowerCase();
    return products.filter(p =>
      (p.name || '').toLowerCase().includes(term) ||
      (p.sku || '').toLowerCase().includes(term) ||
      (p.barcode || '').toLowerCase().includes(term)
    );
  };

  const filtered = getFilteredProducts();

  // ── Print View ──
  if (labels.length > 0) {
    return (
      <div>
        {/* Toolbar */}
        <div className="blp-toolbar no-print">
          <button onClick={printLabels} className="blp-btn-print">Print Labels</button>
          <button onClick={() => setLabels([])} className="blp-btn-back">Back to Selection</button>
          <span className="blp-toolbar-info">{labels.length} label(s) · {labelSize}</span>
        </div>

        {/* Label Grid — columns is dynamic so gridTemplateColumns stays inline */}
        <div className="blp-label-grid" style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
          {labels.map((label, idx) => (
            <div key={idx} className="blp-label-card">
              <div className="blp-label-name">{label.product_name}</div>
              <div dangerouslySetInnerHTML={{ __html: label.svg }} style={{ margin: '4px auto' }} />
              <div className="blp-label-footer">
                <span>{label.sku}</span>
                {label.price && <span className="blp-label-price">OMR {Number(label.price).toFixed(3)}</span>}
              </div>
            </div>
          ))}
        </div>

        {/* Print Styles */}
        <style>{`
          @media print {
            .no-print { display: none !important; }
            body { margin: 0 !important; }
            @page { size: A4; margin: 10mm; }
          }
        `}</style>
      </div>
    );
  }

  // ── Selection View ──
  return (
    <div className="blp-container">
      <h2 className="blp-title">Barcode Label Printer</h2>
      <p className="blp-subtitle">Select products → generate printable barcode stickers</p>

      {/* Controls */}
      <div className="blp-controls">
        <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
          placeholder="Search products..." className="blp-input" />

        <select value={labelSize} onChange={e => setLabelSize(e.target.value)} className="blp-select">
          <option value="small">Small (4 per row)</option>
          <option value="medium">Medium (3 per row)</option>
          <option value="large">Large (2 per row)</option>
        </select>

        <button onClick={selectAll} className="blp-btn blp-btn-select-all">Select All ({filtered.length})</button>
        <button onClick={clearSelection} className="blp-btn blp-btn-clear">Clear</button>

        <button onClick={generateLabels} disabled={selectedIds.length === 0 || loading}
          className="blp-btn blp-btn-generate">
          {loading ? 'Generating...' : `Generate ${selectedIds.length} Label(s)`}
        </button>
      </div>

      {/* Product Grid */}
      <div className="blp-product-grid">
        {filtered.map(p => {
          const selected = selectedIds.includes(p.id);
          return (
            <div key={p.id} onClick={() => toggleProduct(p.id)}
              className={`blp-product-card${selected ? ' selected' : ''}`}>
              <div className="blp-product-header">
                <span className="blp-product-name">{p.name}</span>
                <span className="blp-product-check">{selected ? '✓' : ''}</span>
              </div>
              <div className="blp-product-sku">SKU: {p.sku || '—'} · {p.barcode || 'No barcode'}</div>
              {p.selling_price && (
                <div className="blp-product-price">OMR {Number(p.selling_price).toFixed(3)}</div>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="blp-empty">No products found</div>
      )}
    </div>
  );
}

export default BarcodeLabelPrinter;
