import React, { useState, useEffect } from 'react';
import { pdfAPI } from '../services/api';

function DeliveryNotePDF({ deliveryId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!deliveryId) return;
    setLoading(true);
    pdfAPI.getDeliveryNoteData(deliveryId)
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.response?.data?.detail || 'Failed to load delivery note'); setLoading(false); });
  }, [deliveryId]);

  const handlePrint = () => window.print();

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Loading delivery note...</div>;
  if (error) return <div style={{ padding: 40, color: 'red' }}>{error} <button onClick={onClose}>Close</button></div>;
  if (!data) return null;

  const { company, delivery, items } = data;
  const deliveryDate = delivery.delivery_date || delivery.scheduled_date || new Date().toISOString().slice(0, 10);
  const totalItems = items.reduce((sum, i) => sum + (i.quantity || 0), 0);
  const totalWeight = items.reduce((sum, i) => sum + ((i.quantity || 0) * (i.weight || 0)), 0);

  return (
    <div className="delivery-note-wrapper">
      {/* Toolbar — hidden when printing */}
      <div className="pdf-toolbar no-print">
        <button onClick={handlePrint} className="btn-print">🖨️ Print / Save PDF</button>
        <button onClick={onClose} className="btn-close-pdf">✕ Close</button>
      </div>

      <div className="dn-page">
        {/* Header */}
        <div className="dn-header">
          <div className="dn-company">
            <h1 className="dn-company-name">{company.name}</h1>
            <p>{company.address}</p>
            {company.phone && <p>Tel: {company.phone}</p>}
          </div>
          <div className="dn-title-block">
            <h2 className="dn-title">DELIVERY NOTE</h2>
            <table className="dn-meta">
              <tbody>
                <tr><td className="meta-label">DN #:</td><td className="meta-value">DN-{delivery.id}</td></tr>
                <tr><td className="meta-label">Order #:</td><td className="meta-value">{delivery.order_number || `SO-${delivery.sales_order_id}`}</td></tr>
                <tr><td className="meta-label">Date:</td><td className="meta-value">{deliveryDate}</td></tr>
                <tr><td className="meta-label">Status:</td><td className="meta-value">{(delivery.status || 'pending').toUpperCase()}</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Customer + Driver Info */}
        <div className="dn-info-row">
          <div className="dn-customer-info">
            <h3>Deliver To:</h3>
            <p className="dn-cust-name">{delivery.customer_name}</p>
            <p>{delivery.delivery_address || delivery.address_line1 || ''}</p>
            {(delivery.area || delivery.city) && <p>{[delivery.area, delivery.city].filter(Boolean).join(', ')}</p>}
            {delivery.customer_phone && <p>Tel: {delivery.customer_phone}</p>}
            {delivery.contact_person && <p>Attn: {delivery.contact_person}</p>}
          </div>
          <div className="dn-driver-info">
            <h3>Driver / Vehicle:</h3>
            <p>Driver: {delivery.driver_name || delivery.assigned_driver || '_______________'}</p>
            <p>Vehicle: {delivery.vehicle_number || delivery.vehicle || '_______________'}</p>
            <p>Route: {delivery.area || delivery.route || '_______________'}</p>
          </div>
        </div>

        {/* Delivery Instructions */}
        {(delivery.order_notes || delivery.delivery_notes) && (
          <div className="dn-instructions">
            <strong>Instructions: </strong>{delivery.order_notes || delivery.delivery_notes}
          </div>
        )}

        {/* Items Table */}
        <table className="dn-items-table">
          <thead>
            <tr>
              <th className="col-no">#</th>
              <th className="col-sku">SKU</th>
              <th className="col-barcode">Barcode</th>
              <th className="col-desc">Product</th>
              <th className="col-uom">Unit</th>
              <th className="col-qty">Qty Ordered</th>
              <th className="col-shipped">Qty Shipped</th>
              <th className="col-check">✓</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx}>
                <td className="col-no">{idx + 1}</td>
                <td className="col-sku">{item.sku || '—'}</td>
                <td className="col-barcode">{item.barcode || '—'}</td>
                <td className="col-desc">{item.product_name}</td>
                <td className="col-uom">{item.unit_of_measure || 'PCS'}</td>
                <td className="col-qty">{item.quantity || 0}</td>
                <td className="col-shipped">{item.quantity || 0}</td>
                <td className="col-check">☐</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="dn-totals-row">
              <td colSpan="5" style={{ textAlign: 'right', fontWeight: 'bold' }}>Totals:</td>
              <td style={{ fontWeight: 'bold' }}>{totalItems}</td>
              <td style={{ fontWeight: 'bold' }}>{totalItems}</td>
              <td></td>
            </tr>
            {totalWeight > 0 && (
              <tr>
                <td colSpan="5" style={{ textAlign: 'right' }}>Est. Weight:</td>
                <td colSpan="3">{totalWeight.toFixed(1)} kg</td>
              </tr>
            )}
          </tfoot>
        </table>

        {/* Signature Blocks */}
        <div className="dn-signatures">
          <div className="dn-sig-block">
            <div className="dn-sig-line"></div>
            <p>Warehouse Staff</p>
            <p className="dn-sig-detail">Name: _______________</p>
            <p className="dn-sig-detail">Date: _______________</p>
          </div>
          <div className="dn-sig-block">
            <div className="dn-sig-line"></div>
            <p>Driver</p>
            <p className="dn-sig-detail">Name: _______________</p>
            <p className="dn-sig-detail">Date: _______________</p>
          </div>
          <div className="dn-sig-block">
            <div className="dn-sig-line"></div>
            <p>Customer</p>
            <p className="dn-sig-detail">Name: _______________</p>
            <p className="dn-sig-detail">Date: _______________</p>
          </div>
        </div>

        <div className="dn-footer-note">
          <p>Goods received in good condition. Any discrepancies must be reported within 24 hours.</p>
        </div>
      </div>
    </div>
  );
}

export default DeliveryNotePDF;
