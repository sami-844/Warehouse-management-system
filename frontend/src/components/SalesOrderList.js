import React, { useState, useEffect } from 'react';
import { salesAPI, customerAPI, productAPI, inventoryAPI } from '../services/api';
import './Sales.css';

function SalesOrderList({ onViewOrder }) {
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [stockLevels, setStockLevels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [message, setMessage] = useState({ text: '', type: '' });
  const [form, setForm] = useState({ customer_id: '', order_date: new Date().toISOString().slice(0, 10), required_date: '', driver_name: '', vehicle: '', route_area: '', tax_rate: 5, notes: '' });
  const [lineItems, setLineItems] = useState([]);
  const [newItem, setNewItem] = useState({ product_id: '', quantity_ordered: '', unit_price: '', discount_percent: '0' });

  useEffect(() => { load(); loadCustomers(); loadProducts(); loadStock(); }, [filterStatus]);

  const load = async () => { setLoading(true); try { const params = {}; if (filterStatus) params.status = filterStatus; setOrders(await salesAPI.listOrders(params)); } catch(e) { console.error(e); } finally { setLoading(false); } };
  const loadCustomers = async () => { try { setCustomers(await customerAPI.list({ active_only: true })); } catch(e) {} };
  const loadProducts = async () => { try { const res = await productAPI.getAll(); setProducts((res.data || []).filter(p => p.is_active)); } catch(e) {} };
  const loadStock = async () => { try { setStockLevels(await inventoryAPI.getStockLevels()); } catch(e) {} };

  const getStock = (productId) => {
    const levels = stockLevels.filter(s => s.product_id === productId);
    return levels.reduce((sum, s) => sum + (s.quantity || 0), 0);
  };

  const addLineItem = () => {
    if (!newItem.product_id || !newItem.quantity_ordered || !newItem.unit_price) return;
    const prod = products.find(p => p.id === parseInt(newItem.product_id));
    const stock = getStock(parseInt(newItem.product_id));
    setLineItems(prev => [...prev, {
      product_id: parseInt(newItem.product_id), quantity_ordered: parseInt(newItem.quantity_ordered),
      unit_price: parseFloat(newItem.unit_price), discount_percent: parseFloat(newItem.discount_percent) || 0,
      product_name: prod?.name || '', sku: prod?.sku || '', available_stock: stock
    }]);
    setNewItem({ product_id: '', quantity_ordered: '', unit_price: '', discount_percent: '0' });
  };

  const onProductSelect = (productId) => {
    const prod = products.find(p => p.id === parseInt(productId));
    setNewItem(prev => ({ ...prev, product_id: productId, unit_price: prod?.selling_price || '' }));
  };

  const removeItem = (idx) => setLineItems(prev => prev.filter((_, i) => i !== idx));
  const subtotal = lineItems.reduce((s, i) => s + i.quantity_ordered * i.unit_price, 0);
  const totalDiscount = lineItems.reduce((s, i) => s + i.quantity_ordered * i.unit_price * (i.discount_percent / 100), 0);
  const netSubtotal = subtotal - totalDiscount;
  const tax = netSubtotal * (parseFloat(form.tax_rate) || 0) / 100;

  const handleCreate = async (e) => {
    e.preventDefault();
    if (lineItems.length === 0) { setMessage({ text: 'Add at least one item', type: 'error' }); return; }
    try {
      const customer = customers.find(c => c.id === parseInt(form.customer_id));
      const result = await salesAPI.createOrder({
        customer_id: parseInt(form.customer_id), order_date: form.order_date,
        required_date: form.required_date || null,
        driver_name: form.driver_name || null, vehicle: form.vehicle || null,
        route_area: form.route_area || customer?.area || null,
        tax_rate: parseFloat(form.tax_rate) || 5, notes: form.notes || null,
        items: lineItems.map(i => ({ product_id: i.product_id, quantity_ordered: i.quantity_ordered, unit_price: i.unit_price, discount_percent: i.discount_percent }))
      });
      setMessage({ text: `✅ ${result.order_number} created! Total: ${result.total_amount.toFixed(3)} OMR`, type: 'success' });
      setShowCreate(false); setLineItems([]); load();
    } catch(e) { setMessage({ text: `❌ ${e.response?.data?.detail || e.message}`, type: 'error' }); }
  };

  const onCustomerSelect = (customerId) => {
    const cust = customers.find(c => c.id === parseInt(customerId));
    setForm(prev => ({ ...prev, customer_id: customerId, route_area: cust?.area || '' }));
  };

  const statusColor = (s) => ({ draft: '#6b7280', confirmed: '#2563eb', picking: '#7c3aed', shipped: '#d97706', delivered: '#16a34a', invoiced: '#059669', closed: '#9ca3af' }[s] || '#6b7280');

  return (
    <div className="sales-container">
      <div className="page-header"><div className="header-content"><div className="header-icon so">📝</div><div><h1>Sales Orders</h1><p>Create and manage customer orders</p></div></div>
        <button className="action-btn primary" onClick={() => setShowCreate(!showCreate)}>{showCreate ? '✕ Cancel' : '+ New Order'}</button></div>

      {message.text && <div className={`message ${message.type}`}>{message.text}</div>}

      {showCreate && (
        <div className="form-card"><h3>Create Sales Order</h3>
          <form onSubmit={handleCreate}>
            <div className="form-row-3">
              <div className="form-group"><label>Customer *</label>
                <select value={form.customer_id} onChange={e => onCustomerSelect(e.target.value)} required>
                  <option value="">Select customer...</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.area || c.code})</option>)}
                </select></div>
              <div className="form-group"><label>Order Date *</label><input type="date" value={form.order_date} onChange={e => setForm(p => ({...p, order_date: e.target.value}))} required /></div>
              <div className="form-group"><label>Required Date</label><input type="date" value={form.required_date} onChange={e => setForm(p => ({...p, required_date: e.target.value}))} /></div>
            </div>
            <div className="form-row-3">
              <div className="form-group"><label>Driver</label><input value={form.driver_name} onChange={e => setForm(p => ({...p, driver_name: e.target.value}))} placeholder="Driver name" /></div>
              <div className="form-group"><label>Vehicle</label>
                <select value={form.vehicle} onChange={e => setForm(p => ({...p, vehicle: e.target.value}))}>
                  <option value="">Select...</option><option value="Van 1">Van 1</option><option value="Van 2">Van 2</option>
                </select></div>
              <div className="form-group"><label>Area / Route</label><input value={form.route_area} onChange={e => setForm(p => ({...p, route_area: e.target.value}))} placeholder="Auto from customer" /></div>
            </div>

            <div className="line-items-section sales">
              <h4>Order Items</h4>
              <div className="add-item-row">
                <select value={newItem.product_id} onChange={e => onProductSelect(e.target.value)}>
                  <option value="">Select product...</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku}) — Stock: {getStock(p.id)}</option>)}
                </select>
                <input type="number" placeholder="Qty" value={newItem.quantity_ordered} onChange={e => setNewItem(p => ({...p, quantity_ordered: e.target.value}))} min="1" />
                <input type="number" placeholder="Price" step="0.001" value={newItem.unit_price} onChange={e => setNewItem(p => ({...p, unit_price: e.target.value}))} />
                <input type="number" placeholder="Disc %" step="0.1" value={newItem.discount_percent} onChange={e => setNewItem(p => ({...p, discount_percent: e.target.value}))} min="0" max="100" style={{width: '80px'}} />
                <button type="button" className="add-item-btn" onClick={addLineItem}>+ Add</button>
              </div>
              {lineItems.length > 0 && (
                <table className="items-table"><thead><tr><th>Product</th><th>Stock</th><th>Qty</th><th>Price</th><th>Disc%</th><th>Total</th><th></th></tr></thead>
                  <tbody>
                    {lineItems.map((item, idx) => {
                      const lineTotal = item.quantity_ordered * item.unit_price * (1 - item.discount_percent / 100);
                      return (
                        <tr key={idx} className={item.quantity_ordered > item.available_stock ? 'stock-warning' : ''}>
                          <td>{item.product_name}</td>
                          <td className={item.available_stock < item.quantity_ordered ? 'negative' : 'positive'}>{item.available_stock}</td>
                          <td>{item.quantity_ordered}</td><td>{item.unit_price.toFixed(3)}</td><td>{item.discount_percent}%</td>
                          <td>{lineTotal.toFixed(3)}</td><td><button type="button" className="remove-btn" onClick={() => removeItem(idx)}>✕</button></td>
                        </tr>
                      );
                    })}
                    <tr className="totals-row"><td colSpan="5">Subtotal</td><td>{subtotal.toFixed(3)}</td><td></td></tr>
                    {totalDiscount > 0 && <tr className="totals-row"><td colSpan="5">Discount</td><td className="negative">-{totalDiscount.toFixed(3)}</td><td></td></tr>}
                    <tr className="totals-row"><td colSpan="5">VAT ({form.tax_rate}%)</td><td>{tax.toFixed(3)}</td><td></td></tr>
                    <tr className="totals-row grand"><td colSpan="5">Total</td><td>{(netSubtotal + tax).toFixed(3)} OMR</td><td></td></tr>
                  </tbody>
                </table>
              )}
            </div>
            <div className="form-group"><label>Notes</label><textarea value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))} rows="2" /></div>
            <button type="submit" className="submit-btn" disabled={lineItems.length === 0}>📝 Create Sales Order</button>
          </form>
        </div>
      )}

      <div className="filter-bar">
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="filter-select">
          <option value="">All Statuses</option><option value="draft">Draft</option><option value="confirmed">Confirmed</option>
          <option value="shipped">Shipped</option><option value="delivered">Delivered</option><option value="invoiced">Invoiced</option>
        </select>
      </div>

      {loading ? <div className="loading-state">Loading...</div> : (
        <div className="table-container"><table className="data-table">
          <thead><tr><th>SO #</th><th>Customer</th><th>Area</th><th>Date</th><th>Driver</th><th>Total</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {orders.length === 0 ? <tr><td colSpan="8" className="no-data">No orders found</td></tr> :
              orders.map(o => (
                <tr key={o.id}><td className="code">{o.order_number}</td><td>{o.customer_name}</td><td><span className="area-badge">{o.area || o.route_area || '-'}</span></td>
                  <td>{o.order_date}</td><td>{o.driver_name || '-'}</td>
                  <td className="value">{o.total_amount.toFixed(3)} OMR</td>
                  <td><span className="status-pill" style={{ backgroundColor: statusColor(o.status) }}>{o.status}</span></td>
                  <td><button className="view-btn" onClick={() => onViewOrder(o.id)}>👁️</button></td></tr>
              ))
            }
          </tbody>
        </table></div>
      )}
    </div>
  );
}
export default SalesOrderList;
