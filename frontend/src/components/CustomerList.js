import LoadingSpinner from './LoadingSpinner';
import EmptyState from './EmptyState';
import React, { useState, useEffect } from 'react';
import { customerAPI, salesAPI, csvImportAPI } from '../services/api';
import CsvImportModal from './CsvImportModal';
import './Sales.css';
import { Users } from 'lucide-react';
import { fmtOMR } from '../utils/format';

function CustomerList({ onNavigate }) {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState('');
  const [filterArea, setFilterArea] = useState('');
  const [areas, setAreas] = useState([]);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [saving, setSaving] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [form, setForm] = useState({
    code: '', name: '', business_type: 'Grocery', contact_person: '', email: '', phone: '', mobile: '',
    address_line1: '', city: '', area: '', latitude: '', longitude: '',
    payment_terms_days: 7, credit_limit: '', opening_balance: '', preferred_delivery_day: '', delivery_instructions: '', notes: ''
  });

  // Pay Due modal state
  const [payingCustomer, setPayingCustomer] = useState(null);
  const [payInvoices, setPayInvoices] = useState([]);
  const [paySelectedInvoice, setPaySelectedInvoice] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [payRef, setPayRef] = useState('');
  const [payLoading, setPayLoading] = useState(false);

  useEffect(() => { load(); loadAreas(); }, [filterArea]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = async () => { setLoading(true); try { const params = {}; if (filterArea) params.area = filterArea; const dc = await customerAPI.list(params); setCustomers(Array.isArray(dc) ? dc : (dc?.items || [])); } catch(e) { console.error(e); } finally { setLoading(false); } };
  const loadAreas = async () => { try { setAreas(await customerAPI.getAreas()); } catch(e) {} };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data = { ...form, payment_terms_days: parseInt(form.payment_terms_days) || 7 };
      if (data.credit_limit) data.credit_limit = parseFloat(data.credit_limit); else delete data.credit_limit;
      if (data.opening_balance) data.opening_balance = parseFloat(data.opening_balance); else delete data.opening_balance;
      if (data.latitude) data.latitude = parseFloat(data.latitude); else delete data.latitude;
      if (data.longitude) data.longitude = parseFloat(data.longitude); else delete data.longitude;
      if (editingId) { await customerAPI.update(editingId, data); setMessage({ text: 'Customer updated!', type: 'success' }); }
      else { await customerAPI.create(data); setMessage({ text: 'Customer created!', type: 'success' }); }
      setShowForm(false); setEditingId(null); resetForm(); load(); loadAreas();
    } catch(e) { setMessage({ text: `${e.response?.data?.detail || e.message}`, type: 'error' }); } finally { setSaving(false); }
  };

  const editCustomer = (c) => {
    setForm({ code: c.code, name: c.name, business_type: c.business_type || 'Grocery', contact_person: c.contact_person || '', email: c.email || '', phone: c.phone || '', mobile: c.mobile || '', address_line1: c.address_line1 || '', city: c.city || '', area: c.area || '', latitude: c.latitude || '', longitude: c.longitude || '', payment_terms_days: c.payment_terms_days || 7, credit_limit: c.credit_limit || '', opening_balance: '', preferred_delivery_day: c.preferred_delivery_day || '', delivery_instructions: c.delivery_instructions || '', notes: c.notes || '' });
    setEditingId(c.id); setShowForm(true);
  };

  const resetForm = () => setForm({ code: '', name: '', business_type: 'Grocery', contact_person: '', email: '', phone: '', mobile: '', address_line1: '', city: '', area: '', latitude: '', longitude: '', payment_terms_days: 7, credit_limit: '', opening_balance: '', preferred_delivery_day: '', delivery_instructions: '', notes: '' });

  const filtered = customers.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.code.toLowerCase().includes(search.toLowerCase()) || (c.area || '').toLowerCase().includes(search.toLowerCase()));

  // Open Pay Due modal
  const openPayDue = async (c) => {
    setPayingCustomer(c);
    setPayAmount('');
    setPayMethod('cash');
    setPayDate(new Date().toISOString().slice(0, 10));
    setPayRef('');
    setPaySelectedInvoice('');
    setPayLoading(true);
    try {
      const res = await salesAPI.listInvoices({ customer_id: c.id });
      const invoices = Array.isArray(res) ? res : (res?.invoices || []);
      const unpaid = invoices.filter(inv => inv.status === 'pending' || inv.status === 'partial');
      setPayInvoices(unpaid);
      if (unpaid.length > 0) {
        setPaySelectedInvoice(String(unpaid[0].id));
        const due = ((unpaid[0].total_amount || 0) - (unpaid[0].amount_paid || 0)).toFixed(3);
        setPayAmount(due);
      }
    } catch (e) { setPayInvoices([]); }
    setPayLoading(false);
  };

  // Submit payment
  const submitPayment = async () => {
    if (!paySelectedInvoice || !payAmount || parseFloat(payAmount) <= 0) {
      setMessage({ text: 'Select an invoice and enter amount', type: 'error' }); return;
    }
    try {
      const res = await salesAPI.recordPayment(parseInt(paySelectedInvoice), {
        amount: parseFloat(payAmount),
        payment_method: payMethod,
        payment_date: payDate,
        bank_reference: payRef || undefined,
      });
      setMessage({ text: res.message || `Payment of ${parseFloat(payAmount).toFixed(3)} OMR recorded`, type: 'success' });
      setPayingCustomer(null);
      load();
    } catch (e) {
      setMessage({ text: e.response?.data?.detail || 'Payment failed', type: 'error' });
    }
  };

  // WhatsApp reminder
  const sendReminder = (c) => {
    const outstanding = (Number(c.outstanding_balance) || 0).toFixed(3);
    const phone = (c.mobile || c.phone || '').replace(/[^0-9+]/g, '').replace(/^\+/, '');
    const msg = `Dear ${c.name}, this is a reminder that you have an outstanding balance of ${outstanding} OMR with AK Al Mumayza Trading. Please contact us to arrange payment. Thank you.`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="sales-container">
      <div className="page-header"><div className="header-content"><div className="header-icon customer"><Users size={20} /></div><div><h1>Customers</h1><p>Manage shops and delivery routes</p></div></div>
        <div className="wms-flex-row">
          <button className="wms-btn-import" onClick={() => setShowImport(true)}>Import CSV / Excel</button>
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
              <div className="form-group"><label>Credit Limit (OMR)</label><input type="number" step="0.001" value={form.credit_limit} onChange={e => setForm(p => ({...p, credit_limit: e.target.value}))} placeholder="0 = unlimited" /></div>
              {!editingId && <div className="form-group"><label>Opening Balance (OMR)</label><input type="number" step="0.001" value={form.opening_balance} onChange={e => setForm(p => ({...p, opening_balance: e.target.value}))} placeholder="0.000" /></div>}
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
            <button type="submit" className="submit-btn" disabled={saving}>{saving ? 'Saving...' : (editingId ? 'Update' : 'Create Customer')}</button>
          </form>
        </div>
      )}

      {/* Pay Due Modal */}
      {payingCustomer && (
        <div className="form-card" style={{ border: '2px solid var(--warehouse-green, #1A7B5B)' }}>
          <h3>Record Payment -- {payingCustomer.name}</h3>
          <p style={{ margin: '8px 0', color: '#64748b' }}>
            Outstanding: <strong style={{ color: '#dc2626' }}>{(Number(payingCustomer.outstanding_balance) || 0).toFixed(3)} OMR</strong>
          </p>
          {payLoading ? <LoadingSpinner text="Loading invoices..." /> : (
            <>
              {payInvoices.length === 0 ? (
                <p style={{ color: '#64748b' }}>No unpaid invoices found for this customer.</p>
              ) : (
                <>
                  <div className="form-row-3">
                    <div className="form-group">
                      <label>Invoice</label>
                      <select value={paySelectedInvoice} onChange={e => {
                        setPaySelectedInvoice(e.target.value);
                        const inv = payInvoices.find(i => String(i.id) === e.target.value);
                        if (inv) setPayAmount(((inv.total_amount || 0) - (inv.amount_paid || 0)).toFixed(3));
                      }}>
                        {payInvoices.map(inv => (
                          <option key={inv.id} value={inv.id}>
                            {inv.invoice_number} -- Due: {((inv.total_amount || 0) - (inv.amount_paid || 0)).toFixed(3)} OMR
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Amount (OMR)</label>
                      <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} min="0.001" step="0.001" placeholder="0.000" />
                    </div>
                    <div className="form-group">
                      <label>Payment Method</label>
                      <select value={payMethod} onChange={e => setPayMethod(e.target.value)}>
                        <option value="cash">Cash</option>
                        <option value="bank_transfer">Bank Transfer</option>
                        <option value="cheque">Cheque</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-row-3">
                    <div className="form-group">
                      <label>Payment Date</label>
                      <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label>Reference / Note</label>
                      <input value={payRef} onChange={e => setPayRef(e.target.value)} placeholder="Cheque #, transfer ref..." />
                    </div>
                  </div>
                </>
              )}
              <div className="wms-flex-row" style={{ marginTop: 12 }}>
                {payInvoices.length > 0 && (
                  <button onClick={submitPayment} className="action-btn primary">Record Payment</button>
                )}
                <button onClick={() => setPayingCustomer(null)} className="cancel-btn">Cancel</button>
              </div>
            </>
          )}
        </div>
      )}

      <div className="filter-bar">
        <input type="text" placeholder="Search name, code, area..." value={search} onChange={e => setSearch(e.target.value)} className="search-input" />
        <select value={filterArea} onChange={e => setFilterArea(e.target.value)} className="filter-select">
          <option value="">All Areas</option>
          {areas.map(a => <option key={a.area} value={a.area}>{a.area} ({a.customer_count})</option>)}
        </select>
      </div>

      {loading ? <LoadingSpinner /> : (
        <div className="table-container"><table className="data-table">
          <thead><tr><th>Code</th><th>Shop Name</th><th>Type</th><th>Area</th><th>Phone</th><th>Terms</th><th>Credit Limit</th><th>Balance</th><th>Orders</th><th>Outstanding</th><th>Actions</th></tr></thead>
          <tbody>
            {filtered.length === 0 ? <EmptyState colSpan={11} title="No customers found" hint="Click '+ New Customer' to add your first customer" /> :
              filtered.map(c => {
                const bal = Number(c.current_balance) || 0;
                const limit = Number(c.credit_limit) || 0;
                const overLimit = limit > 0 && bal > limit;
                const outstanding = Number(c.outstanding_balance) || 0;
                return (
                <tr key={c.id} className={!c.is_active ? 'inactive' : ''}>
                  <td className="code">{c.code}</td><td className="name">{c.name}</td>
                  <td><span className="type-badge">{c.business_type || 'Grocery'}</span></td>
                  <td><span className="area-badge">{c.area || '-'}</span></td>
                  <td>{c.phone || c.mobile || '-'}</td>
                  <td>{c.payment_terms_days === 0 ? 'COD' : `Net ${c.payment_terms_days}d`}</td>
                  <td className="value">{limit > 0 ? limit.toFixed(3) : 'Unlimited'}</td>
                  <td className={`value ${overLimit ? 'negative' : ''}`} title={overLimit ? 'Exceeds credit limit!' : ''}>{bal > 0 ? bal.toFixed(3) : '-'}{overLimit && <span className="wms-badge unpaid" style={{ marginLeft: 4 }}>!</span>}</td>
                  <td className="center">{c.total_orders}</td>
                  <td className={`value ${outstanding > 0 ? 'negative' : ''}`}>{outstanding > 0 ? `${outstanding.toFixed(3)}` : '-'}</td>
                  <td>
                    <div className="action-cell">
                      <button className="edit-btn" onClick={() => editCustomer(c)}>Edit</button>
                      {onNavigate && <button className="wms-btn-action notify" onClick={() => onNavigate('customer-statement')}>Stmt</button>}
                      {outstanding > 0 && <button className="complete-btn small" onClick={() => openPayDue(c)}>Pay</button>}
                      {outstanding > 0 && (c.phone || c.mobile) && (
                        <button className="wms-btn-action notify" onClick={() => sendReminder(c)}>WA</button>
                      )}
                    </div>
                  </td>
                </tr>);
              })
            }
          </tbody>
        </table></div>
      )}
    </div>
  );
}
export default CustomerList;
