import React, { useState, useEffect } from 'react';
import { pdfAPI, customerAPI } from '../services/api';

function CustomerStatementPDF({ customerId: propCustomerId, onClose }) {
  const [customers, setCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState(propCustomerId || '');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Load customer list for selector
  useEffect(() => {
    customerAPI.list({ limit: 500 })
      .then(res => setCustomers(Array.isArray(res) ? res : res.customers || []))
      .catch(() => {});
  }, []);

  // Auto-load if customerId prop provided
  useEffect(() => {
    if (propCustomerId) loadStatement(propCustomerId);
  }, [propCustomerId]);

  const loadStatement = (custId) => {
    if (!custId) return;
    setLoading(true);
    setError('');
    const params = {};
    if (fromDate) params.from_date = fromDate;
    if (toDate) params.to_date = toDate;
    pdfAPI.getStatementData(custId, params)
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.response?.data?.detail || 'Failed to load statement'); setLoading(false); });
  };

  const handleGenerate = () => loadStatement(selectedCustomerId);
  const handlePrint = () => window.print();

  const fmt = (n) => {
    const num = Number(n) || 0;
    return num.toFixed(3);
  };

  // ── Selector View (before generating) ──
  if (!data && !loading) {
    return (
      <div style={{ padding: '30px', maxWidth: 600, margin: '0 auto' }}>
        <div className="pdf-toolbar no-print" style={{ marginBottom: 20 }}>
          {onClose && <button onClick={onClose} className="btn-close-pdf">✕ Close</button>}
        </div>
        <h2 style={{ color: '#0d7a3e', marginBottom: 20 }}>Customer Statement</h2>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: 13 }}>Customer *</label>
          <select value={selectedCustomerId} onChange={e => setSelectedCustomerId(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #ccc', fontSize: 14 }}>
            <option value="">Select customer...</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name} — {c.area || c.city || ''}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: 13 }}>From Date</label>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #ccc' }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: 13 }}>To Date</label>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #ccc' }} />
          </div>
        </div>

        {error && <p style={{ color: 'red', marginBottom: 10 }}>{error}</p>}

        <button onClick={handleGenerate} disabled={!selectedCustomerId}
          style={{ background: '#0d7a3e', color: '#fff', border: 'none', padding: '10px 24px',
            borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: selectedCustomerId ? 1 : 0.5 }}>
          Generate Statement
        </button>
      </div>
    );
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Loading statement...</div>;
  if (error) return <div style={{ padding: 40, color: 'red' }}>{error} <button onClick={onClose}>Close</button></div>;
  if (!data) return null;

  const { company, customer, entries, opening_balance, closing_balance, from_date, to_date } = data;
  const currency = company.currency || 'OMR';
  const totalDebits = entries.reduce((s, e) => s + (e.debit || 0), 0);
  const totalCredits = entries.reduce((s, e) => s + (e.credit || 0), 0);

  return (
    <div className="statement-wrapper">
      {/* Toolbar */}
      <div className="pdf-toolbar no-print">
        <button onClick={handlePrint} className="btn-print">Print / Save PDF</button>
        <button onClick={() => setData(null)} className="btn-close-pdf">← Back</button>
        {onClose && <button onClick={onClose} className="btn-close-pdf">✕ Close</button>}
      </div>

      <div className="stmt-page">
        {/* Header */}
        <div className="stmt-header">
          <div className="stmt-company">
            <h1 className="stmt-company-name">{company.name}</h1>
            <p>{company.address}</p>
            {company.phone && <p>Tel: {company.phone}</p>}
            {company.email && <p>{company.email}</p>}
          </div>
          <div className="stmt-title-block">
            <h2 className="stmt-title">STATEMENT OF ACCOUNT</h2>
            <table className="stmt-meta">
              <tbody>
                <tr><td className="meta-label">Date:</td><td className="meta-value">{new Date().toISOString().slice(0, 10)}</td></tr>
                <tr><td className="meta-label">Period:</td><td className="meta-value">{from_date} to {to_date}</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Customer Info */}
        <div className="stmt-customer">
          <h3>Account:</h3>
          <p className="stmt-cust-name">{customer.name}</p>
          {customer.address_line1 && <p>{customer.address_line1}</p>}
          {(customer.area || customer.city) && <p>{[customer.area, customer.city].filter(Boolean).join(', ')}</p>}
          {customer.phone && <p>Tel: {customer.phone}</p>}
          {customer.contact_person && <p>Contact: {customer.contact_person}</p>}
        </div>

        {/* Transactions Table */}
        <table className="stmt-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Reference</th>
              <th>Description</th>
              <th className="col-amount">Debit ({currency})</th>
              <th className="col-amount">Credit ({currency})</th>
              <th className="col-amount">Balance ({currency})</th>
            </tr>
          </thead>
          <tbody>
            {opening_balance !== 0 && (
              <tr className="stmt-opening">
                <td colSpan="3"><strong>Opening Balance</strong></td>
                <td></td><td></td>
                <td className="col-amount"><strong>{fmt(opening_balance)}</strong></td>
              </tr>
            )}
            {entries.length === 0 ? (
              <tr><td colSpan="6" style={{ textAlign: 'center', padding: 20, color: '#999' }}>No transactions in this period</td></tr>
            ) : entries.map((entry, idx) => (
              <tr key={idx}>
                <td>{entry.date}</td>
                <td className="stmt-ref">{entry.reference}</td>
                <td>{entry.description}</td>
                <td className="col-amount">{entry.debit ? fmt(entry.debit) : ''}</td>
                <td className="col-amount">{entry.credit ? fmt(entry.credit) : ''}</td>
                <td className="col-amount"><strong>{fmt(entry.balance)}</strong></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="stmt-totals-row">
              <td colSpan="3" style={{ textAlign: 'right' }}><strong>Totals:</strong></td>
              <td className="col-amount"><strong>{fmt(totalDebits)}</strong></td>
              <td className="col-amount"><strong>{fmt(totalCredits)}</strong></td>
              <td className="col-amount"><strong>{fmt(closing_balance)}</strong></td>
            </tr>
          </tfoot>
        </table>

        {/* Closing Balance */}
        <div className="stmt-closing">
          <div className="stmt-balance-box">
            <span>Balance Due:</span>
            <span className="stmt-balance-amount">{currency} {fmt(closing_balance)}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="stmt-footer">
          <p>This statement is computer generated. Please verify all transactions.</p>
          <p>For queries, contact us at {company.phone || company.email || 'our office'}.</p>
        </div>
      </div>
    </div>
  );
}

export default CustomerStatementPDF;
