import React, { useState, useEffect } from 'react';
import { pdfAPI } from '../services/api';

function InvoicePDF({ orderId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!orderId) return;
    setLoading(true);
    pdfAPI.getInvoiceData(orderId)
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.response?.data?.detail || 'Failed to load invoice'); setLoading(false); });
  }, [orderId]);

  const handlePrint = () => window.print();

  const fmt = (n) => {
    const num = Number(n) || 0;
    return num.toFixed(3);
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Loading invoice...</div>;
  if (error) return <div style={{ padding: 40, color: 'red' }}>{error} <button onClick={onClose}>Close</button></div>;
  if (!data) return null;

  const { company, order, items, subtotal, discount, tax_rate, tax_amount, total } = data;
  const currency = company.currency || 'OMR';
  const invoiceDate = order.order_date || new Date().toISOString().slice(0, 10);
  const paymentTerms = order.payment_terms_days || 30;

  return (
    <div className="invoice-pdf-wrapper">
      {/* Toolbar — hidden when printing */}
      <div className="pdf-toolbar no-print">
        <button onClick={handlePrint} className="btn-print">🖨️ Print / Save PDF</button>
        <button onClick={onClose} className="btn-close-pdf">✕ Close</button>
      </div>

      <div className="invoice-page">
        {/* Header */}
        <div className="inv-header">
          <div className="inv-company">
            <h1 className="inv-company-name">{company.name}</h1>
            <p>{company.address}</p>
            {company.phone && <p>Tel: {company.phone}</p>}
            {company.email && <p>{company.email}</p>}
            {company.tax_id && <p>Tax ID: {company.tax_id}</p>}
          </div>
          <div className="inv-title-block">
            <h2 className="inv-title">TAX INVOICE</h2>
            <table className="inv-meta">
              <tbody>
                <tr><td className="meta-label">Invoice #:</td><td className="meta-value">{order.order_number || `INV-${order.id}`}</td></tr>
                <tr><td className="meta-label">Date:</td><td className="meta-value">{invoiceDate}</td></tr>
                <tr><td className="meta-label">Due Date:</td><td className="meta-value">{
                  (() => {
                    const d = new Date(invoiceDate);
                    d.setDate(d.getDate() + paymentTerms);
                    return d.toISOString().slice(0, 10);
                  })()
                }</td></tr>
                <tr><td className="meta-label">Terms:</td><td className="meta-value">Net {paymentTerms} days</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Bill To */}
        <div className="inv-addresses">
          <div className="inv-bill-to">
            <h3>Bill To:</h3>
            <p className="inv-cust-name">{order.customer_name}</p>
            {order.address_line1 && <p>{order.address_line1}</p>}
            {order.address_line2 && <p>{order.address_line2}</p>}
            {(order.city || order.area) && <p>{[order.area, order.city].filter(Boolean).join(', ')}</p>}
            {order.customer_phone && <p>Tel: {order.customer_phone}</p>}
            {order.customer_tax_id && <p>Tax ID: {order.customer_tax_id}</p>}
          </div>
          <div className="inv-ship-to">
            <h3>Deliver To:</h3>
            <p>{order.delivery_address || order.address_line1 || 'Same as billing'}</p>
            {order.contact_person && <p>Attn: {order.contact_person}</p>}
          </div>
        </div>

        {/* Items Table */}
        <table className="inv-items-table">
          <thead>
            <tr>
              <th className="col-no">#</th>
              <th className="col-sku">SKU</th>
              <th className="col-desc">Description</th>
              <th className="col-uom">Unit</th>
              <th className="col-qty">Qty</th>
              <th className="col-price">Unit Price</th>
              <th className="col-total">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const qty = item.quantity || 0;
              const price = item.unit_price || 0;
              const lineTotal = qty * price;
              return (
                <tr key={idx}>
                  <td className="col-no">{idx + 1}</td>
                  <td className="col-sku">{item.sku || '—'}</td>
                  <td className="col-desc">{item.product_name}</td>
                  <td className="col-uom">{item.unit_of_measure || 'PCS'}</td>
                  <td className="col-qty">{qty}</td>
                  <td className="col-price">{fmt(price)}</td>
                  <td className="col-total">{fmt(lineTotal)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Totals */}
        <div className="inv-totals-section">
          <div className="inv-notes">
            {order.notes && <><strong>Notes:</strong><p>{order.notes}</p></>}
          </div>
          <table className="inv-totals">
            <tbody>
              <tr><td>Subtotal:</td><td>{currency} {fmt(subtotal)}</td></tr>
              {discount > 0 && <tr><td>Discount:</td><td>({currency} {fmt(discount)})</td></tr>}
              <tr><td>VAT ({tax_rate}%):</td><td>{currency} {fmt(tax_amount)}</td></tr>
              <tr className="inv-grand-total"><td><strong>TOTAL:</strong></td><td><strong>{currency} {fmt(total)}</strong></td></tr>
            </tbody>
          </table>
        </div>

        {/* Footer — Signatures */}
        <div className="inv-footer">
          <div className="inv-sig-block">
            <div className="inv-sig-line"></div>
            <p>Prepared By</p>
          </div>
          <div className="inv-sig-block">
            <div className="inv-sig-line"></div>
            <p>Received By (Customer)</p>
          </div>
        </div>

        <div className="inv-terms">
          <p>Thank you for your business. Payment is due within {paymentTerms} days of invoice date.</p>
        </div>
      </div>
    </div>
  );
}

export default InvoicePDF;
