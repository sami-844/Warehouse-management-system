// Van Sales Entry — daily driver route accounting sheet
import React, { useState, useEffect, useRef } from 'react';
import EmptyState from './EmptyState';
import { vanSalesAPI } from '../services/api';

const emptyItem = { product_id: '', product_name: '', unit: 'CTN', quantity: '', sell_price: '', purchase_price: '' };

function VanSalesEntry() {
  const [drivers, setDrivers] = useState([]);
  const [products, setProducts] = useState([]);
  const [driverId, setDriverId] = useState('');
  const [sheetDate, setSheetDate] = useState(new Date().toISOString().split('T')[0]);
  const [items, setItems] = useState([{ ...emptyItem }]);
  const [collection, setCollection] = useState('');
  const [petrol, setPetrol] = useState('');
  const [others, setOthers] = useState('');
  const [discounts, setDiscounts] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const printRef = useRef();

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

  // Load history when driver changes
  useEffect(() => {
    if (driverId) loadHistory();
  }, [driverId]); // eslint-disable-line

  const loadHistory = async () => {
    try {
      const h = await vanSalesAPI.list({ driver_id: driverId });
      setHistory(Array.isArray(h) ? h : []);
    } catch (e) { /* optional */ }
  };

  const handleProductSelect = (idx, productId) => {
    const p = products.find(x => x.id === parseInt(productId));
    const updated = [...items];
    updated[idx] = {
      ...updated[idx],
      product_id: productId,
      product_name: p ? p.name : '',
      unit: p ? p.unit : 'CTN',
      sell_price: p ? p.sell_price : '',
      purchase_price: p ? p.cost_price : '',
    };
    setItems(updated);
  };

  const handleItemChange = (idx, field, value) => {
    const updated = [...items];
    updated[idx] = { ...updated[idx], [field]: value };
    setItems(updated);
  };

  const addRow = () => setItems([...items, { ...emptyItem }]);
  const removeRow = (idx) => { if (items.length > 1) setItems(items.filter((_, i) => i !== idx)); };

  // Calculations
  const calcItem = (item) => {
    const qty = parseFloat(item.quantity) || 0;
    const sp = parseFloat(item.sell_price) || 0;
    const pp = parseFloat(item.purchase_price) || 0;
    return { totalSell: qty * sp, totalPurch: qty * pp, profit: (qty * sp) - (qty * pp) };
  };

  const totalSales = items.reduce((s, it) => s + calcItem(it).totalSell, 0);
  const totalCost = items.reduce((s, it) => s + calcItem(it).totalPurch, 0);
  const totalProfit = totalSales - totalCost;
  const profitPct = totalSales > 0 ? (totalProfit / totalSales * 100) : 0;
  const totalQty = items.reduce((s, it) => s + (parseFloat(it.quantity) || 0), 0);
  const collectionVal = parseFloat(collection) || 0;
  const discountsVal = parseFloat(discounts) || 0;
  const dailyDue = totalSales - collectionVal - discountsVal;

  // Previous running due
  const prevRunningDue = history.length > 0 ? history[0].running_due : 0;
  const runningDue = prevRunningDue + dailyDue;

  const handleSave = async () => {
    if (!driverId) { setError('Select a driver'); return; }
    const validItems = items.filter(it => it.product_name && parseFloat(it.quantity) > 0);
    if (validItems.length === 0) { setError('Add at least one item'); return; }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        driver_id: parseInt(driverId),
        date: sheetDate,
        items: validItems,
        collection_cash: collectionVal,
        expense_petrol: parseFloat(petrol) || 0,
        expense_others: parseFloat(others) || 0,
        sales_discounts: discountsVal,
        notes,
      };
      if (editingId) {
        await vanSalesAPI.update(editingId, payload);
        setSuccess('Sheet updated successfully');
      } else {
        await vanSalesAPI.create(payload);
        setSuccess('Sheet saved successfully');
      }
      resetForm();
      loadHistory();
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      setError('Failed to save: ' + (e.response?.data?.detail || e.message));
    } finally { setSaving(false); }
  };

  const resetForm = () => {
    setItems([{ ...emptyItem }]);
    setCollection(''); setPetrol(''); setOthers(''); setDiscounts(''); setNotes('');
    setEditingId(null);
  };

  const loadSheet = async (id) => {
    try {
      const acc = await vanSalesAPI.get(id);
      setDriverId(String(acc.driver_id));
      setSheetDate(acc.date);
      setItems(acc.items.map(it => ({
        product_id: it.product_id || '', product_name: it.product_name,
        unit: it.unit, quantity: it.quantity, sell_price: it.sell_price,
        purchase_price: it.purchase_price,
      })));
      setCollection(acc.collection_cash || '');
      setPetrol(acc.expense_petrol || '');
      setOthers(acc.expense_others || '');
      setDiscounts(acc.sales_discounts || '');
      setNotes(acc.notes || '');
      setEditingId(id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) { setError('Failed to load sheet'); }
  };

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><title>Van Sales Sheet</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; padding: 20px; font-size: 12px; }
        .header { text-align: center; margin-bottom: 16px; }
        .header h1 { font-size: 18px; margin-bottom: 2px; }
        .header h2 { font-size: 14px; font-weight: normal; color: #555; }
        .meta { display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 13px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
        th, td { border: 1px solid #333; padding: 4px 6px; text-align: center; font-size: 11px; }
        th { background: #f0f0f0; font-weight: bold; }
        td.right { text-align: right; }
        td.left { text-align: left; }
        .totals { margin-top: 8px; }
        .totals table { width: 50%; margin-left: auto; }
        .totals td { font-size: 12px; font-weight: 600; }
        .totals td:first-child { text-align: left; }
        .totals td:last-child { text-align: right; }
        .due-box { margin-top: 12px; padding: 8px; border: 2px solid #333; font-size: 14px; font-weight: bold; text-align: right; }
        @media print { body { padding: 10px; } }
      </style>
    </head><body>${content.innerHTML}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 250);
  };

  const driverName = drivers.find(d => d.id === parseInt(driverId))?.name || '—';

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="admin-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Van Sales Entry</h1>
          <p className="page-subtitle">Daily driver route accounting sheet</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {editingId && <button onClick={resetForm} style={btnSecondary}>New Sheet</button>}
          <button onClick={handlePrint} style={btnSecondary}>Print Sheet</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? 'Saving...' : editingId ? 'Update Sheet' : 'Save Sheet'}
          </button>
        </div>
      </div>

      {error && <div style={{ padding: '10px 14px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 6, color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{error}</div>}
      {success && <div style={{ padding: '10px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, color: '#15803d', fontSize: 13, marginBottom: 12 }}>{success}</div>}

      {/* Driver & Date */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="form-group" style={{ flex: 1, minWidth: 200 }}>
          <label style={labelStyle}>Driver *</label>
          <select value={driverId} onChange={e => setDriverId(e.target.value)} className="filter-select" style={{ width: '100%' }}>
            <option value="">Select driver</option>
            {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ flex: 1, minWidth: 200 }}>
          <label style={labelStyle}>Date *</label>
          <input type="date" value={sheetDate} onChange={e => setSheetDate(e.target.value)} className="search-input" style={{ width: '100%' }} />
        </div>
        <div style={{ flex: 1, minWidth: 200, display: 'flex', alignItems: 'flex-end' }}>
          {driverId && <div style={{ padding: '8px 14px', background: '#fef3c7', borderRadius: 6, fontSize: 13, fontWeight: 600, color: '#92400e' }}>
            Previous Due: OMR {prevRunningDue.toFixed(3)}
          </div>}
        </div>
      </div>

      {/* Items Table */}
      <div style={{ overflowX: 'auto', marginBottom: 16 }}>
        <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              <th style={thStyle}>SL</th>
              <th style={{ ...thStyle, minWidth: 200 }}>Product</th>
              <th style={thStyle}>Unit</th>
              <th style={thStyle}>Qty</th>
              <th style={thStyle}>Sell Price</th>
              <th style={thStyle}>Total Sell</th>
              <th style={thStyle}>Purc. Price</th>
              <th style={thStyle}>Total Purc.</th>
              <th style={thStyle}>Profit</th>
              <th style={{ ...thStyle, width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const c = calcItem(item);
              return (
                <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={tdStyle}>{idx + 1}</td>
                  <td style={tdStyle}>
                    <select value={item.product_id} onChange={e => handleProductSelect(idx, e.target.value)}
                      style={{ width: '100%', padding: '4px 6px', border: '1px solid #e2e8f0', borderRadius: 4, fontSize: 13 }}>
                      <option value="">Select product</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </td>
                  <td style={tdStyle}>
                    <input value={item.unit} onChange={e => handleItemChange(idx, 'unit', e.target.value)}
                      style={cellInput} />
                  </td>
                  <td style={tdStyle}>
                    <input type="number" value={item.quantity} onChange={e => handleItemChange(idx, 'quantity', e.target.value)}
                      style={{ ...cellInput, width: 70 }} />
                  </td>
                  <td style={tdStyle}>
                    <input type="number" step="0.001" value={item.sell_price} onChange={e => handleItemChange(idx, 'sell_price', e.target.value)}
                      style={{ ...cellInput, width: 80 }} />
                  </td>
                  <td style={{ ...tdStyle, fontWeight: 600, textAlign: 'right' }}>{c.totalSell.toFixed(3)}</td>
                  <td style={tdStyle}>
                    <input type="number" step="0.001" value={item.purchase_price} onChange={e => handleItemChange(idx, 'purchase_price', e.target.value)}
                      style={{ ...cellInput, width: 80 }} />
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{c.totalPurch.toFixed(3)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: c.profit >= 0 ? '#16a34a' : '#dc2626', fontWeight: 600 }}>{c.profit.toFixed(3)}</td>
                  <td style={tdStyle}>
                    <button onClick={() => removeRow(idx)} style={{ border: 'none', background: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 16 }}>x</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <button onClick={addRow} style={{ marginTop: 8, padding: '6px 14px', border: '1px dashed #94a3b8', background: '#fff', borderRadius: 6, cursor: 'pointer', fontSize: 13, color: '#64748b' }}>+ Add Row</button>
      </div>

      {/* Summary Cards */}
      <div className="wms-kpi-row" style={{ marginBottom: 16 }}>
        <div className="wms-kpi-card"><div className="wms-kpi-label">Total Qty</div><div className="wms-kpi-value">{totalQty.toFixed(0)}</div></div>
        <div className="wms-kpi-card"><div className="wms-kpi-label">Total Sales</div><div className="wms-kpi-value blue">{totalSales.toFixed(3)}</div></div>
        <div className="wms-kpi-card"><div className="wms-kpi-label">Total Cost</div><div className="wms-kpi-value">{totalCost.toFixed(3)}</div></div>
        <div className="wms-kpi-card"><div className="wms-kpi-label">Profit</div><div className="wms-kpi-value green">{totalProfit.toFixed(3)} ({profitPct.toFixed(1)}%)</div></div>
      </div>

      {/* Bottom Section — Collections & Expenses */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16, padding: 16, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
        <div>
          <label style={labelStyle}>Collection (Cash)</label>
          <input type="number" step="0.001" value={collection} onChange={e => setCollection(e.target.value)} className="search-input" style={{ width: '100%' }} placeholder="0.000" />
        </div>
        <div>
          <label style={labelStyle}>Expenses - Petrol</label>
          <input type="number" step="0.001" value={petrol} onChange={e => setPetrol(e.target.value)} className="search-input" style={{ width: '100%' }} placeholder="0.000" />
        </div>
        <div>
          <label style={labelStyle}>Expenses - Others</label>
          <input type="number" step="0.001" value={others} onChange={e => setOthers(e.target.value)} className="search-input" style={{ width: '100%' }} placeholder="0.000" />
        </div>
        <div>
          <label style={labelStyle}>Sales Discounts</label>
          <input type="number" step="0.001" value={discounts} onChange={e => setDiscounts(e.target.value)} className="search-input" style={{ width: '100%' }} placeholder="0.000" />
        </div>
        <div>
          <label style={labelStyle}>Notes</label>
          <input type="text" value={notes} onChange={e => setNotes(e.target.value)} className="search-input" style={{ width: '100%' }} placeholder="Optional notes..." />
        </div>
      </div>

      {/* Due Box */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <div style={{ flex: 1, padding: 16, background: '#fff', border: '2px solid #f59e0b', borderRadius: 8, textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: '#92400e', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Today's Due</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#92400e' }}>OMR {dailyDue.toFixed(3)}</div>
        </div>
        <div style={{ flex: 1, padding: 16, background: '#fff', border: '2px solid #dc2626', borderRadius: 8, textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: '#dc2626', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Running Due ({driverName})</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#dc2626' }}>OMR {runningDue.toFixed(3)}</div>
        </div>
      </div>

      {/* History */}
      {driverId && (
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1a2332', marginBottom: 12 }}>Recent Sheets — {driverName}</h3>
          {history.length === 0 ? (
            <EmptyState title="No sheets yet" hint="Save your first van sales sheet above" />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={thStyle}>Date</th>
                    <th style={thStyle}>Sales</th>
                    <th style={thStyle}>Collection</th>
                    <th style={thStyle}>Daily Due</th>
                    <th style={thStyle}>Running Due</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(h => (
                    <tr key={h.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={tdStyle}>{h.date}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{h.total_sales.toFixed(3)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{h.collection_cash.toFixed(3)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', color: '#92400e', fontWeight: 600 }}>{h.daily_due.toFixed(3)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', color: '#dc2626', fontWeight: 700 }}>{h.running_due.toFixed(3)}</td>
                      <td style={tdStyle}><span className={`wms-badge ${h.status === 'settled' ? 'completed' : 'pending'}`}>{h.status}</span></td>
                      <td style={tdStyle}>
                        <button onClick={() => loadSheet(h.id)} style={{ padding: '3px 8px', fontSize: 11, borderRadius: 4, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontWeight: 600 }}>Edit</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Hidden Print Template */}
      <div style={{ display: 'none' }}>
        <div ref={printRef}>
          <div className="header">
            <h1>AK Al Mumayza Trading</h1>
            <h2>Daily Van Sales Sheet</h2>
          </div>
          <div className="meta">
            <span><strong>Driver:</strong> {driverName}</span>
            <span><strong>Date:</strong> {sheetDate}</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>SL</th><th>Product</th><th>Unit</th><th>Qty</th>
                <th>Sell Price</th><th>Total Sell</th><th>Purc. Price</th><th>Total Purc.</th><th>Profit</th>
              </tr>
            </thead>
            <tbody>
              {items.filter(it => it.product_name && parseFloat(it.quantity) > 0).map((item, idx) => {
                const c = calcItem(item);
                return (
                  <tr key={idx}>
                    <td>{idx + 1}</td>
                    <td className="left">{item.product_name}</td>
                    <td>{item.unit}</td>
                    <td>{parseFloat(item.quantity || 0)}</td>
                    <td className="right">{parseFloat(item.sell_price || 0).toFixed(3)}</td>
                    <td className="right">{c.totalSell.toFixed(3)}</td>
                    <td className="right">{parseFloat(item.purchase_price || 0).toFixed(3)}</td>
                    <td className="right">{c.totalPurch.toFixed(3)}</td>
                    <td className="right">{c.profit.toFixed(3)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="totals">
            <table>
              <tbody>
                <tr><td>Total Qty (CTN)</td><td>{totalQty.toFixed(0)}</td></tr>
                <tr><td>Total Sales</td><td>OMR {totalSales.toFixed(3)}</td></tr>
                <tr><td>Total Cost</td><td>OMR {totalCost.toFixed(3)}</td></tr>
                <tr><td>Profit ({profitPct.toFixed(1)}%)</td><td>OMR {totalProfit.toFixed(3)}</td></tr>
                <tr><td>Collection</td><td>OMR {collectionVal.toFixed(3)}</td></tr>
                <tr><td>Petrol</td><td>OMR {(parseFloat(petrol) || 0).toFixed(3)}</td></tr>
                <tr><td>Other Expenses</td><td>OMR {(parseFloat(others) || 0).toFixed(3)}</td></tr>
                <tr><td>Discounts</td><td>OMR {discountsVal.toFixed(3)}</td></tr>
              </tbody>
            </table>
          </div>
          <div className="due-box">
            Today's Due: OMR {dailyDue.toFixed(3)} &nbsp;&nbsp;|&nbsp;&nbsp; Running Due ({driverName}): OMR {runningDue.toFixed(3)}
          </div>
        </div>
      </div>
    </div>
  );
}

const labelStyle = { fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4, display: 'block' };
const thStyle = { padding: '8px 10px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #e2e8f0' };
const tdStyle = { padding: '6px 8px', fontSize: 13, color: '#1a2332', textAlign: 'center' };
const cellInput = { padding: '4px 6px', border: '1px solid #e2e8f0', borderRadius: 4, fontSize: 13, width: 60, textAlign: 'center' };
const btnSecondary = { padding: '8px 14px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 };

export default VanSalesEntry;
