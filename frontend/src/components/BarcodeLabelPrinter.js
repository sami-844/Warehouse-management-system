import React, { useState, useEffect } from 'react';
import { barcodeAPI, productAPI } from '../services/api';

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
        <div className="no-print" style={{ padding: '12px 20px', background: '#1a1a2e', display: 'flex', gap: 10, position: 'sticky', top: 0, zIndex: 10 }}>
          <button onClick={printLabels} style={btnPrint}>Print Labels</button>
          <button onClick={() => setLabels([])} style={btnClose}>← Back to Selection</button>
          <span style={{ color: '#aaa', fontSize: 13, alignSelf: 'center' }}>{labels.length} label(s) · {labelSize}</span>
        </div>

        {/* Label Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gap: '12px',
          padding: '20px',
          maxWidth: '210mm',
          margin: '0 auto',
        }}>
          {labels.map((label, idx) => (
            <div key={idx} style={{
              border: '1px dashed #ccc', borderRadius: 8, padding: 12, textAlign: 'center',
              background: '#fff', pageBreakInside: 'avoid',
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {label.product_name}
              </div>
              <div dangerouslySetInnerHTML={{ __html: label.svg }} style={{ margin: '4px auto' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#666', marginTop: 4 }}>
                <span>{label.sku}</span>
                {label.price && <span style={{ fontWeight: 700 }}>OMR {Number(label.price).toFixed(3)}</span>}
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
    <div style={{ padding: '20px 24px', maxWidth: 900, margin: '0 auto' }}>
      <h2 style={{ color: '#0d7a3e', marginBottom: 4 }}>Barcode Label Printer</h2>
      <p style={{ color: '#666', fontSize: 13, marginBottom: 20 }}>Select products → generate printable barcode stickers</p>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
          placeholder="Search products..." style={inputStyle} />

        <select value={labelSize} onChange={e => setLabelSize(e.target.value)} style={selectStyle}>
          <option value="small">Small (4 per row)</option>
          <option value="medium">Medium (3 per row)</option>
          <option value="large">Large (2 per row)</option>
        </select>

        <button onClick={selectAll} style={{ ...btnGen, background: '#3498db' }}>Select All ({filtered.length})</button>
        <button onClick={clearSelection} style={{ ...btnGen, background: '#888' }}>Clear</button>

        <button onClick={generateLabels} disabled={selectedIds.length === 0 || loading}
          style={{ ...btnGen, background: '#0d7a3e', opacity: selectedIds.length > 0 ? 1 : 0.5, marginLeft: 'auto' }}>
          {loading ? 'Generating...' : `Generate ${selectedIds.length} Label(s)`}
        </button>
      </div>

      {/* Product Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
        {filtered.map(p => {
          const selected = selectedIds.includes(p.id);
          return (
            <div key={p.id} onClick={() => toggleProduct(p.id)} style={{
              border: selected ? '2px solid #0d7a3e' : '1px solid #e5e5e5',
              borderRadius: 8, padding: '10px 12px', cursor: 'pointer',
              background: selected ? '#f0f8f4' : '#fff',
              transition: 'all 0.15s',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{p.name}</span>
                <span style={{ fontSize: 18 }}>{selected ? '✓' : ''}</span>
              </div>
              <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                SKU: {p.sku || '—'} · {p.barcode || 'No barcode'}
              </div>
              {p.selling_price && (
                <div style={{ fontSize: 12, fontWeight: 700, color: '#0d7a3e', marginTop: 2 }}>
                  OMR {Number(p.selling_price).toFixed(3)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: 30, color: '#888' }}>No products found</div>
      )}
    </div>
  );
}

const inputStyle = { padding: '8px 14px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13, minWidth: 200 };
const selectStyle = { padding: '8px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13 };
const btnGen = { color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const btnPrint = { background: '#0d7a3e', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer' };
const btnClose = { background: '#666', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 6, cursor: 'pointer' };

export default BarcodeLabelPrinter;
