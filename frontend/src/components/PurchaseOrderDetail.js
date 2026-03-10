import React, { useState, useEffect } from 'react';
import { purchaseAPI, warehouseAPI } from '../services/api';
import './Purchasing.css';

function PurchaseOrderDetail({ poId, onBack }) {
  const [po, setPo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('details');
  const [warehouses, setWarehouses] = useState([]);
  const [message, setMessage] = useState({ text: '', type: '' });

  // Receipt form
  const [receiptForm, setReceiptForm] = useState({ warehouse_id: '', received_date: new Date().toISOString().slice(0, 10), quality_notes: '', notes: '' });
  const [receiptItems, setReceiptItems] = useState([]);

  // Landed cost form
  const [landedCosts, setLandedCosts] = useState([]);
  const [newCost, setNewCost] = useState({ cost_type: 'freight', description: '', amount: '', allocation_method: 'by_value' });
  const [landedData, setLandedData] = useState(null);

  // Invoice form
  const [invoiceForm, setInvoiceForm] = useState({ invoice_number: '', invoice_date: new Date().toISOString().slice(0, 10), due_date: '', subtotal: '', tax_amount: '0', total_amount: '', notes: '' });

  useEffect(() => { loadPO(); loadWarehouses(); }, [poId]);

  const loadPO = async () => {
    setLoading(true);
    try {
      const data = await purchaseAPI.getOrder(poId);
      setPo(data);
      setReceiptItems((data.items || []).filter(i => i.remaining > 0).map(i => ({ ...i, qty_to_receive: '', batch_number: '', expiry_date: '', quality_status: 'accepted' })));
      setInvoiceForm(p => ({ ...p, subtotal: (Number(data.total_amount) || 0).toFixed(3), total_amount: (Number(data.total_amount) || 0).toFixed(3) }));
      // Load landed cost data
      try { setLandedData(await purchaseAPI.getLandedCosts(poId)); } catch(e) {}
    } catch(e) { console.error(e); } finally { setLoading(false); }
  };
  const loadWarehouses = async () => { try { const res = await warehouseAPI.list(); const w = Array.isArray(res) ? res : (res?.items || []); setWarehouses(w); if (w.length > 0) setReceiptForm(p => ({...p, warehouse_id: w[0].id})); } catch(e) {} };

  // === RECEIVE GOODS ===
  const submitReceipt = async () => {
    const items = receiptItems.filter(i => i.qty_to_receive && parseFloat(i.qty_to_receive) > 0);
    if (items.length === 0) { setMessage({ text: 'Enter quantities to receive', type: 'error' }); return; }
    try {
      const result = await purchaseAPI.receiveGoods(poId, {
        warehouse_id: parseInt(receiptForm.warehouse_id), received_date: receiptForm.received_date,
        quality_notes: receiptForm.quality_notes || null, notes: receiptForm.notes || null,
        items: items.map(i => ({
          purchase_order_item_id: i.id, product_id: i.product_id,
          quantity_received: parseFloat(i.qty_to_receive),
          batch_number: i.batch_number || null, expiry_date: i.expiry_date || null,
          quality_status: i.quality_status
        }))
      });
      setMessage({ text: `${result.receipt_number} created! ${result.fully_received ? 'PO fully received.' : 'Partial receipt recorded.'}`, type: 'success' });
      loadPO();
    } catch(e) { setMessage({ text: `${e.response?.data?.detail || e.message}`, type: 'error' }); }
  };

  // === LANDED COSTS ===
  const addCost = () => {
    if (!newCost.amount) return;
    setLandedCosts(prev => [...prev, { ...newCost, amount: parseFloat(newCost.amount) }]);
    setNewCost({ cost_type: 'freight', description: '', amount: '', allocation_method: 'by_value' });
  };

  const submitLandedCosts = async () => {
    if (landedCosts.length === 0) return;
    try {
      const result = await purchaseAPI.addLandedCosts(poId, { costs: landedCosts });
      setMessage({ text: `Landed costs added! Total: ${result.total_landed_cost} OMR`, type: 'success' });
      setLandedCosts([]); loadPO();
    } catch(e) { setMessage({ text: `${e.response?.data?.detail || e.message}`, type: 'error' }); }
  };

  // === INVOICE ===
  const submitInvoice = async () => {
    try {
      const result = await purchaseAPI.createInvoice({
        invoice_number: invoiceForm.invoice_number, purchase_order_id: poId,
        supplier_id: po.supplier.id, invoice_date: invoiceForm.invoice_date,
        due_date: invoiceForm.due_date, subtotal: parseFloat(invoiceForm.subtotal),
        tax_amount: parseFloat(invoiceForm.tax_amount) || 0,
        total_amount: parseFloat(invoiceForm.total_amount), notes: invoiceForm.notes || null
      });
      setMessage({ text: `Invoice ${result.invoice_number} recorded!`, type: 'success' });
      loadPO();
    } catch(e) { setMessage({ text: `${e.response?.data?.detail || e.message}`, type: 'error' }); }
  };

  if (loading) return <div className="purchasing-container"><div className="loading-state">Loading PO...</div></div>;
  if (!po) return <div className="purchasing-container"><div className="no-data">PO not found</div></div>;

  const statusColor = (s) => ({ draft: '#6b7280', sent: '#2563eb', partially_received: '#d97706', fully_received: '#16a34a', closed: '#9ca3af' }[s] || '#6b7280');

  return (
    <div className="purchasing-container">
      <div className="page-header">
        <div className="header-content">
          <button className="back-btn" onClick={onBack}>← Back</button>
          <div><h1>{po.po_number}</h1><p>{po.supplier?.name} — <span className="status-pill" style={{ backgroundColor: statusColor(po.status) }}>{(po.status || '').replace('_', ' ')}</span></p></div>
        </div>
      </div>

      {message.text && <div className={`message ${message.type}`}>{message.text}</div>}

      <div className="po-summary-cards">
        <div className="summary-card"><div className="sc-label">Order Date</div><div className="sc-value">{po.order_date}</div></div>
        <div className="summary-card"><div className="sc-label">Expected</div><div className="sc-value">{po.expected_delivery_date || 'TBD'}</div></div>
        <div className="summary-card"><div className="sc-label">Container</div><div className="sc-value">{po.container_reference || '-'}</div></div>
        <div className="summary-card"><div className="sc-label">Subtotal</div><div className="sc-value">{(Number(po.subtotal) || 0).toFixed(3)} {po.currency}</div></div>
        <div className="summary-card"><div className="sc-label">Tax</div><div className="sc-value">{(Number(po.tax_amount) || 0).toFixed(3)}</div></div>
        <div className="summary-card highlight"><div className="sc-label">Total</div><div className="sc-value">{(Number(po.total_amount) || 0).toFixed(3)} {po.currency}</div></div>
      </div>

      <div className="tab-bar">
        {['details', 'receive', 'landed-cost', 'invoice'].map(t => (
          <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {{ details: 'Items', receive: 'Receive', 'landed-cost': 'Landed Cost', invoice: 'Invoice' }[t]}
          </button>
        ))}
      </div>

      {/* ITEMS TAB */}
      {tab === 'details' && (
        <div className="tab-content">
          <table className="data-table">
            <thead><tr><th>Product</th><th>SKU</th><th>Ordered</th><th>Received</th><th>Remaining</th><th>Unit Price</th><th>Total</th></tr></thead>
            <tbody>
              {(po.items || []).map(i => (
                <tr key={i.id} className={i.remaining === 0 ? 'completed' : i.received_quantity > 0 ? 'partial' : ''}>
                  <td>{i.product_name}</td><td className="code">{i.sku}</td><td>{i.quantity}</td>
                  <td className={i.received_quantity > 0 ? 'positive' : ''}>{i.received_quantity}</td>
                  <td className={i.remaining > 0 ? 'negative' : ''}>{i.remaining}</td>
                  <td>{(Number(i.unit_price) || 0).toFixed(3)}</td><td className="value">{(Number(i.total_price) || 0).toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(po.receipts || []).length > 0 && (
            <div className="receipts-list"><h4>Goods Received Notes</h4>
              {(po.receipts || []).map(r => <div key={r.id} className="receipt-tag">{r.number} — {r.date}</div>)}
            </div>
          )}
        </div>
      )}

      {/* RECEIVE TAB */}
      {tab === 'receive' && (
        <div className="tab-content">
          {po.status === 'draft' ? <div className="info-message">Send this PO first before receiving goods.</div> :
           po.status === 'fully_received' || po.status === 'closed' ? <div className="info-message">All items have been received.</div> : (
            <>
              <div className="form-row-3">
                <div className="form-group"><label>Warehouse *</label>
                  <select value={receiptForm.warehouse_id} onChange={e => setReceiptForm(p => ({...p, warehouse_id: e.target.value}))}>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
                <div className="form-group"><label>Date *</label><input type="date" value={receiptForm.received_date} onChange={e => setReceiptForm(p => ({...p, received_date: e.target.value}))} /></div>
                <div className="form-group"><label>Quality Notes</label><input value={receiptForm.quality_notes} onChange={e => setReceiptForm(p => ({...p, quality_notes: e.target.value}))} /></div>
              </div>
              <table className="data-table">
                <thead><tr><th>Product</th><th>Ordered</th><th>Already Rcvd</th><th>Remaining</th><th>Receive Qty</th><th>Batch #</th><th>Expiry</th><th>Quality</th></tr></thead>
                <tbody>
                  {receiptItems.map((item, idx) => (
                    <tr key={idx}>
                      <td>{item.product_name}</td><td>{item.quantity}</td><td>{item.received_quantity}</td><td className="negative">{item.remaining}</td>
                      <td><input type="number" className="inline-input" value={item.qty_to_receive} onChange={e => { const v = [...receiptItems]; v[idx].qty_to_receive = e.target.value; setReceiptItems(v); }} max={item.remaining} min="0" placeholder="0" /></td>
                      <td><input type="text" className="inline-input" value={item.batch_number} onChange={e => { const v = [...receiptItems]; v[idx].batch_number = e.target.value; setReceiptItems(v); }} placeholder="BATCH" /></td>
                      <td><input type="date" className="inline-input" value={item.expiry_date} onChange={e => { const v = [...receiptItems]; v[idx].expiry_date = e.target.value; setReceiptItems(v); }} /></td>
                      <td><select className="inline-input" value={item.quality_status} onChange={e => { const v = [...receiptItems]; v[idx].quality_status = e.target.value; setReceiptItems(v); }}>
                        <option value="accepted">Accepted</option><option value="rejected">Rejected</option><option value="damaged">Damaged</option>
                      </select></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button className="submit-btn" onClick={submitReceipt}>Record Receipt</button>
            </>
          )}
        </div>
      )}

      {/* LANDED COST TAB */}
      {tab === 'landed-cost' && (
        <div className="tab-content">
          {landedData && (landedData.costs || []).length > 0 && (
            <div className="landed-existing">
              <h4>Existing Costs</h4>
              <table className="data-table compact">
                <thead><tr><th>Type</th><th>Description</th><th>Amount (OMR)</th></tr></thead>
                <tbody>
                  {(landedData.costs || []).map(c => <tr key={c.id}><td>{c.type}</td><td>{c.description || '-'}</td><td className="value">{(Number(c.amount) || 0).toFixed(3)}</td></tr>)}
                  <tr className="totals-row"><td colSpan="2">Total Additional</td><td className="value">{(Number(landedData.total_additional) || 0).toFixed(3)}</td></tr>
                  <tr className="totals-row grand"><td colSpan="2">Total Landed Cost</td><td className="value">{(Number(landedData.total_landed) || 0).toFixed(3)}</td></tr>
                </tbody>
              </table>
              {(landedData.allocation || []).length > 0 && (
                <>
                  <h4>Cost Allocation by Product</h4>
                  <table className="data-table compact">
                    <thead><tr><th>Product</th><th>Qty</th><th>Product Cost</th><th>+ Additional</th><th>= Landed</th><th>Unit Cost</th><th>Orig. Unit</th></tr></thead>
                    <tbody>
                      {(landedData.allocation || []).map((a, i) => (
                        <tr key={i}><td>{a.product}</td><td>{a.quantity}</td><td>{(Number(a.product_cost) || 0).toFixed(3)}</td><td>{(Number(a.additional_cost) || 0).toFixed(3)}</td><td className="value">{(Number(a.total_landed) || 0).toFixed(3)}</td><td className="highlight-value">{(Number(a.landed_unit_cost) || 0).toFixed(3)}</td><td>{(Number(a.original_unit_cost) || 0).toFixed(3)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          )}
          <h4>Add New Costs</h4>
          <div className="add-cost-row">
            <select value={newCost.cost_type} onChange={e => setNewCost(p => ({...p, cost_type: e.target.value}))}>
              <option value="freight">Freight / Shipping</option><option value="customs">Customs Duty</option><option value="handling">Port Handling</option><option value="insurance">Insurance</option><option value="transport">Local Transport</option><option value="other">Other</option>
            </select>
            <input value={newCost.description} onChange={e => setNewCost(p => ({...p, description: e.target.value}))} placeholder="Description" />
            <input type="number" step="0.001" value={newCost.amount} onChange={e => setNewCost(p => ({...p, amount: e.target.value}))} placeholder="Amount (OMR)" />
            <button type="button" className="add-item-btn" onClick={addCost}>+ Add</button>
          </div>
          {landedCosts.length > 0 && (
            <>
              <table className="items-table">
                <thead><tr><th>Type</th><th>Description</th><th>Amount</th><th></th></tr></thead>
                <tbody>
                  {landedCosts.map((c, i) => <tr key={i}><td>{c.cost_type}</td><td>{c.description || '-'}</td><td>{(Number(c.amount) || 0).toFixed(3)} OMR</td><td><button className="remove-btn" onClick={() => setLandedCosts(p => p.filter((_, j) => j !== i))}>✕</button></td></tr>)}
                  <tr className="totals-row"><td colSpan="2">Total</td><td>{landedCosts.reduce((s, c) => s + (Number(c.amount) || 0), 0).toFixed(3)} OMR</td><td></td></tr>
                </tbody>
              </table>
              <button className="submit-btn" onClick={submitLandedCosts}>Save Landed Costs</button>
            </>
          )}
        </div>
      )}

      {/* INVOICE TAB */}
      {tab === 'invoice' && (
        <div className="tab-content">
          {(po.invoices || []).length > 0 && (
            <div className="existing-invoices"><h4>Existing Invoices</h4>
              {(po.invoices || []).map(inv => (
                <div key={inv.id} className="invoice-tag">{inv.number} — {(Number(inv.total) || 0).toFixed(3)} OMR — Paid: {(Number(inv.paid) || 0).toFixed(3)} — <span className={`status-${inv.status}`}>{inv.status}</span></div>
              ))}
            </div>
          )}
          <h4>Record Supplier Invoice</h4>
          <div className="form-row-3">
            <div className="form-group"><label>Invoice # *</label><input value={invoiceForm.invoice_number} onChange={e => setInvoiceForm(p => ({...p, invoice_number: e.target.value}))} placeholder="INV-SUP-001" /></div>
            <div className="form-group"><label>Invoice Date *</label><input type="date" value={invoiceForm.invoice_date} onChange={e => setInvoiceForm(p => ({...p, invoice_date: e.target.value}))} /></div>
            <div className="form-group"><label>Due Date *</label><input type="date" value={invoiceForm.due_date} onChange={e => setInvoiceForm(p => ({...p, due_date: e.target.value}))} /></div>
          </div>
          <div className="form-row-3">
            <div className="form-group"><label>Subtotal</label><input type="number" step="0.001" value={invoiceForm.subtotal} onChange={e => setInvoiceForm(p => ({...p, subtotal: e.target.value, total_amount: (parseFloat(e.target.value) + parseFloat(p.tax_amount || 0)).toFixed(3)}))} /></div>
            <div className="form-group"><label>Tax</label><input type="number" step="0.001" value={invoiceForm.tax_amount} onChange={e => setInvoiceForm(p => ({...p, tax_amount: e.target.value, total_amount: (parseFloat(p.subtotal || 0) + parseFloat(e.target.value)).toFixed(3)}))} /></div>
            <div className="form-group"><label>Total *</label><input type="number" step="0.001" value={invoiceForm.total_amount} onChange={e => setInvoiceForm(p => ({...p, total_amount: e.target.value}))} /></div>
          </div>
          <button className="submit-btn" onClick={submitInvoice} disabled={!invoiceForm.invoice_number || !invoiceForm.due_date}>Record Invoice</button>
        </div>
      )}
    </div>
  );
}
export default PurchaseOrderDetail;
