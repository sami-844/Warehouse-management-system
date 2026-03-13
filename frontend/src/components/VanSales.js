// VanSales — Admin/Manager overview of all van sales activity
import React, { useState, useEffect } from 'react';
import EmptyState from './EmptyState';
import { vanSalesAPI } from '../services/api';
import { Truck } from 'lucide-react';

function VanSales() {
  const [tab, setTab] = useState('balances'); // balances | sessions | history
  const [summaries, setSummaries] = useState([]);
  const [allSheets, setAllSheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [expandedData, setExpandedData] = useState(null);

  // Filters
  const [filterDriver, setFilterDriver] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [drivers, setDrivers] = useState([]);

  useEffect(() => { loadAll(); }, []); // eslint-disable-line

  const loadAll = async () => {
    setLoading(true);
    try {
      const [sum, sheets, drvs] = await Promise.allSettled([
        vanSalesAPI.driverSummary(),
        vanSalesAPI.list({}),
        vanSalesAPI.drivers(),
      ]);
      setSummaries(sum.status === 'fulfilled' && Array.isArray(sum.value) ? sum.value : []);
      setAllSheets(sheets.status === 'fulfilled' && Array.isArray(sheets.value) ? sheets.value : []);
      setDrivers(drvs.status === 'fulfilled' && Array.isArray(drvs.value) ? drvs.value : []);
    } catch (e) { setError('Failed to load data'); }
    finally { setLoading(false); }
  };

  const handleSettle = async (id) => {
    if (!window.confirm('Mark this sheet as settled?')) return;
    try {
      await vanSalesAPI.settle(id);
      loadAll();
    } catch (e) { setError('Failed to settle'); }
  };

  const toggleExpand = async (id) => {
    if (expandedId === id) { setExpandedId(null); setExpandedData(null); return; }
    try {
      const data = await vanSalesAPI.get(id);
      setExpandedData(data);
      setExpandedId(id);
    } catch (e) { setError('Failed to load sheet details'); }
  };

  // Filter sheets
  const filteredSheets = allSheets.filter(s => {
    if (filterDriver && String(s.driver_id) !== filterDriver) return false;
    if (filterStatus && s.status !== filterStatus) return false;
    if (filterFrom && s.date < filterFrom) return false;
    if (filterTo && s.date > filterTo) return false;
    return true;
  });

  // KPI totals
  const totalDue = summaries.reduce((s, d) => s + (d.running_due || 0), 0);
  const totalSales = summaries.reduce((s, d) => s + (d.total_sales || 0), 0);
  const totalCollected = summaries.reduce((s, d) => s + (d.total_collected || 0), 0);
  const totalProfit = summaries.reduce((s, d) => s + (d.total_profit || 0), 0);

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="admin-container">
      <div className="page-header">
        <div className="header-content">
          <div className="header-icon"><Truck size={20} /></div>
          <div>
            <h1>Van Sales</h1>
            <p>Driver route accounting overview</p>
          </div>
        </div>
      </div>

      {error && <div style={{ padding: '10px 14px', background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: 6, color: '#DC2626', fontSize: 13, marginBottom: 12 }}>{error}</div>}

      {/* KPI Row */}
      <div className="wms-kpi-row" style={{ marginBottom: 16 }}>
        <div className="wms-kpi-card">
          <div className="wms-kpi-label">Active Drivers</div>
          <div className="wms-kpi-value">{summaries.length}</div>
        </div>
        <div className="wms-kpi-card">
          <div className="wms-kpi-label">Total Sales</div>
          <div className="wms-kpi-value blue">{totalSales.toFixed(3)}<span style={{ fontSize: 11, marginLeft: 4, color: '#94a3b8' }}>OMR</span></div>
        </div>
        <div className="wms-kpi-card">
          <div className="wms-kpi-label">Total Collected</div>
          <div className="wms-kpi-value green">{totalCollected.toFixed(3)}<span style={{ fontSize: 11, marginLeft: 4, color: '#94a3b8' }}>OMR</span></div>
        </div>
        <div className="wms-kpi-card">
          <div className="wms-kpi-label">Total Due</div>
          <div className="wms-kpi-value" style={{ color: totalDue > 0 ? '#DC2626' : '#16a34a' }}>{totalDue.toFixed(3)}<span style={{ fontSize: 11, marginLeft: 4, color: '#94a3b8' }}>OMR</span></div>
        </div>
        <div className="wms-kpi-card">
          <div className="wms-kpi-label">Total Profit</div>
          <div className="wms-kpi-value" style={{ color: '#2563EB' }}>{totalProfit.toFixed(3)}<span style={{ fontSize: 11, marginLeft: 4, color: '#94a3b8' }}>OMR</span></div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '2px solid #e2e8f0' }}>
        {[
          { key: 'balances', label: 'Driver Balances' },
          { key: 'sessions', label: 'Daily Sessions' },
          { key: 'history', label: 'All Sheets' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            border: 'none', background: 'none',
            borderBottom: tab === t.key ? '3px solid #1A7B5B' : '3px solid transparent',
            color: tab === t.key ? '#1A7B5B' : '#64748b',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ═══ Tab 1: Driver Balances ═══ */}
      {tab === 'balances' && (
        summaries.length === 0 ? (
          <EmptyState title="No van sales data" hint="Create daily sheets in Van Sales Entry to see driver balances" />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {summaries.map(s => (
              <div key={s.driver_id} style={{
                background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 20,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1a2332', margin: 0 }}>{s.driver_name}</h3>
                  <span style={{
                    fontSize: 11, padding: '3px 10px', borderRadius: 4, fontWeight: 700,
                    background: s.running_due > 0 ? '#FEE2E2' : '#DCFCE7',
                    color: s.running_due > 0 ? '#DC2626' : '#16a34a',
                  }}>{s.running_due > 0 ? 'DUE' : 'CLEAR'}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <Stat label="Total Sales" value={`${s.total_sales.toFixed(3)}`} />
                  <Stat label="Collected" value={`${s.total_collected.toFixed(3)}`} color="#16a34a" />
                  <Stat label="Profit" value={`${s.total_profit.toFixed(3)}`} color="#2563EB" />
                  <Stat label="Running Due" value={`${s.running_due.toFixed(3)}`} color={s.running_due > 0 ? '#DC2626' : '#16a34a'} large />
                </div>
                <div style={{ marginTop: 10, fontSize: 12, color: '#94a3b8' }}>
                  {s.sheet_count} sheets | Last: {s.last_date || '---'}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ═══ Tab 2: Daily Sessions (recent) ═══ */}
      {tab === 'sessions' && (
        <>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <select value={filterDriver} onChange={e => setFilterDriver(e.target.value)} className="filter-select" style={{ minWidth: 180 }}>
              <option value="">All Drivers</option>
              {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="filter-select">
              <option value="">All Status</option>
              <option value="open">Open</option>
              <option value="settled">Settled</option>
            </select>
            <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} className="filter-select" />
            <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} className="filter-select" />
          </div>
          {filteredSheets.length === 0 ? (
            <EmptyState title="No sessions found" hint="Adjust filters or create a van sales sheet" />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={thS}>Date</th>
                    <th style={thS}>Driver</th>
                    <th style={thS}>Sales</th>
                    <th style={thS}>Cost</th>
                    <th style={thS}>Profit</th>
                    <th style={thS}>Collection</th>
                    <th style={thS}>Discounts</th>
                    <th style={thS}>Daily Due</th>
                    <th style={thS}>Running Due</th>
                    <th style={thS}>Status</th>
                    <th style={thS}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSheets.map(h => (
                    <React.Fragment key={h.id}>
                      <tr style={{ borderBottom: '1px solid #e2e8f0', cursor: 'pointer' }} onClick={() => toggleExpand(h.id)}>
                        <td style={tdS}>{h.date}</td>
                        <td style={tdS}>{h.driver_name}</td>
                        <td style={{ ...tdS, textAlign: 'right' }}>{Number(h.total_sales).toFixed(3)}</td>
                        <td style={{ ...tdS, textAlign: 'right' }}>{Number(h.total_cost).toFixed(3)}</td>
                        <td style={{ ...tdS, textAlign: 'right', color: '#16a34a', fontWeight: 600 }}>{Number(h.total_profit).toFixed(3)}</td>
                        <td style={{ ...tdS, textAlign: 'right' }}>{Number(h.collection_cash).toFixed(3)}</td>
                        <td style={{ ...tdS, textAlign: 'right' }}>{Number(h.sales_discounts).toFixed(3)}</td>
                        <td style={{ ...tdS, textAlign: 'right', color: '#92400E', fontWeight: 600 }}>{Number(h.daily_due).toFixed(3)}</td>
                        <td style={{ ...tdS, textAlign: 'right', color: '#DC2626', fontWeight: 700 }}>{Number(h.running_due).toFixed(3)}</td>
                        <td style={tdS}>
                          <span className={`wms-badge ${h.status === 'settled' ? 'completed' : 'pending'}`}>{h.status}</span>
                        </td>
                        <td style={tdS} onClick={e => e.stopPropagation()}>
                          {h.status !== 'settled' && (
                            <button onClick={() => handleSettle(h.id)} style={settleBtn}>Settle</button>
                          )}
                        </td>
                      </tr>
                      {/* Expanded detail row */}
                      {expandedId === h.id && expandedData && (
                        <tr>
                          <td colSpan={11} style={{ padding: 0 }}>
                            <div style={{ background: '#F8FAFC', padding: '14px 20px', borderBottom: '2px solid #e2e8f0' }}>
                              <div style={{ fontWeight: 700, fontSize: 13, color: '#1a2332', marginBottom: 8 }}>Line Items</div>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                <thead>
                                  <tr style={{ background: '#E2E8F0' }}>
                                    <th style={ithS}>SL</th><th style={ithS}>Product</th><th style={ithS}>Unit</th>
                                    <th style={ithS}>Qty</th><th style={ithS}>Sell Price</th><th style={ithS}>Total Sell</th>
                                    <th style={ithS}>Cost Price</th><th style={ithS}>Total Cost</th><th style={ithS}>Profit</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(expandedData.items || []).map((it, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                      <td style={itdS}>{it.sl_no}</td>
                                      <td style={{ ...itdS, textAlign: 'left' }}>{it.product_name}</td>
                                      <td style={itdS}>{it.unit}</td>
                                      <td style={itdS}>{Number(it.quantity).toFixed(0)}</td>
                                      <td style={{ ...itdS, textAlign: 'right' }}>{Number(it.sell_price).toFixed(3)}</td>
                                      <td style={{ ...itdS, textAlign: 'right', fontWeight: 600 }}>{Number(it.total_sell).toFixed(3)}</td>
                                      <td style={{ ...itdS, textAlign: 'right' }}>{Number(it.purchase_price).toFixed(3)}</td>
                                      <td style={{ ...itdS, textAlign: 'right' }}>{Number(it.total_purchase).toFixed(3)}</td>
                                      <td style={{ ...itdS, textAlign: 'right', fontWeight: 600, color: it.profit >= 0 ? '#16a34a' : '#DC2626' }}>{Number(it.profit).toFixed(3)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              {expandedData.notes && (
                                <div style={{ marginTop: 8, fontSize: 12, color: '#64748b' }}>Notes: {expandedData.notes}</div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ═══ Tab 3: All Sheets (same table, no filters pre-set) ═══ */}
      {tab === 'history' && (
        allSheets.length === 0 ? (
          <EmptyState title="No sheets yet" hint="Create daily van sales sheets to see history here" />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={thS}>ID</th>
                  <th style={thS}>Date</th>
                  <th style={thS}>Driver</th>
                  <th style={thS}>Sales</th>
                  <th style={thS}>Profit</th>
                  <th style={thS}>Collection</th>
                  <th style={thS}>Daily Due</th>
                  <th style={thS}>Running Due</th>
                  <th style={thS}>Status</th>
                </tr>
              </thead>
              <tbody>
                {allSheets.map(h => (
                  <tr key={h.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={tdS}>#{h.id}</td>
                    <td style={tdS}>{h.date}</td>
                    <td style={tdS}>{h.driver_name}</td>
                    <td style={{ ...tdS, textAlign: 'right' }}>{Number(h.total_sales).toFixed(3)}</td>
                    <td style={{ ...tdS, textAlign: 'right', color: '#16a34a', fontWeight: 600 }}>{Number(h.total_profit).toFixed(3)}</td>
                    <td style={{ ...tdS, textAlign: 'right' }}>{Number(h.collection_cash).toFixed(3)}</td>
                    <td style={{ ...tdS, textAlign: 'right', color: '#92400E', fontWeight: 600 }}>{Number(h.daily_due).toFixed(3)}</td>
                    <td style={{ ...tdS, textAlign: 'right', color: '#DC2626', fontWeight: 700 }}>{Number(h.running_due).toFixed(3)}</td>
                    <td style={tdS}>
                      <span className={`wms-badge ${h.status === 'settled' ? 'completed' : 'pending'}`}>{h.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}

// ── Helpers ──
function Stat({ label, value, color, large }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: large ? 20 : 16, fontWeight: 700, color: color || '#1a2332' }}>{value}</div>
    </div>
  );
}

const thS = { padding: '8px 10px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #e2e8f0' };
const tdS = { padding: '8px 10px', fontSize: 13, color: '#1a2332', textAlign: 'center' };
const ithS = { padding: '6px 8px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#475569' };
const itdS = { padding: '5px 8px', fontSize: 12, color: '#1a2332', textAlign: 'center' };
const settleBtn = { padding: '4px 10px', fontSize: 11, borderRadius: 4, border: 'none', background: '#16a34a', color: '#fff', cursor: 'pointer', fontWeight: 600 };

export default VanSales;
