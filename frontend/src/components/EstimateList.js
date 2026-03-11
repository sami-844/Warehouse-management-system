import LoadingSpinner from './LoadingSpinner';
import React, { useState, useEffect } from 'react';
import { estimatesAPI, customerAPI, productAPI } from '../services/api';
import './Sales.css';
import { FileText } from 'lucide-react';

function EstimateList() {
  const [estimates, setEstimates] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [message, setMessage] = useState({ text: '', type: '' });
  const [form, setForm] = useState({
    customer_id: '', estimate_date: new Date().toISOString().slice(0, 10),
    valid_until: '', po_number: '', tax_rate: 5,
    notes: 'Thank you for your business', terms: 'Payment due within 30 days'
  });
  const [lineItems, setLineItems] = useState([]);
  const [newItem, setNewItem] = useState({ product_id: '', quantity: '', unit_price: '', discount: '0', tax_rate: '5' });

  useEffect(() => { load(); loadCustomers(); loadProducts(); }, [filterStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterStatus) params.status = filterStatus;
      if (searchTerm) params.search = searchTerm;
      const d = await estimatesAPI.list(params);
      setEstimates(Array.isArray(d) ? d : (d?.items || []));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };
  const loadCustomers = async () => { try { const d = await customerAPI.list({ active_only: true }); setCustomers(Array.isArray(d) ? d : (d?.items || [])); } catch (e) {} };
  const loadProducts = async () => { try { const res = await productAPI.getAll(); setProducts((res.data || []).filter(p => p.is_active)); } catch (e) {} };

  // Line items
  const addLineItem = () => {
    if (!newItem.product_id || !newItem.quantity || !newItem.unit_price) return;
    const prod = products.find(p => p.id === parseInt(newItem.product_id));
    setLineItems(prev => [...prev, {
      product_id: parseInt(newItem.product_id), quantity: parseFloat(newItem.quantity),
      unit_price: parseFloat(newItem.unit_price), discount: parseFloat(newItem.discount) || 0,
      tax_rate: parseFloat(newItem.tax_rate) || 5,
      product_name: prod?.name || '', sku: prod?.sku || ''
    }]);
    setNewItem({ product_id: '', quantity: '', unit_price: '', discount: '0', tax_rate: '5' });
  };
  const onProductSelect = (productId) => {
    const prod = products.find(p => p.id === parseInt(productId));
    setNewItem(prev => ({ ...prev, product_id: productId, unit_price: prod?.selling_price || '' }));
  };
  const removeItem = (idx) => setLineItems(prev => prev.filter((_, i) => i !== idx));

  // Walk-in customer
  const selectWalkin = () => {
    const walkin = customers.find(c => c.code === 'WALKIN' || c.name === 'Walk-in Customer');
    if (walkin) setForm(prev => ({ ...prev, customer_id: String(walkin.id) }));
    else setMessage({ text: 'Walk-in Customer not found. Run the migration first.', type: 'error' });
  };

  // Totals
  const subtotal = lineItems.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const totalDiscount = lineItems.reduce((s, i) => s + i.quantity * i.unit_price * (i.discount / 100), 0);
  const netSubtotal = subtotal - totalDiscount;
  const totalTax = lineItems.reduce((s, i) => {
    const net = i.quantity * i.unit_price * (1 - i.discount / 100);
    return s + net * (i.tax_rate / 100);
  }, 0);

  // KPI stats
  const total = estimates.length;
  const accepted = estimates.filter(e => e.status === 'accepted').length;
  const pending = estimates.filter(e => ['draft', 'sent'].includes(e.status)).length;
  const declinedExpired = estimates.filter(e => ['declined', 'expired'].includes(e.status)).length;

  const resetForm = () => {
    setForm({ customer_id: '', estimate_date: new Date().toISOString().slice(0, 10), valid_until: '', po_number: '', tax_rate: 5, notes: 'Thank you for your business', terms: 'Payment due within 30 days' });
    setLineItems([]);
    setEditId(null);
    setShowCreate(false);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (lineItems.length === 0) { setMessage({ text: 'Add at least one item', type: 'error' }); return; }
    try {
      const payload = {
        customer_id: parseInt(form.customer_id),
        estimate_date: form.estimate_date,
        valid_until: form.valid_until || null,
        po_number: form.po_number || null,
        notes: form.notes || null,
        terms: form.terms || null,
        items: lineItems.map(i => ({
          product_id: i.product_id, description: i.product_name,
          quantity: i.quantity, unit_price: i.unit_price,
          discount: i.discount, tax_rate: i.tax_rate
        }))
      };
      if (editId) {
        await estimatesAPI.update(editId, payload);
        setMessage({ text: 'Estimate updated successfully', type: 'success' });
      } else {
        const result = await estimatesAPI.create(payload);
        setMessage({ text: `${result.estimate_number} created! Total: ${(Number(result.total_amount) || 0).toFixed(3)} OMR`, type: 'success' });
      }
      resetForm();
      load();
    } catch (e) { setMessage({ text: `${e.response?.data?.detail || e.message}`, type: 'error' }); }
  };

  const handleEdit = async (est) => {
    try {
      const detail = await estimatesAPI.get(est.id);
      setForm({
        customer_id: String(detail.customer?.id || ''), estimate_date: detail.estimate_date,
        valid_until: detail.valid_until || '', po_number: detail.po_number || '',
        tax_rate: 5, notes: detail.notes || '', terms: detail.terms || ''
      });
      setLineItems((detail.items || []).map(i => ({
        product_id: i.product_id, quantity: i.quantity, unit_price: i.unit_price,
        discount: i.discount, tax_rate: i.tax_rate,
        product_name: i.product_name, sku: i.sku
      })));
      setEditId(est.id);
      setShowCreate(true);
    } catch (e) { setMessage({ text: 'Failed to load estimate', type: 'error' }); }
  };

  const handleConvert = async (est) => {
    if (!window.confirm(`Convert ${est.estimate_number} to a Sales Order?`)) return;
    try {
      const result = await estimatesAPI.convert(est.id);
      setMessage({ text: result.message || `Sales Order ${result.order_number} created`, type: 'success' });
      load();
    } catch (e) { setMessage({ text: `${e.response?.data?.detail || e.message}`, type: 'error' }); }
  };

  const handleDelete = async (est) => {
    if (!window.confirm(`Delete ${est.estimate_number}?`)) return;
    try {
      await estimatesAPI.remove(est.id);
      setMessage({ text: 'Estimate deleted', type: 'success' });
      load();
    } catch (e) { setMessage({ text: `${e.response?.data?.detail || e.message}`, type: 'error' }); }
  };

  const statusColor = (s) => ({
    draft: '#6b7280', sent: '#2563eb', accepted: '#16a34a', declined: '#dc2626', expired: '#d97706'
  }[s] || '#6b7280');

  return (
    <div className="sales-container">
      <div className="page-header">
        <div className="header-content">
          <div className="header-icon so" style={{ background: '#7c3aed' }}><FileText size={20} /></div>
          <div><h1>Estimates / Quotations</h1><p>Create quotes and convert to sales orders</p></div>
        </div>
        <button className="action-btn primary" onClick={() => { if (showCreate) resetForm(); else setShowCreate(true); }}>
          {showCreate ? '\u2715 Cancel' : '+ New Estimate'}
        </button>
      </div>

      {message.text && <div className={`message ${message.type}`} onClick={() => setMessage({ text: '', type: '' })} style={{ cursor: 'pointer' }}>{message.text}</div>}

      {/* KPI Cards */}
      <div className="stats-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Total Estimates', value: total, color: '#1a2332' },
          { label: 'Accepted', value: accepted, color: '#16a34a' },
          { label: 'Pending', value: pending, color: '#2563eb' },
          { label: 'Declined / Expired', value: declinedExpired, color: '#dc2626' },
        ].map((s, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: 8, padding: '16px 20px', borderLeft: `4px solid ${s.color}` }}>
            <div style={{ fontSize: 12, color: '#6b7280', textTransform: 'uppercase' }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Create / Edit Form */}
      {showCreate && (
        <div className="form-card"><h3>{editId ? 'Edit Estimate' : 'Create Estimate'}</h3>
          <form onSubmit={handleCreate}>
            <div className="form-row-3">
              <div className="form-group"><label>Customer *</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <select value={form.customer_id} onChange={e => setForm(p => ({ ...p, customer_id: e.target.value }))} required style={{ flex: 1 }}>
                    <option value="">Select customer...</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.area || c.code})</option>)}
                  </select>
                  <button type="button" onClick={selectWalkin} style={{ background: '#6C757D', color: 'white', border: 'none', borderRadius: 4, padding: '6px 12px', cursor: 'pointer', whiteSpace: 'nowrap', fontSize: 12 }}>Walk-in</button>
                </div>
              </div>
              <div className="form-group"><label>Estimate Date *</label><input type="date" value={form.estimate_date} onChange={e => setForm(p => ({ ...p, estimate_date: e.target.value }))} required /></div>
              <div className="form-group"><label>Valid Until</label><input type="date" value={form.valid_until} onChange={e => setForm(p => ({ ...p, valid_until: e.target.value }))} /></div>
            </div>
            <div className="form-row-3">
              <div className="form-group"><label>PO Number</label><input value={form.po_number} onChange={e => setForm(p => ({ ...p, po_number: e.target.value }))} placeholder="Customer PO reference" /></div>
              <div className="form-group" />
              <div className="form-group" />
            </div>

            <div className="line-items-section sales">
              <h4>Estimate Items</h4>
              <div className="add-item-row">
                <select value={newItem.product_id} onChange={e => onProductSelect(e.target.value)}>
                  <option value="">Select product...</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                </select>
                <input type="number" placeholder="Qty" value={newItem.quantity} onChange={e => setNewItem(p => ({ ...p, quantity: e.target.value }))} min="0.001" step="0.001" />
                <input type="number" placeholder="Price" step="0.001" value={newItem.unit_price} onChange={e => setNewItem(p => ({ ...p, unit_price: e.target.value }))} />
                <input type="number" placeholder="Disc %" step="0.1" value={newItem.discount} onChange={e => setNewItem(p => ({ ...p, discount: e.target.value }))} min="0" max="100" style={{ width: '80px' }} />
                <input type="number" placeholder="Tax %" step="0.1" value={newItem.tax_rate} onChange={e => setNewItem(p => ({ ...p, tax_rate: e.target.value }))} min="0" max="100" style={{ width: '80px' }} />
                <button type="button" className="add-item-btn" onClick={addLineItem}>+ Add</button>
              </div>
              {lineItems.length > 0 && (
                <table className="items-table">
                  <thead><tr><th>Product</th><th>Qty</th><th>Price</th><th>Disc%</th><th>Tax%</th><th>Total</th><th></th></tr></thead>
                  <tbody>
                    {lineItems.map((item, idx) => {
                      const lineNet = item.quantity * item.unit_price * (1 - item.discount / 100);
                      return (
                        <tr key={idx}>
                          <td>{item.product_name}</td>
                          <td>{item.quantity}</td>
                          <td>{(Number(item.unit_price) || 0).toFixed(3)}</td>
                          <td>{item.discount}%</td>
                          <td>{item.tax_rate}%</td>
                          <td>{(lineNet || 0).toFixed(3)}</td>
                          <td><button type="button" className="remove-btn" onClick={() => removeItem(idx)}>{'\u2715'}</button></td>
                        </tr>
                      );
                    })}
                    <tr className="totals-row"><td colSpan="5">Subtotal</td><td>{subtotal.toFixed(3)}</td><td></td></tr>
                    {totalDiscount > 0 && <tr className="totals-row"><td colSpan="5">Discount</td><td className="negative">-{totalDiscount.toFixed(3)}</td><td></td></tr>}
                    <tr className="totals-row"><td colSpan="5">VAT</td><td>{totalTax.toFixed(3)}</td><td></td></tr>
                    <tr className="totals-row grand"><td colSpan="5">Grand Total</td><td>{(netSubtotal + totalTax).toFixed(3)} OMR</td><td></td></tr>
                  </tbody>
                </table>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
              <div className="form-group"><label>Notes</label><textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows="2" /></div>
              <div className="form-group"><label>Terms &amp; Conditions</label><textarea value={form.terms} onChange={e => setForm(p => ({ ...p, terms: e.target.value }))} rows="2" /></div>
            </div>
            <button type="submit" className="submit-btn" disabled={lineItems.length === 0}>
              {editId ? 'Update Estimate' : 'Save Draft'}
            </button>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="filter-bar" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="filter-select">
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="accepted">Accepted</option>
          <option value="declined">Declined</option>
          <option value="expired">Expired</option>
        </select>
        <input placeholder="Search estimate # or customer..." value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') load(); }}
          style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 13, width: 240 }}
        />
        <button onClick={load} style={{ padding: '6px 12px', background: '#1a2332', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>Search</button>
      </div>

      {/* Table */}
      {loading ? <LoadingSpinner /> : (
        <div className="table-container"><table className="data-table">
          <thead><tr><th>Estimate #</th><th>Customer</th><th>Date</th><th>Valid Until</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {estimates.length === 0 ? <tr><td colSpan="7" className="no-data">No estimates found</td></tr> :
              estimates.map(est => (
                <tr key={est.id}>
                  <td className="code">{est.estimate_number}</td>
                  <td>{est.customer_name}</td>
                  <td>{est.estimate_date}</td>
                  <td>{est.valid_until || '-'}</td>
                  <td className="value">{(Number(est.total_amount) || 0).toFixed(3)} OMR</td>
                  <td><span className="status-pill" style={{ backgroundColor: statusColor(est.status) }}>{est.status}</span></td>
                  <td style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {est.status !== 'accepted' && (
                      <button onClick={() => handleEdit(est)} style={{ padding: '4px 8px', fontSize: 11, background: '#e5e7eb', color: '#1a2332', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Edit</button>
                    )}
                    {['draft', 'sent'].includes(est.status) && (
                      <button onClick={() => handleConvert(est)} style={{ padding: '4px 8px', fontSize: 11, background: '#16a34a', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', whiteSpace: 'nowrap' }}>Convert to Order</button>
                    )}
                    {['draft', 'declined', 'expired'].includes(est.status) && (
                      <button onClick={() => handleDelete(est)} style={{ padding: '4px 8px', fontSize: 11, background: '#dc2626', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Delete</button>
                    )}
                  </td>
                </tr>
              ))
            }
          </tbody>
        </table></div>
      )}
    </div>
  );
}
export default EstimateList;
