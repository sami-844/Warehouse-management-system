import React, { useState, useEffect } from 'react';
import { customerAPI, csvImportAPI } from '../services/api';
import CsvImportModal from './CsvImportModal';
import './Sales.css';
import { Users } from 'lucide-react';

function CustomerList() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState('');
  const [filterArea, setFilterArea] = useState('');
  const [areas, setAreas] = useState([]);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [showImport, setShowImport] = useState(false);
  const [form, setForm] = useState({
    code: '', name: '', business_type: 'Grocery', contact_person: '', email: '', phone: '', mobile: '',
    address_line1: '', city: '', area: '', latitude: '', longitude: '',
    payment_terms_days: 7, credit_limit: '', preferred_delivery_day: '', delivery_instructions: '', notes: ''
  });

  useEffect(() => { load(); loadAreas(); }, [filterArea]);

  const load = async () => { setLoading(true); try { const params = {}; if (filterArea) params.area = filterArea; const dc = await customerAPI.list(params); setCustomers(Array.isArray(dc) ? dc : (dc?.items || [])); } catch(e) { console.error(e); } finally { setLoading(false); } };
  const loadAreas = async () => { try { setAreas(await customerAPI.getAreas()); } catch(e) {} };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = { ...form, payment_terms_days: parseInt(form.payment_terms_days) || 7 };
      if (data.credit_limit) data.credit_limit = parseFloat(data.credit_limit); else delete data.credit_limit;
      if (data.latitude) data.latitude = parseFloat(data.latitude); else delete data.latitude;
      if (data.longitude) data.longitude = parseFloat(data.longitude); else delete data.longitude;
      if (editingId) { await customerAPI.update(editingId, data); setMessage({ text: 'Customer updated!', type: 'success' }); }
      else { await customerAPI.create(data); setMessage({ text: 'Customer created!', type: 'success' }); }
      setShowForm(false); setEditingId(null); resetForm(); load(); loadAreas();
    } catch(e) { setMessage({ text: `${e.response?.data?.detail || e.message}`, type: 'error' }); }
  };

  const editCustomer = (c) => {
    setForm({ code: c.code, name: c.name, business_type: c.business_type || 'Grocery', contact_person: c.contact_person || '', email: c.email || '', phone: c.phone || '', mobile: c.mobile || '', address_line1: c.address_line1 || '', city: c.city || '', area: c.area || '', latitude: c.latitude || '', longitude: c.longitude || '', payment_terms_days: c.payment_terms_days || 7, credit_limit: c.credit_limit || '', preferred_delivery_day: c.preferred_delivery_day || '', delivery_instructions: c.delivery_instructions || '', notes: c.notes || '' });
    setEditingId(c.id); setShowForm(true);
  };

  const resetForm = () => setForm({ code: '', name: '', business_type: 'Grocery', contact_person: '', email: '', phone: '', mobile: '', address_line1: '', city: '', area: '', latitude: '', longitude: '', payment_terms_days: 7, credit_limit: '', preferred_delivery_day: '', delivery_instructions: '', notes: '' });

  const filtered = customers.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.code.toLowerCase().includes(search.toLowerCase()) || (c.area || '').toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="sales-container">
      <div className="page-header"><div className="header-content"><div className="header-icon customer"><Users size={20} /></div><div><h1>Customers</h1><p>Manage shops and delivery routes</p></div></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="action-btn" onClick={() => setShowImport(true)} style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }}>Import CSV</button>
          <button className="action-btn primary" onClick={() => { resetForm(); setEditingId(null); setShowForm(!showForm); }}>{showForm ? '✕ Cancel' : '+ New Customer'}</button>
        </div>
      </div>
      {showImport && (
        <CsvImportModal
          type="customers"
          onClose={() => setShowImport(false)}
          onImport={async (rows) => {
            try {
              const res = await csvImportAPI.importCustomers(rows);
              setMessage({ text: `Imported ${res.created} customers. Skipped: ${res.skipped}.`, type: 'success' });
              setShowImport(false); load(); loadAreas();
            } catch(e) { setMessage({ text: 'Import failed: ' + (e.response?.data?.detail || e.message), type: 'error' }); setShowImport(false); }
          }}
        />
      )}

      {message.text && <div className={`message ${message.type}`}>{message.text}</div>}

      {showForm && (
        <div className="form-card"><h3>{editingId ? 'Edit Customer' : 'New Customer'}</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-row-3">
              <div className="form-group"><label>Code *</label><input value={form.code} onChange={e => setForm(p => ({...p, code: e.target.value}))} required placeholder="CUST-001" disabled={!!editingId} /></div>
              <div className="form-group"><label>Shop Name *</label><input value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} required placeholder="Al Noor Grocery" /></div>
              <div className="form-group"><label>Type</label>
                <select value={form.business_type} onChange={e => setForm(p => ({...p, business_type: e.target.value}))}>
                  <option>Grocery</option><option>Market</option><option>Supermarket</option><option>Restaurant</option><option>Hotel</option><option>Wholesale</option>
                </select></div>
            </div>
            <div className="form-row-3">
              <div className="form-group"><label>Contact Person</label><input value={form.contact_person} onChange={e => setForm(p => ({...p, contact_person: e.target.value}))} /></div>
              <div className="form-group"><label>Phone</label><input value={form.phone} onChange={e => setForm(p => ({...p, phone: e.target.value}))} placeholder="+968 2412 3456" /></div>
              <div className="form-group"><label>Mobile</label><input value={form.mobile} onChange={e => setForm(p => ({...p, mobile: e.target.value}))} /></div>
            </div>
            <div className="form-row-3">
              <div className="form-group"><label>Address</label><input value={form.address_line1} onChange={e => setForm(p => ({...p, address_line1: e.target.value}))} /></div>
              <div className="form-group"><label>City</label><input value={form.city} onChange={e => setForm(p => ({...p, city: e.target.value}))} placeholder="Muscat" /></div>
              <div className="form-group"><label>Area / Route</label><input value={form.area} onChange={e => setForm(p => ({...p, area: e.target.value}))} placeholder="Al Khuwair" /></div>
            </div>
            <div className="form-row-3">
              <div className="form-group"><label>Payment Terms (days)</label>
                <select value={form.payment_terms_days} onChange={e => setForm(p => ({...p, payment_terms_days: e.target.value}))}>
                  <option value="0">Cash on Delivery</option><option value="7">Net 7 days</option><option value="14">Net 14 days</option><option value="30">Net 30 days</option>
                </select></div>
              <div className="form-group"><label>Credit Limit (OMR)</label><input type="number" step="0.001" value={form.credit_limit} onChange={e => setForm(p => ({...p, credit_limit: e.target.value}))} /></div>
              <div className="form-group"><label>Delivery Day</label>
                <select value={form.preferred_delivery_day} onChange={e => setForm(p => ({...p, preferred_delivery_day: e.target.value}))}>
                  <option value="">Any Day</option><option>Sunday</option><option>Monday</option><option>Tuesday</option><option>Wednesday</option><option>Thursday</option><option>Saturday</option>
                </select></div>
            </div>
            <div className="form-row-2">
              <div className="form-group"><label>GPS Latitude</label><input type="number" step="any" value={form.latitude} onChange={e => setForm(p => ({...p, latitude: e.target.value}))} placeholder="23.5880" /></div>
              <div className="form-group"><label>GPS Longitude</label><input type="number" step="any" value={form.longitude} onChange={e => setForm(p => ({...p, longitude: e.target.value}))} placeholder="58.3829" /></div>
            </div>
            <div className="form-group"><label>Delivery Instructions</label><textarea value={form.delivery_instructions} onChange={e => setForm(p => ({...p, delivery_instructions: e.target.value}))} rows="2" placeholder="Back entrance, ask for manager..." /></div>
            <button type="submit" className="submit-btn">{editingId ? 'Update' : 'Create Customer'}</button>
          </form>
        </div>
      )}

      <div className="filter-bar">
        <input type="text" placeholder="Search name, code, area..." value={search} onChange={e => setSearch(e.target.value)} className="search-input" />
        <select value={filterArea} onChange={e => setFilterArea(e.target.value)} className="filter-select">
          <option value="">All Areas</option>
          {areas.map(a => <option key={a.area} value={a.area}>{a.area} ({a.customer_count})</option>)}
        </select>
      </div>

      {loading ? <div className="loading-state">Loading...</div> : (
        <div className="table-container"><table className="data-table">
          <thead><tr><th>Code</th><th>Shop Name</th><th>Type</th><th>Area</th><th>Phone</th><th>Terms</th><th>Delivery</th><th>Orders</th><th>Outstanding</th><th></th></tr></thead>
          <tbody>
            {filtered.length === 0 ? <tr><td colSpan="10" className="no-data">No customers found</td></tr> :
              filtered.map(c => (
                <tr key={c.id} className={!c.is_active ? 'inactive' : ''}>
                  <td className="code">{c.code}</td><td className="name">{c.name}</td>
                  <td><span className="type-badge">{c.business_type || 'Grocery'}</span></td>
                  <td><span className="area-badge">{c.area || '-'}</span></td>
                  <td>{c.phone || c.mobile || '-'}</td>
                  <td>{c.payment_terms_days === 0 ? 'COD' : `Net ${c.payment_terms_days}d`}</td>
                  <td>{c.preferred_delivery_day || 'Any'}</td>
                  <td className="center">{c.total_orders}</td>
                  <td className={`value ${(Number(c.outstanding_balance) || 0) > 0 ? 'negative' : ''}`}>{(Number(c.outstanding_balance) || 0) > 0 ? `${(Number(c.outstanding_balance)).toFixed(3)}` : '-'}</td>
                  <td><button className="edit-btn" onClick={() => editCustomer(c)}>Edit</button></td>
                </tr>
              ))
            }
          </tbody>
        </table></div>
      )}
    </div>
  );
}
export default CustomerList;
