import LoadingSpinner from './LoadingSpinner';
import EmptyState from './EmptyState';
import React, { useState, useEffect } from 'react';
import { salesAPI, messagingAPI, notificationsAPI } from '../services/api';
import './Sales.css';
import { Receipt } from 'lucide-react';
import { fmtNumber, fmtDate } from '../utils/format';

function SalesInvoices() {
  const [invoices, setInvoices] = useState([]);
  const [aging, setAging] = useState(null);
  const [overdue, setOverdue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [payingInvoice, setPayingInvoice] = useState(null);
  const [payForm, setPayForm] = useState({ amount: '', payment_method: 'cash', payment_date: new Date().toISOString().slice(0, 10), bank_reference: '', notes: '' });
  const [message, setMessage] = useState({ text: '', type: '' });
  const [saving, setSaving] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); loadAging(); loadOverdue(); }, [filterStatus]);

  const load = async () => { setLoading(true); try { const p = {}; if (filterStatus) p.status = filterStatus; const di = await salesAPI.listInvoices(p); setInvoices(Array.isArray(di) ? di : (di?.items || [])); } catch(e) {} finally { setLoading(false); } };
  const loadAging = async () => { try { setAging(await salesAPI.agingReport()); } catch(e) {} };
  const loadOverdue = async () => { try { setOverdue(await salesAPI.overdueInvoices()); } catch(e) {} };

  const submitPayment = async () => {
    if (!payForm.amount || !payingInvoice) return;
    setSaving(true);
    try {
      const result = await salesAPI.recordPayment(payingInvoice.id, {
        amount: parseFloat(payForm.amount), payment_method: payForm.payment_method,
        payment_date: payForm.payment_date, bank_reference: payForm.bank_reference || null, notes: payForm.notes || null
      });
      setMessage({ text: `Payment recorded! Balance: ${result.new_balance} OMR`, type: 'success' });
      setPayingInvoice(null); load(); loadAging(); loadOverdue();
    } catch(e) { setMessage({ text: `${e.response?.data?.detail || e.message}`, type: 'error' }); } finally { setSaving(false); }
  };

  const sendInvoiceMsg = async (inv) => {
    try {
      const res = await messagingAPI.sendInvoiceNotification(inv.id);
      setMessage({ text: `Message sent to ${inv.customer_name}: ${res.message_preview || 'Queued'}`, type: 'success' });
    } catch(e) { setMessage({ text: e.response?.data?.detail || 'Failed to send message', type: 'error' }); }
  };

  const sendReminder = async (inv) => {
    try {
      const res = await messagingAPI.sendPaymentReminder(inv.id);
      setMessage({ text: `Reminder sent to ${inv.customer_name}: ${res.message_preview || 'Queued'}`, type: 'success' });
    } catch(e) { setMessage({ text: e.response?.data?.detail || 'Failed to send reminder', type: 'error' }); }
  };

  const emailInvoice = async (inv) => {
    try {
      const res = await notificationsAPI.emailInvoice(inv.id);
      setMessage({ text: res.message || `Invoice emailed successfully`, type: 'success' });
    } catch(e) { setMessage({ text: e.response?.data?.detail || 'Failed to send email', type: 'error' }); }
  };

  const shareWhatsApp = (inv) => {
    const balance = (Number(inv.balance) || 0).toFixed(3);
    const total = (Number(inv.total_amount) || 0).toFixed(3);
    const lines = [
      `*Invoice from AK Al Momaiza Trading*`,
      ``,
      `Invoice #: ${inv.invoice_number}`,
      `Date: ${inv.invoice_date}`,
      `Amount: ${total} OMR`,
      `Balance Due: ${balance} OMR`,
      `Status: ${inv.status}`,
      ``,
      `Please contact us for payment or queries.`,
    ].join('\n');
    const phone = (inv.customer_phone || '').replace(/[^0-9+]/g, '').replace(/^\+/, '');
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(lines)}`
      : `https://wa.me/?text=${encodeURIComponent(lines)}`;
    window.open(url, '_blank');
  };

  const statusColor = (s) => ({ pending: '#d97706', partial: '#2563eb', paid: '#16a34a' }[s] || '#6b7280');

  return (
    <div className="sales-container">
      <div className="page-header"><div className="header-content"><div className="header-icon sinvoice"><Receipt size={20} /></div><div><h1>Sales Invoices</h1><p>Track customer invoices and collections</p></div></div></div>

      {message.text && <div className={`message ${message.type}`}>{message.text}</div>}

      {/* KPI Summary Cards */}
      {!loading && invoices.length > 0 && (() => {
        const total = invoices.length;
        const billed = invoices.reduce((s, i) => s + (Number(i.total_amount) || 0), 0);
        const collected = invoices.reduce((s, i) => s + (Number(i.amount_paid) || 0), 0);
        const outstanding = billed - collected;
        const kpis = [
          { label: 'Total Invoices', value: total, unit: '', color: '#1a2332' },
          { label: 'Total Billed', value: billed.toFixed(3), unit: 'OMR', color: '#2563eb' },
          { label: 'Collected', value: collected.toFixed(3), unit: 'OMR', color: '#16a34a' },
          { label: 'Outstanding', value: outstanding.toFixed(3), unit: 'OMR', color: outstanding > 0 ? '#dc2626' : '#16a34a' },
        ];
        return (
          <div className="wms-kpi-row">
            {kpis.map(k => (
              <div key={k.label} className="wms-kpi-card">
                <div className="wms-kpi-label">{k.label}</div>
                <div className="wms-kpi-value" style={{ color: k.color }}>
                  {k.value}{k.unit && <span style={{ fontSize: 12, fontWeight: 600, marginLeft: 4, color: '#94a3b8' }}>{k.unit}</span>}
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Aging Summary */}
      {aging && (() => {
        const b = aging.buckets || {};
        const cur = Number(b.current) || 0;
        const d30 = Number(b['1_30']) || 0;
        const d60 = Number(b['31_60']) || 0;
        const d90 = Number(b['61_90']) || 0;
        const over = Number(b.over_90) || 0;
        return (
          <div className="aging-cards">
            <div className="aging-card current"><div className="aging-label">Current</div><div className="aging-value">{cur.toFixed(3)}</div></div>
            <div className="aging-card d30"><div className="aging-label">1-30 Days</div><div className="aging-value">{d30.toFixed(3)}</div></div>
            <div className="aging-card d60"><div className="aging-label">31-60 Days</div><div className="aging-value">{d60.toFixed(3)}</div></div>
            <div className="aging-card d90"><div className="aging-label">61-90 Days</div><div className="aging-value">{d90.toFixed(3)}</div></div>
            <div className="aging-card over90"><div className="aging-label">90+ Days</div><div className="aging-value">{over.toFixed(3)}</div></div>
            <div className="aging-card total"><div className="aging-label">Total Owed</div><div className="aging-value">{(Number(aging.total_outstanding) || 0).toFixed(3)}</div></div>
          </div>
        );
      })()}

      {/* Overdue Alert */}
      {overdue && overdue.count > 0 && (
        <div className="overdue-alert">
          <div className="overdue-header">{overdue.count} overdue invoices — {(Number(overdue.total_overdue) || 0).toFixed(3)} OMR</div>
          <div className="overdue-list">
            {(overdue.invoices || []).slice(0, 5).map(inv => (
              <div key={inv.id} className="overdue-item">
                <span className="oi-inv">{inv.number}</span>
                <span className="oi-cust">{inv.customer}</span>
                <span className="oi-phone">{inv.phone || '-'}</span>
                <span className="oi-balance negative">{(Number(inv.balance) || 0).toFixed(3)} OMR</span>
                <span className="oi-days">{inv.days_overdue}d overdue</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {payingInvoice && (
        <div className="modal-overlay" onClick={() => setPayingInvoice(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h3>Collect Payment — {payingInvoice.invoice_number}</h3>
            <p>Customer: <strong>{payingInvoice.customer_name}</strong> — Balance: <strong>{(Number(payingInvoice.balance) || 0).toFixed(3)} OMR</strong></p>
            <div className="form-row-2">
              <div className="form-group"><label>Amount *</label><input type="number" step="0.001" value={payForm.amount} onChange={e => setPayForm(p => ({...p, amount: e.target.value}))} max={payingInvoice.balance} /></div>
              <div className="form-group"><label>Method</label>
                <select value={payForm.payment_method} onChange={e => setPayForm(p => ({...p, payment_method: e.target.value}))}>
                  <option value="cash">Cash</option><option value="bank_transfer">Bank Transfer</option><option value="cheque">Cheque</option>
                </select></div>
            </div>
            <div className="form-row-2">
              <div className="form-group"><label>Date *</label><input type="date" value={payForm.payment_date} onChange={e => setPayForm(p => ({...p, payment_date: e.target.value}))} /></div>
              <div className="form-group"><label>Reference</label><input value={payForm.bank_reference} onChange={e => setPayForm(p => ({...p, bank_reference: e.target.value}))} placeholder="Cheque # or bank ref" /></div>
            </div>
            <div className="modal-actions">
              <button className="submit-btn" onClick={submitPayment} disabled={saving}>{saving ? 'Recording...' : 'Record Payment'}</button>
              <button className="cancel-btn" onClick={() => setPayingInvoice(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="filter-bar">
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="filter-select">
          <option value="">All</option><option value="pending">Pending</option><option value="partial">Partial</option><option value="paid">Paid</option>
        </select>
      </div>

      {loading ? <LoadingSpinner /> : (
        <div className="table-container"><table className="data-table">
          <thead><tr><th>Invoice #</th><th>Customer</th><th>Area</th><th>Date</th><th>Due</th><th>Total</th><th>Paid</th><th>Balance</th><th>Overdue</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {invoices.length === 0 ? <EmptyState colSpan={11} title="No invoices found" hint="Create a sales order and generate an invoice to get started" /> :
              invoices.map(inv => (
                <tr key={inv.id} className={inv.days_overdue > 0 ? 'overdue-row' : ''}>
                  <td className="code">{inv.invoice_number}</td><td>{inv.customer_name}</td>
                  <td><span className="area-badge">{inv.area || '-'}</span></td>
                  <td>{fmtDate(inv.invoice_date)}</td><td>{fmtDate(inv.due_date)}</td>
                  <td className="value">{fmtNumber(inv.total_amount)}</td>
                  <td className="positive">{fmtNumber(inv.amount_paid)}</td>
                  <td className={`value ${(Number(inv.balance) || 0) > 0 ? 'negative' : ''}`}>{fmtNumber(inv.balance)}</td>
                  <td className={inv.days_overdue > 0 ? 'negative' : ''}>{inv.days_overdue > 0 ? `${inv.days_overdue}d` : '-'}</td>
                  <td><span className="status-pill" style={{ backgroundColor: statusColor(inv.status) }}>{inv.status}</span></td>
                  <td className="wms-flex-row">
                    {inv.status !== 'paid' && <button className="pay-btn" onClick={() => { setPayingInvoice(inv); setPayForm(p => ({...p, amount: (Number(inv.balance) || 0).toFixed(3)})); }}>Pay</button>}
                    <button className="wms-btn-action notify" onClick={() => sendInvoiceMsg(inv)} title="Send invoice notification">Notify</button>
                    {inv.days_overdue > 0 && <button className="wms-btn-action remind" onClick={() => sendReminder(inv)} title="Send payment reminder">Remind</button>}
                    <button className="wms-btn-action xml" onClick={() => salesAPI.downloadFawtaraXML(inv.id)} title="Download Fawtara UBL 2.1 XML">XML</button>
                    <button className="wms-btn-action whatsapp" onClick={() => shareWhatsApp(inv)} title="Share via WhatsApp">WA</button>
                    <button className="wms-btn-action email" onClick={() => emailInvoice(inv)} title="Email invoice to customer">Email</button>
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
export default SalesInvoices;
