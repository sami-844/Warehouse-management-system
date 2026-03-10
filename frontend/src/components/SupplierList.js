import React, { useState, useEffect } from 'react';
import { supplierAPI } from '../services/api';
import './Purchasing.css';

function SupplierList() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState({ text: '', type: '' });
  const [form, setForm] = useState({
    code: '', name: '', contact_person: '', email: '', phone: '', mobile: '',
    address_line1: '', city: '', country: '', payment_terms_days: 30,
    credit_limit: '', tax_id: '', bank_name: '', bank_account: '', notes: ''
  });

  useEffect(() => { load(); }, []);

  const load = async () => { setLoading(true); try { const d = await supplierAPI.list(); setSuppliers(Array.isArray(d) ? d : (d?.items || d?.suppliers || [])); } catch(e) { console.error(e); } finally { setLoading(false); } };

  const handleSubmit = async (e) => {
    e.preventDefault(); setMessage({ text: '', type: '' });
    try {
      const data = { ...form, payment_terms_days: parseInt(form.payment_terms_days) || 30 };
      if (data.credit_limit) data.credit_limit = parseFloat(data.credit_limit);
      else delete data.credit_limit;
      if (editingId) { await supplierAPI.update(editingId, data); setMessage({ text: 'Supplier updated!', type: 'success' }); }
      else { await supplierAPI.create(data); setMessage({ text: 'Supplier created!', type: 'success' }); }
      setShowForm(false); setEditingId(null); resetForm(); load();
    } catch(e) { setMessage({ text: `${e.response?.data?.detail || e.message}`, type: 'error' }); }
  };

  const editSupplier = (s) => {
    setForm({ code: s.code, name: s.name, contact_person: s.contact_person || '', email: s.email || '', phone: s.phone || '', mobile: s.mobile || '', address_line1: s.address_line1 || '', city: s.city || '', country: s.country || '', payment_terms_days: s.payment_terms_days || 30, credit_limit: s.credit_limit || '', tax_id: s.tax_id || '', bank_name: s.bank_name || '', bank_account: s.bank_account || '', notes: s.notes || '' });
    setEditingId(s.id); setShowForm(true);
  };

  const resetForm = () => setForm({ code: '', name: '', contact_person: '', email: '', phone: '', mobile: '', address_line1: '', city: '', country: '', payment_terms_days: 30, credit_limit: '', tax_id: '', bank_name: '', bank_account: '', notes: '' });

  const filtered = suppliers.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || s.code.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="purchasing-container">
      <div className="page-header">
        <div className="header-content"><div className="header-icon supplier"></div><div><h1>Suppliers</h1><p>Manage your product suppliers</p></div></div>
        <button className="action-btn primary" onClick={() => { resetForm(); setEditingId(null); setShowForm(!showForm); }}>{showForm ? '✕ Cancel' : '+ New Supplier'}</button>
      </div>

      {message.text && <div className={`message ${message.type}`}>{message.text}</div>}

      {showForm && (
        <div className="form-card">
          <h3>{editingId ? 'Edit Supplier' : 'New Supplier'}</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-row-3">
              <div className="form-group"><label>Code *</label><input value={form.code} onChange={e => setForm(p => ({...p, code: e.target.value}))} required placeholder="SUP-001" disabled={!!editingId} /></div>
              <div className="form-group"><label>Name *</label><input value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} required placeholder="Al Jazira Foods LLC" /></div>
              <div className="form-group"><label>Contact Person</label><input value={form.contact_person} onChange={e => setForm(p => ({...p, contact_person: e.target.value}))} placeholder="Ahmed" /></div>
            </div>
            <div className="form-row-3">
              <div className="form-group"><label>Email</label><input type="email" value={form.email} onChange={e => setForm(p => ({...p, email: e.target.value}))} placeholder="ahmed@supplier.com" /></div>
              <div className="form-group"><label>Phone</label><input value={form.phone} onChange={e => setForm(p => ({...p, phone: e.target.value}))} placeholder="+968 2412 3456" /></div>
              <div className="form-group"><label>Mobile</label><input value={form.mobile} onChange={e => setForm(p => ({...p, mobile: e.target.value}))} placeholder="+968 9123 4567" /></div>
            </div>
            <div className="form-row-3">
              <div className="form-group"><label>Address</label><input value={form.address_line1} onChange={e => setForm(p => ({...p, address_line1: e.target.value}))} /></div>
              <div className="form-group"><label>City</label><input value={form.city} onChange={e => setForm(p => ({...p, city: e.target.value}))} placeholder="Dubai" /></div>
              <div className="form-group"><label>Country</label><input value={form.country} onChange={e => setForm(p => ({...p, country: e.target.value}))} placeholder="UAE" /></div>
            </div>
            <div className="form-row-3">
              <div className="form-group"><label>Payment Terms (days)</label><input type="number" value={form.payment_terms_days} onChange={e => setForm(p => ({...p, payment_terms_days: e.target.value}))} /></div>
              <div className="form-group"><label>Credit Limit (OMR)</label><input type="number" step="0.001" value={form.credit_limit} onChange={e => setForm(p => ({...p, credit_limit: e.target.value}))} /></div>
              <div className="form-group"><label>Tax ID / VAT</label><input value={form.tax_id} onChange={e => setForm(p => ({...p, tax_id: e.target.value}))} /></div>
            </div>
            <div className="form-row-2">
              <div className="form-group"><label>Bank Name</label><input value={form.bank_name} onChange={e => setForm(p => ({...p, bank_name: e.target.value}))} /></div>
              <div className="form-group"><label>Bank Account</label><input value={form.bank_account} onChange={e => setForm(p => ({...p, bank_account: e.target.value}))} /></div>
            </div>
            <div className="form-group"><label>Notes</label><textarea value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))} rows="2" /></div>
            <button type="submit" className="submit-btn">{editingId ? 'Update Supplier' : 'Create Supplier'}</button>
          </form>
        </div>
      )}

      <div className="filter-bar"><input type="text" placeholder="Search suppliers..." value={search} onChange={e => setSearch(e.target.value)} className="search-input" /></div>

      {loading ? <div className="loading-state">Loading suppliers...</div> : (
        <div className="table-container">
          <table className="data-table">
            <thead><tr><th>Code</th><th>Name</th><th>Contact</th><th>Phone</th><th>City / Country</th><th>Terms</th><th>Orders</th><th>Outstanding</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.length === 0 ? <tr><td colSpan="9" className="no-data">No suppliers found. Create your first supplier!</td></tr> :
                filtered.map(s => (
                  <tr key={s.id} className={!s.is_active ? 'inactive' : ''}>
                    <td className="code">{s.code}</td><td className="name">{s.name}</td>
                    <td>{s.contact_person || '-'}</td><td>{s.phone || s.mobile || '-'}</td>
                    <td>{[s.city, s.country].filter(Boolean).join(', ') || '-'}</td>
                    <td>Net {s.payment_terms_days}d</td>
                    <td className="center">{s.total_orders}</td>
                    <td className={`value ${(Number(s.outstanding_balance) || 0) > 0 ? 'negative' : ''}`}>{(Number(s.outstanding_balance) || 0) > 0 ? `${(Number(s.outstanding_balance)).toFixed(3)} OMR` : '-'}</td>
                    <td><button className="edit-btn" onClick={() => editSupplier(s)}>Edit</button></td>
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
export default SupplierList;
