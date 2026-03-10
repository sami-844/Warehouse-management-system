import React, { useState, useEffect } from 'react';
import { salesAPI, productAPI, customerAPI } from '../services/api';
import './Sales.css';
import { Percent } from 'lucide-react';

function PricingRules() {
  const [rules, setRules] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [previewCustomer, setPreviewCustomer] = useState('');
  const [previewPrices, setPreviewPrices] = useState([]);
  const [form, setForm] = useState({ rule_name: '', product_id: '', customer_id: '', min_quantity: 1, discount_percent: '', special_price: '', valid_from: '', valid_to: '' });

  useEffect(() => { load(); loadProducts(); loadCustomers(); }, []);

  const load = async () => { setLoading(true); try { setRules(await salesAPI.listPricingRules()); } catch(e) {} finally { setLoading(false); } };
  const loadProducts = async () => { try { const res = await productAPI.getAll(); setProducts(res.data || []); } catch(e) {} };
  const loadCustomers = async () => { try { setCustomers(await customerAPI.list()); } catch(e) {} };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = { ...form, min_quantity: parseInt(form.min_quantity) || 1 };
      if (data.product_id) data.product_id = parseInt(data.product_id); else delete data.product_id;
      if (data.customer_id) data.customer_id = parseInt(data.customer_id); else delete data.customer_id;
      if (data.discount_percent) data.discount_percent = parseFloat(data.discount_percent); else data.discount_percent = 0;
      if (data.special_price) data.special_price = parseFloat(data.special_price); else delete data.special_price;
      if (!data.valid_from) delete data.valid_from;
      if (!data.valid_to) delete data.valid_to;
      await salesAPI.createPricingRule(data);
      setMessage({ text: 'Pricing rule created!', type: 'success' });
      setShowForm(false); setForm({ rule_name: '', product_id: '', customer_id: '', min_quantity: 1, discount_percent: '', special_price: '', valid_from: '', valid_to: '' }); load();
    } catch(e) { setMessage({ text: `${e.response?.data?.detail || e.message}`, type: 'error' }); }
  };

  const deleteRule = async (id) => {
    if (!window.confirm('Delete this pricing rule?')) return;
    try { await salesAPI.deletePricingRule(id); load(); } catch(e) { alert(e.message); }
  };

  const loadPreview = async (customerId) => {
    setPreviewCustomer(customerId);
    if (!customerId) { setPreviewPrices([]); return; }
    try { setPreviewPrices(await salesAPI.customerPrices(parseInt(customerId))); } catch(e) { setPreviewPrices([]); }
  };

  return (
    <div className="sales-container">
      <div className="page-header"><div className="header-content"><div className="header-icon pricing"><Percent size={20} /></div><div><h1>Pricing Rules</h1><p>Customer discounts, volume pricing, promotions</p></div></div>
        <button className="action-btn primary" onClick={() => setShowForm(!showForm)}>{showForm ? '✕ Cancel' : '+ New Rule'}</button></div>

      {message.text && <div className={`message ${message.type}`}>{message.text}</div>}

      {showForm && (
        <div className="form-card"><h3>Create Pricing Rule</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-row-2">
              <div className="form-group"><label>Rule Name</label><input value={form.rule_name} onChange={e => setForm(p => ({...p, rule_name: e.target.value}))} placeholder="e.g. Bulk Discount Oil, VIP Customer Rate" /></div>
              <div className="form-group"><label>Product</label>
                <select value={form.product_id} onChange={e => setForm(p => ({...p, product_id: e.target.value}))}>
                  <option value="">All Products</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                </select></div>
            </div>
            <div className="form-row-3">
              <div className="form-group"><label>Customer</label>
                <select value={form.customer_id} onChange={e => setForm(p => ({...p, customer_id: e.target.value}))}>
                  <option value="">All Customers</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select></div>
              <div className="form-group"><label>Min Quantity</label><input type="number" value={form.min_quantity} onChange={e => setForm(p => ({...p, min_quantity: e.target.value}))} min="1" /></div>
              <div className="form-group"><label>Discount %</label><input type="number" step="0.1" value={form.discount_percent} onChange={e => setForm(p => ({...p, discount_percent: e.target.value}))} placeholder="e.g. 5" /></div>
            </div>
            <div className="form-row-3">
              <div className="form-group"><label>Special Price (override)</label><input type="number" step="0.001" value={form.special_price} onChange={e => setForm(p => ({...p, special_price: e.target.value}))} placeholder="Leave empty to use discount" /></div>
              <div className="form-group"><label>Valid From</label><input type="date" value={form.valid_from} onChange={e => setForm(p => ({...p, valid_from: e.target.value}))} /></div>
              <div className="form-group"><label>Valid To</label><input type="date" value={form.valid_to} onChange={e => setForm(p => ({...p, valid_to: e.target.value}))} /></div>
            </div>
            <button type="submit" className="submit-btn">Create Rule</button>
          </form>
        </div>
      )}

      {/* Customer Price Preview */}
      <div className="price-preview">
        <div className="filter-bar">
          <select value={previewCustomer} onChange={e => loadPreview(e.target.value)} className="filter-select">
            <option value="">Preview customer prices...</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        {previewPrices.length > 0 && (
          <div className="table-container"><table className="data-table compact">
            <thead><tr><th>Product</th><th>SKU</th><th>Base Price</th><th>Discount</th><th>Special</th><th>Effective Price</th><th>Rule</th></tr></thead>
            <tbody>
              {previewPrices.map(p => (
                <tr key={p.product_id} className={p.discount_percent > 0 || p.special_price ? 'has-discount' : ''}>
                  <td>{p.name}</td><td className="code">{p.sku}</td>
                  <td>{(Number(p.base_price) || 0).toFixed(3)}</td>
                  <td className={p.discount_percent > 0 ? 'positive' : ''}>{p.discount_percent > 0 ? `${p.discount_percent}%` : '-'}</td>
                  <td>{p.special_price ? (Number(p.special_price) || 0).toFixed(3) : '-'}</td>
                  <td className="value highlight-value">{(Number(p.effective_price) || 0).toFixed(3)}</td>
                  <td>{p.rule || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>

      {/* Rules List */}
      <h3 style={{ margin: '20px 0 12px' }}>Active Rules</h3>
      {loading ? <div className="loading-state">Loading...</div> : (
        <div className="table-container"><table className="data-table">
          <thead><tr><th>Rule</th><th>Product</th><th>Customer</th><th>Min Qty</th><th>Discount</th><th>Special Price</th><th>Valid</th><th>Active</th><th></th></tr></thead>
          <tbody>
            {rules.length === 0 ? <tr><td colSpan="9" className="no-data">No pricing rules. Products use default selling_price.</td></tr> :
              rules.map(r => (
                <tr key={r.id}>
                  <td className="name">{r.rule_name || '-'}</td>
                  <td>{r.product_name || 'All'}</td><td>{r.customer_name}</td>
                  <td className="center">{r.min_quantity}</td>
                  <td className={r.discount_percent > 0 ? 'positive' : ''}>{r.discount_percent > 0 ? `${r.discount_percent}%` : '-'}</td>
                  <td className="value">{r.special_price ? `${(Number(r.special_price) || 0).toFixed(3)} OMR` : '-'}</td>
                  <td>{r.valid_from ? `${r.valid_from} → ${r.valid_to || '∞'}` : 'Always'}</td>
                  <td>{r.is_active ? 'Yes' : 'No'}</td>
                  <td><button className="remove-btn" onClick={() => deleteRule(r.id)}>Delete</button></td>
                </tr>
              ))
            }
          </tbody>
        </table></div>
      )}
    </div>
  );
}
export default PricingRules;
