// DriverDashboard — mobile-optimised daily van sales for the logged-in driver
import React, { useState, useEffect } from 'react';
import { vanSalesAPI } from '../services/api';
import { Truck } from 'lucide-react';

const emptyItem = { product_id: '', product_name: '', unit: 'CTN', quantity: '', sell_price: '', purchase_price: '' };

function DriverDashboard() {
  const userName = localStorage.getItem('userName') || localStorage.getItem('username') || '';
  const today = new Date().toISOString().split('T')[0];

  const [products, setProducts] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [myDriverId, setMyDriverId] = useState(null);
  const [todaySheet, setTodaySheet] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Entry form state
  const [view, setView] = useState('home'); // home | entry | detail
  const [items, setItems] = useState([{ ...emptyItem }]);
  const [collection, setCollection] = useState('');
  const [discounts, setDiscounts] = useState('');
  const [petrol, setPetrol] = useState('');
  const [others, setOthers] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [detailSheet, setDetailSheet] = useState(null);

  useEffect(() => { loadInit(); }, []); // eslint-disable-line

  const loadInit = async () => {
    try {
      setLoading(true);
      const [d, p] = await Promise.all([vanSalesAPI.drivers(), vanSalesAPI.productsList()]);
      const driverList = Array.isArray(d) ? d : [];
      setDrivers(driverList);
      setProducts(Array.isArray(p) ? p : []);

      // Find current user's driver ID by matching name
      const me = driverList.find(x =>
        x.name?.toLowerCase() === userName.toLowerCase() ||
        x.name?.toLowerCase().includes(userName.toLowerCase())
      );
      if (me) {
        setMyDriverId(me.id);
        await loadDriverData(me.id);
      }
    } catch (e) { setError('Failed to load data'); }
    finally { setLoading(false); }
  };

  const loadDriverData = async (dId) => {
    try {
      const h = await vanSalesAPI.list({ driver_id: dId });
      const sheets = Array.isArray(h) ? h : [];
      setHistory(sheets);
      // Check if there's a sheet for today
      const ts = sheets.find(s => s.date === today);
      setTodaySheet(ts || null);
    } catch (e) { /* ignore */ }
  };

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
  const collectionVal = parseFloat(collection) || 0;
  const discountsVal = parseFloat(discounts) || 0;
  const dailyDue = totalSales - collectionVal - discountsVal;
  const prevRunningDue = history.length > 0 ? history[0].running_due : 0;
  const runningDue = prevRunningDue + dailyDue;

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

  const startNewSheet = () => {
    setItems([{ ...emptyItem }]);
    setCollection(''); setDiscounts(''); setPetrol(''); setOthers(''); setNotes('');
    setView('entry');
  };

  const editTodaySheet = async () => {
    if (!todaySheet) return;
    try {
      const acc = await vanSalesAPI.get(todaySheet.id);
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
      setView('entry');
    } catch (e) { setError('Failed to load sheet'); }
  };

  const handleSave = async () => {
    if (!myDriverId) { setError('Driver not identified'); return; }
    const validItems = items.filter(it => it.product_name && parseFloat(it.quantity) > 0);
    if (validItems.length === 0) { setError('Add at least one item'); return; }

    setSaving(true); setError('');
    try {
      const payload = {
        driver_id: myDriverId,
        date: today,
        items: validItems,
        collection_cash: collectionVal,
        expense_petrol: parseFloat(petrol) || 0,
        expense_others: parseFloat(others) || 0,
        sales_discounts: discountsVal,
        notes,
      };
      if (todaySheet) {
        await vanSalesAPI.update(todaySheet.id, payload);
        setSuccess('Sheet updated!');
      } else {
        await vanSalesAPI.create(payload);
        setSuccess('Sheet saved!');
      }
      await loadDriverData(myDriverId);
      setView('home');
      setTimeout(() => setSuccess(''), 4000);
    } catch (e) {
      setError('Failed to save: ' + (e.response?.data?.detail || e.message));
    } finally { setSaving(false); }
  };

  const viewDetail = async (sheet) => {
    try {
      const acc = await vanSalesAPI.get(sheet.id);
      setDetailSheet(acc);
      setView('detail');
    } catch (e) { setError('Failed to load details'); }
  };

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <div style={{ textAlign: 'center', color: '#64748b' }}>
        <Truck size={48} style={{ marginBottom: 12, opacity: 0.5 }} />
        <div style={{ fontSize: 16 }}>Loading...</div>
      </div>
    </div>
  );

  // ────────────────── DETAIL VIEW ──────────────────
  if (view === 'detail' && detailSheet) {
    return (
      <div style={{ padding: '16px', maxWidth: 600, margin: '0 auto' }}>
        <button onClick={() => setView('home')} style={backBtn}>Back</button>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, color: '#1a2332' }}>Sheet — {detailSheet.date}</h2>
        <div style={{ fontSize: 14, color: '#64748b', marginBottom: 16 }}>Status: <strong>{detailSheet.status}</strong></div>

        {/* Items */}
        <div style={{ overflowX: 'auto', marginBottom: 16 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f1f5f9' }}>
                <th style={dthStyle}>Product</th>
                <th style={dthStyle}>Qty</th>
                <th style={dthStyle}>Sell</th>
                <th style={dthStyle}>Total</th>
              </tr>
            </thead>
            <tbody>
              {(detailSheet.items || []).map((it, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '8px', fontSize: 13 }}>{it.product_name}</td>
                  <td style={{ padding: '8px', textAlign: 'center' }}>{it.quantity}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>{Number(it.sell_price).toFixed(3)}</td>
                  <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600 }}>{Number(it.total_sell).toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div style={{ background: '#f8fafc', borderRadius: 10, padding: 16, fontSize: 14 }}>
          <Row label="Total Sales" value={`${Number(detailSheet.total_sales).toFixed(3)} OMR`} bold />
          <Row label="Total Cost" value={`${Number(detailSheet.total_cost).toFixed(3)} OMR`} />
          <Row label="Profit" value={`${Number(detailSheet.total_profit).toFixed(3)} OMR`} color="#16a34a" />
          <Row label="Collection" value={`${Number(detailSheet.collection_cash).toFixed(3)} OMR`} />
          <Row label="Discounts" value={`${Number(detailSheet.sales_discounts).toFixed(3)} OMR`} />
          <Row label="Daily Due" value={`${Number(detailSheet.daily_due).toFixed(3)} OMR`} color="#92400e" bold />
          <Row label="Running Due" value={`${Number(detailSheet.running_due).toFixed(3)} OMR`} color="#dc2626" bold />
        </div>
      </div>
    );
  }

  // ────────────────── ENTRY VIEW ──────────────────
  if (view === 'entry') {
    return (
      <div style={{ padding: '16px', maxWidth: 700, margin: '0 auto' }}>
        <button onClick={() => setView('home')} style={backBtn}>Back</button>

        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, color: '#1a2332' }}>
          {todaySheet ? 'Edit Today\'s Sheet' : 'New Daily Sheet'}
        </h2>
        <div style={{ fontSize: 14, color: '#64748b', marginBottom: 16 }}>Date: {today}</div>

        {error && <div style={errBox}>{error}</div>}

        {/* Product rows */}
        {items.map((item, idx) => {
          const c = calcItem(item);
          return (
            <div key={idx} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>ITEM {idx + 1}</span>
                {items.length > 1 && <button onClick={() => removeRow(idx)} style={{ border: 'none', background: 'none', color: '#dc2626', fontWeight: 700, fontSize: 18, cursor: 'pointer' }}>x</button>}
              </div>
              <select value={item.product_id} onChange={e => handleProductSelect(idx, e.target.value)}
                style={{ ...mInput, marginBottom: 8, width: '100%' }}>
                <option value="">Select product...</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
              </select>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <div>
                  <label style={mLabel}>Qty</label>
                  <input type="number" value={item.quantity} onChange={e => handleItemChange(idx, 'quantity', e.target.value)}
                    style={mInput} placeholder="0" />
                </div>
                <div>
                  <label style={mLabel}>Sell Price</label>
                  <input type="number" step="0.001" value={item.sell_price} onChange={e => handleItemChange(idx, 'sell_price', e.target.value)}
                    style={mInput} placeholder="0.000" />
                </div>
                <div>
                  <label style={mLabel}>Cost Price</label>
                  <input type="number" step="0.001" value={item.purchase_price} onChange={e => handleItemChange(idx, 'purchase_price', e.target.value)}
                    style={mInput} placeholder="0.000" />
                </div>
              </div>
              {c.totalSell > 0 && (
                <div style={{ marginTop: 6, fontSize: 13, color: '#64748b' }}>
                  Total: <strong>{c.totalSell.toFixed(3)}</strong> | Profit: <span style={{ color: c.profit >= 0 ? '#16a34a' : '#dc2626', fontWeight: 600 }}>{c.profit.toFixed(3)}</span>
                </div>
              )}
            </div>
          );
        })}

        <button onClick={addRow} style={{ ...actionBtn, background: '#f1f5f9', color: '#475569', border: '1px dashed #94a3b8', marginBottom: 20 }}>
          + Add Product
        </button>

        {/* Running total */}
        <div style={{ background: '#EEF2FF', borderRadius: 10, padding: 14, marginBottom: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: '#4338CA', textTransform: 'uppercase', letterSpacing: 0.5 }}>Total Sales</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#4338CA' }}>OMR {totalSales.toFixed(3)}</div>
        </div>

        {/* Collection & expenses */}
        <div style={{ background: '#f8fafc', borderRadius: 10, padding: 14, marginBottom: 16 }}>
          <div style={{ marginBottom: 10 }}>
            <label style={mLabel}>Cash Collected</label>
            <input type="number" step="0.001" value={collection} onChange={e => setCollection(e.target.value)} style={mInput} placeholder="0.000" />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={mLabel}>Sales Discounts</label>
            <input type="number" step="0.001" value={discounts} onChange={e => setDiscounts(e.target.value)} style={mInput} placeholder="0.000" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
            <div>
              <label style={mLabel}>Petrol Expense</label>
              <input type="number" step="0.001" value={petrol} onChange={e => setPetrol(e.target.value)} style={mInput} placeholder="0.000" />
            </div>
            <div>
              <label style={mLabel}>Other Expenses</label>
              <input type="number" step="0.001" value={others} onChange={e => setOthers(e.target.value)} style={mInput} placeholder="0.000" />
            </div>
          </div>
          <div>
            <label style={mLabel}>Notes</label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)} style={mInput} placeholder="Optional notes..." />
          </div>
        </div>

        {/* Due summary */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          <div style={{ background: '#FEF3C7', borderRadius: 10, padding: 14, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#92400E', textTransform: 'uppercase' }}>Today's Due</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#92400E' }}>OMR {dailyDue.toFixed(3)}</div>
          </div>
          <div style={{ background: '#FEE2E2', borderRadius: 10, padding: 14, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#DC2626', textTransform: 'uppercase' }}>Running Due</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#DC2626' }}>OMR {runningDue.toFixed(3)}</div>
          </div>
        </div>

        {/* Save */}
        <button onClick={handleSave} disabled={saving}
          style={{ ...actionBtn, background: '#16a34a', color: '#fff', fontSize: 18, padding: '16px 0', fontWeight: 700 }}>
          {saving ? 'Saving...' : todaySheet ? 'Update Sheet' : 'Save Sheet'}
        </button>
      </div>
    );
  }

  // ────────────────── HOME VIEW ──────────────────
  return (
    <div style={{ padding: '16px', maxWidth: 600, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 24, paddingTop: 8 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, borderRadius: '50%', background: '#EEF2FF', marginBottom: 10 }}>
          <Truck size={28} color="#4338CA" />
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a2332', margin: '0 0 4px' }}>
          {userName ? `Hello, ${userName}` : 'Driver Dashboard'}
        </h1>
        <div style={{ fontSize: 14, color: '#64748b' }}>
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      </div>

      {error && <div style={errBox}>{error}</div>}
      {success && <div style={{ padding: '12px 16px', background: '#DCFCE7', border: '1px solid #BBF7D0', borderRadius: 10, color: '#15803D', fontSize: 14, marginBottom: 16, textAlign: 'center', fontWeight: 600 }}>{success}</div>}

      {/* Running Due Card */}
      <div style={{
        background: 'linear-gradient(135deg, #1a2332 0%, #2d3a4a 100%)',
        borderRadius: 14, padding: 24, marginBottom: 20, textAlign: 'center', color: '#fff',
      }}>
        <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, opacity: 0.7, marginBottom: 4 }}>Running Due Balance</div>
        <div style={{ fontSize: 36, fontWeight: 800, lineHeight: 1.2 }}>
          OMR {(history.length > 0 ? history[0].running_due : 0).toFixed(3)}
        </div>
        <div style={{ fontSize: 13, opacity: 0.6, marginTop: 4 }}>{history.length} total sheets</div>
      </div>

      {/* Today's Sheet Status */}
      {todaySheet ? (
        <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 12, padding: 18, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#15803D', marginBottom: 8 }}>Today's Sheet Submitted</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13, color: '#1a2332' }}>
            <div>Sales: <strong>{Number(todaySheet.total_sales).toFixed(3)}</strong></div>
            <div>Collected: <strong>{Number(todaySheet.collection_cash).toFixed(3)}</strong></div>
            <div>Daily Due: <strong style={{ color: '#92400E' }}>{Number(todaySheet.daily_due).toFixed(3)}</strong></div>
            <div>Running Due: <strong style={{ color: '#DC2626' }}>{Number(todaySheet.running_due).toFixed(3)}</strong></div>
          </div>
          <button onClick={editTodaySheet}
            style={{ ...actionBtn, marginTop: 12, background: '#fff', color: '#15803D', border: '1px solid #BBF7D0' }}>
            Edit Today's Sheet
          </button>
        </div>
      ) : (
        <button onClick={startNewSheet}
          style={{
            ...actionBtn, background: '#16a34a', color: '#fff',
            fontSize: 18, padding: '18px 0', fontWeight: 700, marginBottom: 16,
            boxShadow: '0 4px 14px rgba(22,163,74,0.3)',
          }}>
          Start Today's Sheet
        </button>
      )}

      {/* Quick stats from today */}
      {todaySheet && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          <StatCard label="Total Sales" value={Number(todaySheet.total_sales).toFixed(3)} color="#2563EB" />
          <StatCard label="Profit" value={Number(todaySheet.total_profit).toFixed(3)} color="#16a34a" />
        </div>
      )}

      {/* Recent History */}
      {history.length > 0 && (
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1a2332', marginBottom: 12 }}>Recent Sheets</h3>
          {history.slice(0, 10).map(h => (
            <div key={h.id} onClick={() => viewDetail(h)}
              style={{
                background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
                padding: '14px 16px', marginBottom: 8, cursor: 'pointer',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: '#1a2332' }}>{h.date}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  Sales: {Number(h.total_sales).toFixed(3)} | Due: {Number(h.daily_due).toFixed(3)}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: h.running_due > 0 ? '#DC2626' : '#16a34a' }}>
                  {Number(h.running_due).toFixed(3)}
                </div>
                <span style={{
                  fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4,
                  background: h.status === 'settled' ? '#DCFCE7' : '#FEF3C7',
                  color: h.status === 'settled' ? '#15803D' : '#92400E',
                }}>{h.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Driver not found fallback */}
      {!myDriverId && !loading && (
        <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
          <div style={{ fontSize: 16, marginBottom: 8 }}>Driver profile not found</div>
          <div style={{ fontSize: 13 }}>Please contact your admin to set up your driver account.</div>
        </div>
      )}
    </div>
  );
}

// ── Helper components ──
function Row({ label, value, color, bold }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #e2e8f0' }}>
      <span style={{ color: '#64748b', fontSize: 13 }}>{label}</span>
      <span style={{ color: color || '#1a2332', fontWeight: bold ? 700 : 400, fontSize: 14 }}>{value}</span>
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, textAlign: 'center' }}>
      <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

// ── Styles ──
const mInput = { width: '100%', padding: '12px 14px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 15, boxSizing: 'border-box' };
const mLabel = { display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 };
const actionBtn = { display: 'block', width: '100%', padding: '14px 0', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: 'pointer', textAlign: 'center' };
const backBtn = { border: 'none', background: 'none', color: '#4338CA', fontSize: 14, fontWeight: 600, cursor: 'pointer', padding: '4px 0', marginBottom: 12 };
const errBox = { padding: '12px 16px', background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: 10, color: '#DC2626', fontSize: 14, marginBottom: 16 };
const dthStyle = { padding: '8px', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', borderBottom: '2px solid #e2e8f0', textAlign: 'center' };

export default DriverDashboard;
