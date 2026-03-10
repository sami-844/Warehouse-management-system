import React, { useState, useEffect, useCallback } from 'react';
import { fifoAPI, productAPI } from '../services/api';
import './AdminPanel.css';
import { Archive } from 'lucide-react';

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
    if (days === null || days === undefined) return 'var(--ds-text-muted)';
    if (days < 0) return 'var(--ds-danger)';
    if (days <= 7) return '#e74c3c';
    if (days <= 30) return '#e67e22';
    if (days <= 60) return '#f39c12';
    return 'var(--ds-green)';
  };

  const expiryBadge = (days) => {
    if (days === null || days === undefined) return <span style={{ color: 'var(--ds-text-muted)' }}>No expiry</span>;
    return (
      <span className="status-pill" style={{ background: expiryColor(days) }}>
        {days < 0 ? `EXPIRED (${Math.abs(days)}d ago)` : `${days}d left`}
      </span>
    );
  };

  const fmt = (n) => Number(n || 0).toFixed(3);

  return (
    <div className="admin-container">
      <div className="page-header">
        <div className="header-content">
          <div className="header-icon fifo"><Archive size={20} /></div>
          <div><h1>FIFO Stock Rotation</h1><p>Oldest stock first — expiry-driven batch management for FMCG</p></div>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="kpi-grid" style={{ marginBottom: 'var(--ds-sp-5)' }}>
          <SummaryCard label="Active Batches" value={summary.total_active_batches} color="#0d7a3e" />
          <SummaryCard label="Expired" value={summary.already_expired} color="var(--ds-danger)" />
          <SummaryCard label="Expiring 7d" value={summary.expiring_within_7_days} color="#e74c3c" />
          <SummaryCard label="Expiring 30d" value={summary.expiring_within_30_days} color="#e67e22" />
          <SummaryCard label="Stock Value" value={`OMR ${fmt(summary.total_stock_value)}`} color="#2c3e50" />
        </div>
      )}

      {error && <div className="message error">{error}</div>}
      {success && <div className="message success">{success}</div>}

      {/* Tabs */}
      <div className="tab-bar">
        {[
          { id: 'batches', label: 'All Batches' },
          { id: 'issue', label: 'FIFO Issue' },
          { id: 'receive', label: 'Receive Batch' },
          { id: 'expiring', label: 'Expiring Soon' },
        ].map(tab => (
          <button key={tab.id} onClick={() => { setActiveTab(tab.id); setError(''); setSuccess(''); }}
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── All Batches Tab ── */}
      {activeTab === 'batches' && (
        <div className="tab-content">
          {loading ? <div className="loading-state">Loading batches...</div> : batches.length === 0 ? (
            <div className="no-data">No active batches. Receive stock to create batches.</div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Product</th><th>SKU</th><th>Batch #</th><th>Received</th>
                    <th>Expiry</th><th>Status</th><th>Qty Received</th><th>Qty Remaining</th><th>Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map(b => (
                    <tr key={b.id}>
                      <td>{b.product_name}</td>
                      <td className="code">{b.sku}</td>
                      <td className="code">{b.batch_number}</td>
                      <td>{b.received_date}</td>
                      <td>{b.expiry_date || '—'} {expiryBadge(b.days_until_expiry)}</td>
                      <td>{b.status}</td>
                      <td className="center">{b.quantity_received}</td>
                      <td className="center" style={{ fontWeight: 600 }}>{b.quantity_remaining}</td>
                      <td className="value">{fmt(b.cost_price)}</td>
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
        <div className="tab-content">
          <h3>Issue Stock (FIFO — oldest expiry first)</h3>
          <div className="form-row-3">
            <div className="form-group">
              <label>Product *</label>
              <select value={issueProductId} onChange={e => { setIssueProductId(e.target.value); setSuggestedPicks(null); }}>
                <option value="">Select product...</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Quantity *</label>
              <input type="number" value={issueQuantity} onChange={e => { setIssueQuantity(e.target.value); setSuggestedPicks(null); }}
                min="0.001" step="0.001" placeholder="Qty" />
            </div>
            <div className="form-group">
              <label>Reference</label>
              <input value={issueReference} onChange={e => setIssueReference(e.target.value)} placeholder="SO-xxx" />
            </div>
          </div>

          <button onClick={handleSuggest} disabled={!issueProductId || !issueQuantity} className="action-btn primary"
            style={{ marginBottom: 'var(--ds-sp-4)', opacity: (issueProductId && issueQuantity) ? 1 : 0.5 }}>
            Suggest FIFO Picks
          </button>

          {/* Suggestion Results */}
          {suggestedPicks && (
            <div style={{ background: 'var(--ds-green-tint)', borderRadius: 'var(--ds-r-md)', padding: 'var(--ds-sp-4)', marginBottom: 'var(--ds-sp-4)', border: '1px solid var(--ds-success-border)' }}>
              <h4 style={{ margin: '0 0 var(--ds-sp-3)', color: 'var(--ds-green)', fontFamily: 'var(--ds-font-ui)' }}>
                Suggested Picks {suggestedPicks.fully_satisfiable ? '' : '— Shortfall'}
              </h4>
              {suggestedPicks.shortfall > 0 && (
                <p className="negative" style={{ marginBottom: 'var(--ds-sp-3)', fontSize: 'var(--ds-text-sm)' }}>
                  Shortfall: {suggestedPicks.shortfall} units — not enough stock
                </p>
              )}
              <div className="table-container">
                <table className="data-table compact">
                  <thead>
                    <tr><th>Batch</th><th>Expiry</th><th>Status</th><th>Available</th><th>Pick Qty</th></tr>
                  </thead>
                  <tbody>
                    {suggestedPicks.picks.map((p, i) => (
                      <tr key={i}>
                        <td className="code">{p.batch_number}</td>
                        <td>{p.expiry_date || '—'} {expiryBadge(p.days_until_expiry)}</td>
                        <td>{p.days_until_expiry !== null && p.days_until_expiry < 0 ? 'Expired' : 'Active'}</td>
                        <td className="center">{p.quantity_available}</td>
                        <td className="center positive">{p.pick_quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ display: 'flex', gap: 'var(--ds-sp-3)', marginTop: 'var(--ds-sp-4)' }}>
                <button onClick={handleIssue} className="action-btn primary">Confirm Issue ({suggestedPicks.total_picked} units)</button>
                <button onClick={() => setSuggestedPicks(null)} className="cancel-btn">Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Receive Batch Tab ── */}
      {activeTab === 'receive' && (
        <div className="tab-content">
          <h3>Receive New Batch</h3>
          <div className="form-group" style={{ marginBottom: 'var(--ds-sp-3)' }}>
            <label>Product *</label>
            <select value={rcvProductId} onChange={e => setRcvProductId(e.target.value)}>
              <option value="">Select product...</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
            </select>
          </div>
          <div className="form-row-2">
            <div className="form-group">
              <label>Quantity *</label>
              <input type="number" value={rcvQty} onChange={e => setRcvQty(e.target.value)} min="0.001" step="0.001" />
            </div>
            <div className="form-group">
              <label>Cost Price (OMR)</label>
              <input type="number" value={rcvCost} onChange={e => setRcvCost(e.target.value)} min="0" step="0.001" />
            </div>
          </div>
          <div className="form-row-2">
            <div className="form-group">
              <label>Batch Number</label>
              <input value={rcvBatch} onChange={e => setRcvBatch(e.target.value)} placeholder="Auto-generated if empty" />
            </div>
            <div className="form-group">
              <label>Expiry Date *</label>
              <input type="date" value={rcvExpiry} onChange={e => setRcvExpiry(e.target.value)} />
            </div>
          </div>
          <button onClick={handleReceive} disabled={!rcvProductId || !rcvQty} className="action-btn primary"
            style={{ opacity: (rcvProductId && rcvQty) ? 1 : 0.5, marginTop: 'var(--ds-sp-2)' }}>
            Receive Batch
          </button>
        </div>
      )}

      {/* ── Expiring Soon Tab ── */}
      {activeTab === 'expiring' && (
        <div className="tab-content">
          <div className="filter-bar" style={{ marginBottom: 'var(--ds-sp-4)' }}>
            <label style={{ fontSize: 'var(--ds-text-sm)', fontWeight: 600, color: 'var(--ds-text-sub)', fontFamily: 'var(--ds-font-ui)' }}>
              Show batches expiring within:
            </label>
            <select value={expiryDays} onChange={e => { setExpiryDays(Number(e.target.value)); }}
              className="filter-select">
              <option value="7">7 days</option>
              <option value="14">14 days</option>
              <option value="30">30 days</option>
              <option value="60">60 days</option>
              <option value="90">90 days</option>
            </select>
            <button onClick={loadExpiring} className="action-btn">Refresh</button>
          </div>

          {expiring.length === 0 ? (
            <div className="no-data" style={{ color: 'var(--ds-green)' }}>No batches expiring within {expiryDays} days.</div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr><th>Product</th><th>Batch #</th><th>Expiry</th><th>Days Left</th><th>Qty Remaining</th><th>Value (OMR)</th></tr>
                </thead>
                <tbody>
                  {expiring.map(b => (
                    <tr key={b.id} className={b.is_expired ? 'overdue-row' : ''}>
                      <td>{b.product_name}</td>
                      <td className="code">{b.batch_number}</td>
                      <td>{b.expiry_date}</td>
                      <td>{expiryBadge(b.days_until_expiry)}</td>
                      <td className="center" style={{ fontWeight: 600 }}>{b.quantity_remaining}</td>
                      <td className="value">{fmt(b.quantity_remaining * (b.cost_price || 0))}</td>
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

function SummaryCard({ label, value, color }) {
  return (
    <div className="kpi-card" style={{ borderLeftColor: color }}>
      <div className="kpi-body">
        <div className="kpi-label">{label}</div>
        <div className="kpi-value" style={{ color }}>{value}</div>
      </div>
    </div>
  );
}

export default FIFOStockManager;
