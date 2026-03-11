import LoadingSpinner from './LoadingSpinner';
import EmptyState from './EmptyState';
import React, { useState, useEffect } from 'react';
import { purchaseAPI, supplierAPI, productAPI } from '../services/api';
import './Purchasing.css';
import { ShoppingBag } from 'lucide-react';

function PurchaseOrderList({ onViewOrder }) {
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [message, setMessage] = useState({ text: '', type: '' });

  const [form, setForm] = useState({ supplier_id: '', order_date: new Date().toISOString().slice(0, 10), expected_delivery_date: '', container_reference: '', currency: 'OMR', exchange_rate: 1, tax_rate: 0, notes: '' });
  const [lineItems, setLineItems] = useState([]);
  const [newItem, setNewItem] = useState({ product_id: '', quantity: '', unit_price: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); loadSuppliers(); loadProducts(); }, [filterStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = async () => { setLoading(true); try { const params = {}; if (filterStatus) params.status = filterStatus; const d = await purchaseAPI.listOrders(params); setOrders(Array.isArray(d) ? d : (d?.items || d?.orders || [])); } catch(e) { console.error(e); } finally { setLoading(false); } };
  const loadSuppliers = async () => { try { const d = await supplierAPI.list({ active_only: true }); setSuppliers(Array.isArray(d) ? d : (d?.items || [])); } catch(e) {} };
  const loadProducts = async () => { try { const res = await productAPI.getAll(); setProducts((res.data || []).filter(p => p.is_active)); } catch(e) {} };

  const addLineItem = () => {
    if (!newItem.product_id || !newItem.quantity || !newItem.unit_price) return;
    const prod = products.find(p => p.id === parseInt(newItem.product_id));
    setLineItems(prev => [...prev, { ...newItem, product_id: parseInt(newItem.product_id), quantity: parseInt(newItem.quantity), unit_price: parseFloat(newItem.unit_price), product_name: prod?.name || '', sku: prod?.sku || '' }]);
    setNewItem({ product_id: '', quantity: '', unit_price: '' });
  };

  const removeItem = (idx) => setLineItems(prev => prev.filter((_, i) => i !== idx));
  const subtotal = lineItems.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const tax = subtotal * (parseFloat(form.tax_rate) || 0) / 100;

  const handleCreate = async (e) => {
    e.preventDefault();
    if (lineItems.length === 0) { setMessage({ text: 'Add at least one item', type: 'error' }); return; }
    setSaving(true);
    try {
      const result = await purchaseAPI.createOrder({
        supplier_id: parseInt(form.supplier_id), order_date: form.order_date,
        expected_delivery_date: form.expected_delivery_date || null,
        container_reference: form.container_reference || null,
        currency: form.currency, exchange_rate: parseFloat(form.exchange_rate),
        tax_rate: parseFloat(form.tax_rate) || 0, notes: form.notes || null,
        items: lineItems.map(i => ({ product_id: i.product_id, quantity: i.quantity, unit_price: i.unit_price }))
      });
      setMessage({ text: `${result.po_number} created! Total: ${result.total_amount} OMR`, type: 'success' });
      setShowCreate(false); setLineItems([]); load();
    } catch(e) { setMessage({ text: `${e.response?.data?.detail || e.message}`, type: 'error' }); } finally { setSaving(false); }
  };

  const sendPO = async (id) => { try { await purchaseAPI.sendOrder(id); load(); } catch(e) { setMessage({ text: e.response?.data?.detail || e.message, type: 'error' }); } };

  const statusColor = (s) => ({ draft: '#6b7280', sent: '#2563eb', partially_received: '#d97706', fully_received: '#16a34a', closed: '#9ca3af' }[s] || '#6b7280');

  return (
    <div className="purchasing-container">
      <div className="page-header">
        <div className="header-content"><div className="header-icon po"><ShoppingBag size={20} /></div><div><h1>Purchase Orders</h1><p>Create and track supplier orders</p></div></div>
        <button className="action-btn primary" onClick={() => setShowCreate(!showCreate)}>{showCreate ? '✕ Cancel' : '+ New PO'}</button>
      </div>

      {message.text && <div className={`message ${message.type}`}>{message.text}</div>}

      {showCreate && (
        <div className="form-card">
          <h3>Create Purchase Order</h3>
          <form onSubmit={handleCreate}>
            <div className="form-row-3">
              <div className="form-group"><label>Supplier *</label>
                <select value={form.supplier_id} onChange={e => setForm(p => ({...p, supplier_id: e.target.value}))} required>
                  <option value="">Select supplier...</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                </select>
              </div>
              <div className="form-group"><label>Order Date *</label><input type="date" value={form.order_date} onChange={e => setForm(p => ({...p, order_date: e.target.value}))} required /></div>
              <div className="form-group"><label>Expected Delivery</label><input type="date" value={form.expected_delivery_date} onChange={e => setForm(p => ({...p, expected_delivery_date: e.target.value}))} /></div>
            </div>
            <div className="form-row-3">
              <div className="form-group"><label>Container Ref</label><input value={form.container_reference} onChange={e => setForm(p => ({...p, container_reference: e.target.value}))} placeholder="CONT-2026-001" /></div>
              <div className="form-group"><label>Currency</label>
                <select value={form.currency} onChange={e => setForm(p => ({...p, currency: e.target.value}))}>
                  <option value="OMR">OMR</option><option value="USD">USD</option><option value="AED">AED</option><option value="EUR">EUR</option>
                </select>
              </div>
              <div className="form-group"><label>Tax Rate %</label><input type="number" step="0.1" value={form.tax_rate} onChange={e => setForm(p => ({...p, tax_rate: e.target.value}))} placeholder="5" /></div>
            </div>

            <div className="line-items-section">
              <h4>Line Items</h4>
              <div className="add-item-row">
                <select value={newItem.product_id} onChange={e => setNewItem(p => ({...p, product_id: e.target.value}))}>
                  <option value="">Select product...</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                </select>
                <input type="number" placeholder="Qty" value={newItem.quantity} onChange={e => setNewItem(p => ({...p, quantity: e.target.value}))} min="1" />
                <input type="number" placeholder="Unit Price" step="0.001" value={newItem.unit_price} onChange={e => setNewItem(p => ({...p, unit_price: e.target.value}))} min="0" />
                <button type="button" className="add-item-btn" onClick={addLineItem}>+ Add</button>
              </div>
              {lineItems.length > 0 && (
                <table className="items-table">
                  <thead><tr><th>Product</th><th>Qty</th><th>Price</th><th>Total</th><th></th></tr></thead>
                  <tbody>
                    {lineItems.map((item, idx) => (
                      <tr key={idx}><td>{item.product_name}</td><td>{item.quantity}</td><td>{(Number(item.unit_price) || 0).toFixed(3)}</td><td>{(Number(item.quantity) * (Number(item.unit_price) || 0)).toFixed(3)}</td><td><button type="button" className="remove-btn" onClick={() => removeItem(idx)}>✕</button></td></tr>
                    ))}
                    <tr className="totals-row"><td colSpan="3">Subtotal</td><td>{subtotal.toFixed(3)} {form.currency}</td><td></td></tr>
                    {tax > 0 && <tr className="totals-row"><td colSpan="3">Tax ({form.tax_rate}%)</td><td>{tax.toFixed(3)}</td><td></td></tr>}
                    <tr className="totals-row grand"><td colSpan="3">Total</td><td>{(subtotal + tax).toFixed(3)} {form.currency}</td><td></td></tr>
                  </tbody>
                </table>
              )}
            </div>
            <div className="form-group"><label>Notes</label><textarea value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))} rows="2" /></div>
            <button type="submit" className="submit-btn" disabled={lineItems.length === 0 || saving}>{saving ? 'Creating...' : 'Create Purchase Order'}</button>
          </form>
        </div>
      )}

      <div className="filter-bar">
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="filter-select">
          <option value="">All Statuses</option><option value="draft">Draft</option><option value="sent">Sent</option>
          <option value="partially_received">Partially Received</option><option value="fully_received">Fully Received</option><option value="closed">Closed</option>
        </select>
      </div>

      {loading ? <LoadingSpinner /> : (
        <div className="table-container">
          <table className="data-table">
            <thead><tr><th>PO #</th><th>Supplier</th><th>Date</th><th>Expected</th><th>Container</th><th>Total</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {orders.length === 0 ? <EmptyState colSpan={8} title="No purchase orders yet" hint="Click '+ New PO' to create your first purchase order" /> :
                orders.map(o => (
                  <tr key={o.id}>
                    <td className="code">{o.po_number}</td><td>{o.supplier_name}</td>
                    <td>{o.order_date}</td><td>{o.expected_delivery_date || '-'}</td>
                    <td>{o.container_reference || '-'}</td>
                    <td className="value">{(Number(o.total_amount) || 0).toFixed(3)} {o.currency}</td>
                    <td><span className="status-pill" style={{ backgroundColor: statusColor(o.status) }}>{(o.status || '').replace('_', ' ')}</span></td>
                    <td className="actions">
                      <button className="view-btn" onClick={() => onViewOrder(o.id)}>View</button>
                      {o.status === 'draft' && <button className="send-btn" onClick={() => sendPO(o.id)}>Send</button>}
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
export default PurchaseOrderList;
