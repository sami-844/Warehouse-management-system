import LoadingSpinner from './LoadingSpinner';
import React, { useState, useEffect } from 'react';
import { purchaseAPI } from '../services/api';
import './AdminPanel.css';
import { Ship } from 'lucide-react';

function LandedCosts() {
  const [pos, setPOs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPO, setSelectedPO] = useState('');
  const [costType, setCostType] = useState('freight');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('by_value');
  const [landedData, setLandedData] = useState(null);
  const [calcLoading, setCalcLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  useEffect(() => {
    purchaseAPI.listOrders({ status: 'received' })
      .then(d => setPOs(Array.isArray(d) ? d : (d?.items || [])))
      .catch(() => setPOs([]))
      .finally(() => setLoading(false));
  }, []);

  const addCost = async () => {
    if (!selectedPO || !amount) {
      setMessage({ text: 'Select a PO and enter an amount', type: 'error' });
      return;
    }
    try {
      const res = await purchaseAPI.addLandedCosts(selectedPO, {
        costs: [{ cost_type: costType, description: description || costType, amount: parseFloat(amount), allocation_method: method, notes: '' }],
      });
      setLandedData(res);
      setMessage({ text: 'Landed cost added and allocation calculated', type: 'success' });
      setDescription('');
      setAmount('');
      loadExisting();
    } catch (e) {
      setMessage({ text: e.response?.data?.detail || 'Failed to add cost', type: 'error' });
    }
  };

  const loadExisting = async () => {
    if (!selectedPO) return;
    setCalcLoading(true);
    try {
      const d = await purchaseAPI.getLandedCosts(selectedPO);
      setLandedData(d);
    } catch { setLandedData(null); }
    finally { setCalcLoading(false); }
  };

  const applyToProducts = async () => {
    if (!selectedPO) return;
    try {
      const res = await purchaseAPI.applyLandedCosts(selectedPO);
      setMessage({ text: res.message || 'Costs applied to products', type: 'success' });
    } catch (e) {
      setMessage({ text: e.response?.data?.detail || 'Failed to apply', type: 'error' });
    }
  };

  const handlePOChange = (poId) => {
    setSelectedPO(poId);
    setLandedData(null);
    if (poId) {
      setCalcLoading(true);
      purchaseAPI.getLandedCosts(poId)
        .then(d => setLandedData(d))
        .catch(() => {})
        .finally(() => setCalcLoading(false));
    }
  };

  const fmt = (v) => (v || 0).toFixed(3);

  return (
    <div className="admin-container">
      <div className="page-header">
        <div className="header-content">
          <div className="header-icon purchasing"><Ship size={20} /></div>
          <div><h1>Landed Costs</h1><p>Add freight, customs, insurance to purchase orders for real COGS</p></div>
        </div>
      </div>

      {message.text && <div className={`message ${message.type}`}>{message.text}</div>}

      {loading ? <LoadingSpinner text="Loading purchase orders..." /> : (
        <>
          {/* Add Cost Form */}
          <div style={{
            background: 'var(--ds-surface)', border: '1px solid var(--ds-border)',
            borderRadius: 10, padding: 20, marginBottom: 16,
          }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700 }}>Add Landed Cost</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ds-text-muted)', display: 'block', marginBottom: 4 }}>Purchase Order *</label>
                <select value={selectedPO} onChange={e => handlePOChange(e.target.value)} className="filter-input" style={{ width: '100%' }}>
                  <option value="">Select received PO...</option>
                  {pos.map(po => (
                    <option key={po.id} value={po.id}>
                      {po.po_number} — {po.supplier_name} ({fmt(po.total || po.subtotal)} OMR)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ds-text-muted)', display: 'block', marginBottom: 4 }}>Cost Type *</label>
                <select value={costType} onChange={e => setCostType(e.target.value)} className="filter-input" style={{ width: '100%' }}>
                  <option value="freight">Freight</option>
                  <option value="customs">Customs Duty</option>
                  <option value="insurance">Insurance</option>
                  <option value="handling">Handling</option>
                  <option value="transport">Local Transport</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ds-text-muted)', display: 'block', marginBottom: 4 }}>Description</label>
                <input value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="e.g. Freight from Dubai" className="filter-input" style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ds-text-muted)', display: 'block', marginBottom: 4 }}>Amount (OMR) *</label>
                <input type="number" step="0.001" value={amount} onChange={e => setAmount(e.target.value)}
                  placeholder="0.000" className="filter-input" style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ds-text-muted)', display: 'block', marginBottom: 4 }}>Allocation Method</label>
                <select value={method} onChange={e => setMethod(e.target.value)} className="filter-input" style={{ width: '100%' }}>
                  <option value="by_value">By Value (proportional)</option>
                  <option value="by_quantity">By Quantity</option>
                  <option value="equal">Equal Split</option>
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button onClick={addCost} className="action-btn primary" style={{ width: '100%' }}>Add Cost</button>
              </div>
            </div>
          </div>

          {calcLoading && <LoadingSpinner text="Loading allocation..." />}

          {/* Existing Costs */}
          {landedData && landedData.costs && landedData.costs.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Added Costs</h3>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                {landedData.costs.map(c => (
                  <div key={c.id} style={{
                    background: 'var(--ds-surface)', border: '1px solid var(--ds-border)',
                    borderRadius: 8, padding: '8px 14px', fontSize: 12,
                  }}>
                    <div style={{ fontWeight: 700, textTransform: 'capitalize' }}>{c.type.replace('_', ' ')}</div>
                    <div style={{ color: 'var(--ds-text-muted)' }}>{c.description}</div>
                    <div style={{ fontFamily: 'var(--ds-font-mono)', fontWeight: 800, color: '#d97706', marginTop: 2 }}>
                      OMR {fmt(c.amount)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Summary Cards */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                <div style={{ background: 'var(--ds-surface)', border: '1px solid var(--ds-border)', borderRadius: 8, padding: '10px 16px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ds-text-muted)' }}>Product Subtotal</div>
                  <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'var(--ds-font-mono)' }}>OMR {fmt(landedData.product_subtotal)}</div>
                </div>
                <div style={{ background: '#fffbeb', border: '1px solid #f59e0b', borderRadius: 8, padding: '10px 16px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#92400e' }}>Additional Costs</div>
                  <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'var(--ds-font-mono)', color: '#d97706' }}>OMR {fmt(landedData.total_additional)}</div>
                </div>
                <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '10px 16px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#166534' }}>Total Landed Cost</div>
                  <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'var(--ds-font-mono)', color: '#16a34a' }}>OMR {fmt(landedData.total_landed)}</div>
                </div>
              </div>
            </div>
          )}

          {/* Allocation Table */}
          {landedData && landedData.allocation && landedData.allocation.length > 0 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Cost Allocation by Product</h3>
                <button onClick={applyToProducts} className="action-btn primary">
                  Apply to Product Costs
                </button>
              </div>
              <div className="table-container">
                <table className="data-table" style={{ fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th style={{ textAlign: 'right' }}>Qty</th>
                      <th style={{ textAlign: 'right' }}>Original Cost</th>
                      <th style={{ textAlign: 'right' }}>Additional</th>
                      <th style={{ textAlign: 'right' }}>Total Landed</th>
                      <th style={{ textAlign: 'right' }}>Landed Unit Cost</th>
                      <th style={{ textAlign: 'right' }}>% Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {landedData.allocation.map((a, i) => {
                      const origUnit = a.original_unit_cost || (a.product_cost / a.quantity);
                      const pctChange = origUnit > 0 ? ((a.landed_unit_cost - origUnit) / origUnit * 100) : 0;
                      return (
                        <tr key={i}>
                          <td style={{ fontWeight: 600 }}>{a.product}</td>
                          <td style={{ textAlign: 'right' }}>{a.quantity}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)' }}>{fmt(a.product_cost)}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)', color: '#d97706', fontWeight: 600 }}>
                            {fmt(a.additional_cost)}
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)', fontWeight: 700 }}>{fmt(a.total_landed)}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)', fontWeight: 700, color: '#16a34a' }}>
                            {fmt(a.landed_unit_cost)}
                          </td>
                          <td style={{
                            textAlign: 'right', fontFamily: 'var(--ds-font-mono)', fontWeight: 600,
                            color: pctChange > 10 ? '#dc2626' : pctChange > 5 ? '#d97706' : '#16a34a',
                          }}>
                            +{pctChange.toFixed(1)}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!selectedPO && (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--ds-text-muted)' }}>
              Select a received purchase order to view or add landed costs
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default LandedCosts;
