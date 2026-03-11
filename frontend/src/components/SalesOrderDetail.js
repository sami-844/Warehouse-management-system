import LoadingSpinner from './LoadingSpinner';
import React, { useState, useEffect } from 'react';
import { salesAPI } from '../services/api';
import { PERMISSIONS } from '../constants/permissions';
import './Sales.css';

/* ── Permission helper ── */
const _role = (localStorage.getItem('userRole') || '').toLowerCase();
const _perms = JSON.parse(localStorage.getItem('userPermissions') || '[]');
const can = (perm) => _role === 'admin' || _perms.includes(perm);
const canViewCostPrice = can(PERMISSIONS.SALES.VIEW_COST_PRICE);

function SalesOrderDetail({ soId, onBack }) {
  const [so, setSo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [actionLoading, setActionLoading] = useState('');

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadSO(); }, [soId]);

  const loadSO = async () => { setLoading(true); try { setSo(await salesAPI.getOrder(soId)); } catch(e) { console.error(e); } finally { setLoading(false); } };

  const doAction = async (action, label) => {
    setActionLoading(action); setMessage({ text: '', type: '' });
    try {
      let result;
      switch (action) {
        case 'confirm':
          result = await salesAPI.confirmOrder(soId);
          setMessage({ text: `Order confirmed! ${result.stock_warnings?.length ? 'Warnings: ' + result.stock_warnings.join('; ') : ''}`, type: result.stock_warnings?.length ? 'error' : 'success' });
          break;
        case 'ship':
          result = await salesAPI.shipOrder(soId);
          const shorts = result.items?.filter(i => i.short > 0) || [];
          setMessage({ text: `Order shipped! ${shorts.length ? 'Short: ' + shorts.map(s => `${s.product}: ${s.short} short`).join('; ') : 'All items shipped.'}`, type: shorts.length ? 'error' : 'success' });
          break;
        case 'deliver':
          result = await salesAPI.deliverOrder(soId, { actual_delivery_date: new Date().toISOString().slice(0, 10) });
          setMessage({ text: 'Delivery recorded!', type: 'success' });
          break;
        case 'invoice':
          result = await salesAPI.invoiceOrder(soId);
          setMessage({ text: `Invoice ${result.invoice_number} created! Due: ${result.due_date}`, type: 'success' });
          break;
        default: break;
      }
      loadSO();
    } catch(e) { setMessage({ text: `${e.response?.data?.detail || e.message}`, type: 'error' }); }
    finally { setActionLoading(''); }
  };

  if (loading) return <div className="sales-container"><LoadingSpinner /></div>;
  if (!so) return <div className="sales-container"><div className="no-data">Order not found</div></div>;

  const statusColor = (s) => ({ draft: '#6b7280', confirmed: '#2563eb', picking: '#7c3aed', shipped: '#d97706', delivered: '#16a34a', invoiced: '#059669' }[s] || '#6b7280');

  const workflow = [
    { status: 'draft', label: 'Draft', icon: '' },
    { status: 'confirmed', label: 'Confirmed', icon: '' },
    { status: 'shipped', label: 'Shipped', icon: '' },
    { status: 'delivered', label: 'Delivered', icon: '' },
    { status: 'invoiced', label: 'Invoiced', icon: '' },
  ];
  const currentIdx = workflow.findIndex(w => w.status === so.status);

  return (
    <div className="sales-container">
      <div className="page-header"><div className="header-content">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <div><h1>{so.order_number}</h1><p>{so.customer?.name} — {so.customer?.area || ''}</p></div>
      </div></div>

      {message.text && <div className={`message ${message.type}`}>{message.text}</div>}

      {/* Workflow Progress */}
      <div className="workflow-bar">
        {workflow.map((step, idx) => (
          <div key={step.status} className={`workflow-step ${idx <= currentIdx ? 'completed' : ''} ${idx === currentIdx ? 'current' : ''}`}>
            <div className="step-icon">{step.icon}</div>
            <div className="step-label">{step.label}</div>
            {idx < workflow.length - 1 && <div className={`step-line ${idx < currentIdx ? 'done' : ''}`} />}
          </div>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="action-bar">
        {so.status === 'draft' && <button className="workflow-btn confirm" onClick={() => doAction('confirm', 'Confirming...')} disabled={!!actionLoading}>{actionLoading === 'confirm' ? '...' : 'Confirm Order'}</button>}
        {so.status === 'confirmed' && <button className="workflow-btn ship" onClick={() => doAction('ship', 'Shipping...')} disabled={!!actionLoading}>{actionLoading === 'ship' ? '...' : 'Ship / Pick & Pack'}</button>}
        {so.status === 'shipped' && <button className="workflow-btn deliver" onClick={() => doAction('deliver', 'Delivering...')} disabled={!!actionLoading}>{actionLoading === 'deliver' ? '...' : 'Mark Delivered'}</button>}
        {(so.status === 'delivered' || so.status === 'shipped') && !so.invoice && <button className="workflow-btn invoice" onClick={() => doAction('invoice', 'Invoicing...')} disabled={!!actionLoading}>{actionLoading === 'invoice' ? '...' : 'Generate Invoice'}</button>}
      </div>

      {/* Summary Cards */}
      <div className="so-summary-cards">
        <div className="summary-card"><div className="sc-label">Order Date</div><div className="sc-value">{so.order_date}</div></div>
        <div className="summary-card"><div className="sc-label">Required</div><div className="sc-value">{so.required_date || 'ASAP'}</div></div>
        <div className="summary-card"><div className="sc-label">Driver</div><div className="sc-value">{so.driver_name || 'Unassigned'}</div></div>
        <div className="summary-card"><div className="sc-label">Vehicle</div><div className="sc-value">{so.vehicle || '-'}</div></div>
        <div className="summary-card highlight"><div className="sc-label">Total</div><div className="sc-value">{(Number(so.total_amount) || 0).toFixed(3)} OMR</div></div>
      </div>

      {/* Items Table */}
      <div className="tab-content">
        <h4>Order Items</h4>
        <table className="data-table">
          <thead><tr><th>Product</th><th>SKU</th><th>Ordered</th><th>Shipped</th><th>Price</th><th>Disc%</th><th>Total</th>{canViewCostPrice && <th>Cost</th>}{canViewCostPrice && <th>Profit</th>}</tr></thead>
          <tbody>
            {(so.items || []).map(i => (
              <tr key={i.id}>
                <td>{i.product_name}</td><td className="code">{i.sku}</td>
                <td>{i.quantity_ordered}</td>
                <td className={i.quantity_shipped < i.quantity_ordered ? 'negative' : 'positive'}>{i.quantity_shipped}</td>
                <td>{(Number(i.unit_price) || 0).toFixed(3)}</td><td>{i.discount_percent || 0}%</td>
                <td className="value">{(Number(i.total_price) || 0).toFixed(3)}</td>
                {canViewCostPrice && <td>{(Number(i.cost_price) || 0).toFixed(3)}</td>}
                {canViewCostPrice && <td style={{color: ((Number(i.total_price) || 0) - (Number(i.cost_price) || 0) * (i.quantity_ordered || 0)) >= 0 ? '#28A745' : '#DC3545'}}>{((Number(i.total_price) || 0) - (Number(i.cost_price) || 0) * (i.quantity_ordered || 0)).toFixed(3)}</td>}
              </tr>
            ))}
          </tbody>
        </table>

        <div className="so-totals">
          <div className="total-line"><span>Subtotal</span><span>{(Number(so.subtotal) || 0).toFixed(3)} OMR</span></div>
          {(Number(so.discount_amount) || 0) > 0 && <div className="total-line discount"><span>Discount</span><span className="negative">-{(Number(so.discount_amount) || 0).toFixed(3)}</span></div>}
          <div className="total-line"><span>VAT (5%)</span><span>{(Number(so.tax_amount) || 0).toFixed(3)}</span></div>
          <div className="total-line grand"><span>Total</span><span>{(Number(so.total_amount) || 0).toFixed(3)} OMR</span></div>
        </div>
      </div>

      {/* Delivery Info */}
      {so.delivery && (
        <div className="info-card"><h4>Delivery</h4>
          <div className="info-grid">
            <div><span className="label">Status:</span> <span className="status-pill" style={{ backgroundColor: statusColor(so.delivery.status === 'delivered' ? 'delivered' : 'confirmed') }}>{so.delivery.status}</span></div>
            <div><span className="label">Driver:</span> {so.delivery.driver || '-'}</div>
            <div><span className="label">Scheduled:</span> {so.delivery.scheduled || '-'}</div>
            <div><span className="label">Delivered:</span> {so.delivery.actual || '-'}</div>
          </div>
        </div>
      )}

      {/* Invoice Info */}
      {so.invoice && (
        <div className="info-card"><h4>Invoice</h4>
          <div className="info-grid">
            <div><span className="label">Invoice:</span> <strong>{so.invoice.number}</strong></div>
            <div><span className="label">Total:</span> {(Number(so.invoice.total) || 0).toFixed(3)} OMR</div>
            <div><span className="label">Paid:</span> <span className="positive">{(Number(so.invoice.paid) || 0).toFixed(3)}</span></div>
            <div><span className="label">Status:</span> <span className={`status-${so.invoice.status}`}>{so.invoice.status}</span></div>
          </div>
        </div>
      )}
    </div>
  );
}
export default SalesOrderDetail;
