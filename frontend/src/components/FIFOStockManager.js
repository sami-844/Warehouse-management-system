import React, { useState, useEffect, useCallback } from 'react';
import { fifoAPI, productAPI } from '../services/api';

function FIFOStockManager() {
  const [activeTab, setActiveTab] = useState('batches');
  const [batches, setBatches] = useState([]);
  const [expiring, setExpiring] = useState([]);
  const [summary, setSummary] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // FIFO Issue state
  const [issueProductId, setIssueProductId] = useState('');
  const [issueQuantity, setIssueQuantity] = useState('');
  const [suggestedPicks, setSuggestedPicks] = useState(null);
  const [issueReference, setIssueReference] = useState('');

  // Receive state
  const [rcvProductId, setRcvProductId] = useState('');
  const [rcvQty, setRcvQty] = useState('');
  const [rcvBatch, setRcvBatch] = useState('');
  const [rcvCost, setRcvCost] = useState('');
  const [rcvExpiry, setRcvExpiry] = useState('');

  // Days filter for expiring
  const [expiryDays, setExpiryDays] = useState(30);

  const loadProducts = useCallback(() => {
    productAPI.getAll({ limit: 500 })
      .then(res => setProducts(Array.isArray(res?.data) ? res.data : (res?.data?.products || [])))
      .catch(() => {});
  }, []);

  const loadBatches = useCallback(() => {
    setLoading(true);
    fifoAPI.listBatches()
      .then(d => { setBatches(d.batches || []); setLoading(false); })
      .catch(e => { setError('Failed to load batches'); setLoading(false); });
  }, []);

  const loadExpiring = useCallback(() => {
    fifoAPI.expiringBatches(expiryDays)
      .then(d => setExpiring(d.batches || []))
      .catch(() => {});
  }, [expiryDays]);

  const loadSummary = useCallback(() => {
    fifoAPI.getSummary()
      .then(d => setSummary(d))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadProducts();
    loadBatches();
    loadExpiring();
    loadSummary();
  }, [loadProducts, loadBatches, loadExpiring, loadSummary]);

  // ── FIFO Suggest ──
  const handleSuggest = () => {
    if (!issueProductId || !issueQuantity) return;
    setError(''); setSuccess('');
    fifoAPI.suggestPicks(issueProductId, issueQuantity)
      .then(d => setSuggestedPicks(d))
      .catch(e => setError(e.response?.data?.detail || 'Failed to get suggestions'));
  };

  // ── FIFO Issue ──
  const handleIssue = () => {
    if (!suggestedPicks || suggestedPicks.picks.length === 0) return;
    setError(''); setSuccess('');
    fifoAPI.issueFIFO({
      product_id: parseInt(issueProductId),
      picks: suggestedPicks.picks.map(p => ({ batch_id: p.batch_id, quantity: p.pick_quantity })),
      reason: 'manual_issue',
      reference: issueReference,
    })
      .then(d => {
        setSuccess(d.message);
        setSuggestedPicks(null);
        setIssueProductId(''); setIssueQuantity(''); setIssueReference('');
        loadBatches(); loadExpiring(); loadSummary();
      })
      .catch(e => setError(e.response?.data?.detail || 'Issue failed'));
  };

  // ── Receive ──
  const handleReceive = () => {
    if (!rcvProductId || !rcvQty) return;
    setError(''); setSuccess('');
    fifoAPI.receiveBatch({
      product_id: rcvProductId, quantity: rcvQty, batch_number: rcvBatch,
      cost_price: rcvCost || 0, expiry_date: rcvExpiry,
    })
      .then(d => {
        setSuccess(d.message);
        setRcvProductId(''); setRcvQty(''); setRcvBatch(''); setRcvCost(''); setRcvExpiry('');
        loadBatches(); loadExpiring(); loadSummary();
      })
      .catch(e => setError(e.response?.data?.detail || 'Receive failed'));
  };

  const expiryColor = (days) => {
    if (days === null || days === undefined) return '#888';
    if (days < 0) return '#c0392b';
    if (days <= 7) return '#e74c3c';
    if (days <= 30) return '#e67e22';
    if (days <= 60) return '#f39c12';
    return '#27ae60';
  };

  const expiryBadge = (days) => {
    if (days === null || days === undefined) return <span style={{ color: '#888' }}>No expiry</span>;
    if (days < 0) return <span style={{ background: '#c0392b', color: '#fff', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600 }}>EXPIRED ({Math.abs(days)}d ago)</span>;
    return <span style={{ background: expiryColor(days), color: '#fff', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600 }}>{days}d left</span>;
  };

  const fmt = (n) => Number(n || 0).toFixed(3);

  return (
    <div style={{ padding: '20px 24px', maxWidth: 1200, margin: '0 auto' }}>
      <h2 style={{ color: '#0d7a3e', marginBottom: 6 }}>📦 FIFO Stock Rotation</h2>
      <p style={{ color: '#666', fontSize: 13, marginBottom: 20 }}>Oldest stock first — expiry-driven batch management for FMCG</p>

      {/* Summary Cards */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
          <SummaryCard label="Active Batches" value={summary.total_active_batches} color="#0d7a3e" />
          <SummaryCard label="Expired" value={summary.already_expired} color="#c0392b" />
          <SummaryCard label="Expiring 7d" value={summary.expiring_within_7_days} color="#e74c3c" />
          <SummaryCard label="Expiring 30d" value={summary.expiring_within_30_days} color="#e67e22" />
          <SummaryCard label="Stock Value" value={`OMR ${fmt(summary.total_stock_value)}`} color="#2c3e50" />
        </div>
      )}

      {error && <div style={{ background: '#fce4e4', color: '#c0392b', padding: '10px 16px', borderRadius: 8, marginBottom: 12, fontSize: 13 }}>{error}</div>}
      {success && <div style={{ background: '#e8f8e8', color: '#0d7a3e', padding: '10px 16px', borderRadius: 8, marginBottom: 12, fontSize: 13 }}>{success}</div>}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 20, borderBottom: '2px solid #e5e5e5' }}>
        {[
          { id: 'batches', label: '📋 All Batches' },
          { id: 'issue', label: '📤 FIFO Issue' },
          { id: 'receive', label: '📥 Receive Batch' },
          { id: 'expiring', label: '⚠️ Expiring Soon' },
        ].map(tab => (
          <button key={tab.id} onClick={() => { setActiveTab(tab.id); setError(''); setSuccess(''); }}
            style={{
              padding: '10px 20px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: activeTab === tab.id ? '#0d7a3e' : 'transparent',
              color: activeTab === tab.id ? '#fff' : '#555',
              borderRadius: '8px 8px 0 0',
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── All Batches Tab ── */}
      {activeTab === 'batches' && (
        <div>
          {loading ? <p>Loading batches...</p> : batches.length === 0 ? (
            <p style={{ color: '#999', padding: 20 }}>No active batches. Receive stock to create batches.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#0d7a3e', color: '#fff' }}>
                    <th style={th}>Product</th>
                    <th style={th}>SKU</th>
                    <th style={th}>Batch #</th>
                    <th style={th}>Received</th>
                    <th style={th}>Expiry</th>
                    <th style={th}>Status</th>
                    <th style={{ ...th, textAlign: 'right' }}>Qty Received</th>
                    <th style={{ ...th, textAlign: 'right' }}>Qty Remaining</th>
                    <th style={{ ...th, textAlign: 'right' }}>Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((b, i) => (
                    <tr key={b.id} style={{ background: i % 2 === 0 ? '#fff' : '#f9f9f9', borderBottom: '1px solid #eee' }}>
                      <td style={td}>{b.product_name}</td>
                      <td style={{ ...td, fontFamily: 'monospace', fontSize: 11 }}>{b.sku}</td>
                      <td style={{ ...td, fontFamily: 'monospace', fontSize: 11 }}>{b.batch_number}</td>
                      <td style={td}>{b.received_date}</td>
                      <td style={td}>{b.expiry_date || '—'} {expiryBadge(b.days_until_expiry)}</td>
                      <td style={td}>{b.status}</td>
                      <td style={{ ...td, textAlign: 'right' }}>{b.quantity_received}</td>
                      <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>{b.quantity_remaining}</td>
                      <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace' }}>{fmt(b.cost_price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── FIFO Issue Tab ── */}
      {activeTab === 'issue' && (
        <div style={{ maxWidth: 700 }}>
          <h3 style={{ color: '#333', marginBottom: 12, fontSize: 15 }}>Issue Stock (FIFO — oldest expiry first)</h3>

          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 200px' }}>
              <label style={lbl}>Product *</label>
              <select value={issueProductId} onChange={e => { setIssueProductId(e.target.value); setSuggestedPicks(null); }} style={input}>
                <option value="">Select product...</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
              </select>
            </div>
            <div style={{ flex: '0 0 130px' }}>
              <label style={lbl}>Quantity *</label>
              <input type="number" value={issueQuantity} onChange={e => { setIssueQuantity(e.target.value); setSuggestedPicks(null); }}
                style={input} min="0.001" step="0.001" placeholder="Qty" />
            </div>
            <div style={{ flex: '1 1 150px' }}>
              <label style={lbl}>Reference</label>
              <input value={issueReference} onChange={e => setIssueReference(e.target.value)}
                style={input} placeholder="SO-xxx" />
            </div>
          </div>

          <button onClick={handleSuggest} disabled={!issueProductId || !issueQuantity}
            style={{ ...btnGreen, opacity: (issueProductId && issueQuantity) ? 1 : 0.5, marginBottom: 16 }}>
            🔍 Suggest FIFO Picks
          </button>

          {/* Suggestion Results */}
          {suggestedPicks && (
            <div style={{ background: '#f0f7f4', borderRadius: 10, padding: 16, marginBottom: 16 }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#0d7a3e' }}>
                Suggested Picks {suggestedPicks.fully_satisfiable ? '✅' : '⚠️ Shortfall'}
              </h4>
              {suggestedPicks.shortfall > 0 && (
                <p style={{ color: '#e74c3c', fontSize: 13, marginBottom: 8 }}>
                  ⚠️ Shortfall: {suggestedPicks.shortfall} units — not enough stock
                </p>
              )}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #0d7a3e' }}>
                    <th style={{ ...th, background: 'transparent', color: '#333' }}>Batch</th>
                    <th style={{ ...th, background: 'transparent', color: '#333' }}>Expiry</th>
                    <th style={{ ...th, background: 'transparent', color: '#333' }}>Status</th>
                    <th style={{ ...th, background: 'transparent', color: '#333', textAlign: 'right' }}>Available</th>
                    <th style={{ ...th, background: 'transparent', color: '#333', textAlign: 'right' }}>Pick Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {suggestedPicks.picks.map((p, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #ddd' }}>
                      <td style={td}>{p.batch_number}</td>
                      <td style={td}>{p.expiry_date || '—'} {expiryBadge(p.days_until_expiry)}</td>
                      <td style={td}>{p.days_until_expiry !== null && p.days_until_expiry < 0 ? '🔴 Expired' : '🟢 Active'}</td>
                      <td style={{ ...td, textAlign: 'right' }}>{p.quantity_available}</td>
                      <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: '#0d7a3e' }}>{p.pick_quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ marginTop: 12, display: 'flex', gap: 12 }}>
                <button onClick={handleIssue} style={btnGreen}>✅ Confirm Issue ({suggestedPicks.total_picked} units)</button>
                <button onClick={() => setSuggestedPicks(null)} style={{ ...btnGreen, background: '#666' }}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Receive Batch Tab ── */}
      {activeTab === 'receive' && (
        <div style={{ maxWidth: 600 }}>
          <h3 style={{ color: '#333', marginBottom: 12, fontSize: 15 }}>Receive New Batch</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={lbl}>Product *</label>
              <select value={rcvProductId} onChange={e => setRcvProductId(e.target.value)} style={input}>
                <option value="">Select product...</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={lbl}>Quantity *</label>
                <input type="number" value={rcvQty} onChange={e => setRcvQty(e.target.value)}
                  style={input} min="0.001" step="0.001" />
              </div>
              <div style={{ flex: 1 }}>
                <label style={lbl}>Cost Price (OMR)</label>
                <input type="number" value={rcvCost} onChange={e => setRcvCost(e.target.value)}
                  style={input} min="0" step="0.001" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={lbl}>Batch Number</label>
                <input value={rcvBatch} onChange={e => setRcvBatch(e.target.value)} style={input} placeholder="Auto-generated if empty" />
              </div>
              <div style={{ flex: 1 }}>
                <label style={lbl}>Expiry Date *</label>
                <input type="date" value={rcvExpiry} onChange={e => setRcvExpiry(e.target.value)} style={input} />
              </div>
            </div>
            <button onClick={handleReceive} disabled={!rcvProductId || !rcvQty}
              style={{ ...btnGreen, opacity: (rcvProductId && rcvQty) ? 1 : 0.5, alignSelf: 'flex-start' }}>
              📥 Receive Batch
            </button>
          </div>
        </div>
      )}

      {/* ── Expiring Soon Tab ── */}
      {activeTab === 'expiring' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 600 }}>Show batches expiring within:</label>
            <select value={expiryDays} onChange={e => { setExpiryDays(Number(e.target.value)); }}
              style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #ccc' }}>
              <option value="7">7 days</option>
              <option value="14">14 days</option>
              <option value="30">30 days</option>
              <option value="60">60 days</option>
              <option value="90">90 days</option>
            </select>
            <button onClick={loadExpiring} style={{ ...btnGreen, padding: '6px 14px', fontSize: 12 }}>Refresh</button>
          </div>

          {expiring.length === 0 ? (
            <p style={{ color: '#27ae60', padding: 20, fontSize: 14 }}>✅ No batches expiring within {expiryDays} days.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#e74c3c', color: '#fff' }}>
                    <th style={th}>Product</th>
                    <th style={th}>Batch #</th>
                    <th style={th}>Expiry</th>
                    <th style={th}>Days Left</th>
                    <th style={{ ...th, textAlign: 'right' }}>Qty Remaining</th>
                    <th style={{ ...th, textAlign: 'right' }}>Value (OMR)</th>
                  </tr>
                </thead>
                <tbody>
                  {expiring.map((b, i) => (
                    <tr key={b.id} style={{
                      background: b.is_expired ? '#fde8e8' : i % 2 === 0 ? '#fff' : '#fff5f0',
                      borderBottom: '1px solid #eee'
                    }}>
                      <td style={td}>{b.product_name}</td>
                      <td style={{ ...td, fontFamily: 'monospace', fontSize: 11 }}>{b.batch_number}</td>
                      <td style={td}>{b.expiry_date}</td>
                      <td style={td}>{expiryBadge(b.days_until_expiry)}</td>
                      <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>{b.quantity_remaining}</td>
                      <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace' }}>{fmt(b.quantity_remaining * (b.cost_price || 0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Small helper components ──
function SummaryCard({ label, value, color }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 10, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
      borderLeft: `4px solid ${color}`,
    }}>
      <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color, marginTop: 4 }}>{value}</div>
    </div>
  );
}

// ── Inline styles ──
const th = { padding: '8px 10px', textAlign: 'left', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.3 };
const td = { padding: '7px 10px' };
const lbl = { display: 'block', marginBottom: 3, fontWeight: 600, fontSize: 12, color: '#444' };
const input = { width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #ccc', fontSize: 13, boxSizing: 'border-box' };
const btnGreen = { background: '#0d7a3e', color: '#fff', border: 'none', padding: '9px 20px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' };

export default FIFOStockManager;
