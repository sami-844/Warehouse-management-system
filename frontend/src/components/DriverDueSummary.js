// Driver Due Summary — per-driver outstanding balance tracking
import React, { useState, useEffect } from 'react';
import EmptyState from './EmptyState';
import { vanSalesAPI } from '../services/api';

function DriverDueSummary() {
  const [summaries, setSummaries] = useState([]);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => { loadSummaries(); }, []);

  const loadSummaries = async () => {
    try {
      setLoading(true);
      const data = await vanSalesAPI.driverSummary();
      setSummaries(Array.isArray(data) ? data : []);
    } catch (e) { setError('Failed to load driver summaries'); }
    finally { setLoading(false); }
  };

  const loadDriverHistory = async (driverId) => {
    setSelectedDriver(driverId);
    try {
      const h = await vanSalesAPI.list({ driver_id: driverId });
      setHistory(Array.isArray(h) ? h : []);
    } catch (e) { setError('Failed to load history'); }
  };

  const handleSettle = async (accountId) => {
    if (!window.confirm('Mark this sheet as settled?')) return;
    try {
      await vanSalesAPI.settle(accountId);
      loadDriverHistory(selectedDriver);
      loadSummaries();
    } catch (e) { setError('Failed to settle'); }
  };

  const selectedSummary = summaries.find(s => s.driver_id === selectedDriver);

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="admin-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Driver Due Summary</h1>
          <p className="page-subtitle">Outstanding balances per driver</p>
        </div>
      </div>

      {error && <div style={{ padding: '10px 14px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 6, color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{error}</div>}

      {summaries.length === 0 ? (
        <EmptyState title="No van sales data yet" hint="Create your first daily van sales sheet to see driver balances" />
      ) : (
        <>
          {/* Driver Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16, marginBottom: 24 }}>
            {summaries.map(s => (
              <div key={s.driver_id}
                onClick={() => loadDriverHistory(s.driver_id)}
                style={{
                  background: '#fff', border: selectedDriver === s.driver_id ? '2px solid #1A7B5B' : '1px solid #e2e8f0',
                  borderRadius: 10, padding: 20, cursor: 'pointer', transition: 'border 0.15s',
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1a2332', margin: 0 }}>{s.driver_name}</h3>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 700,
                    background: s.running_due > 0 ? '#fee2e2' : '#dcfce7',
                    color: s.running_due > 0 ? '#dc2626' : '#16a34a',
                  }}>{s.running_due > 0 ? 'DUE' : 'CLEAR'}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase' }}>Total Sales</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#1a2332' }}>OMR {s.total_sales.toFixed(3)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase' }}>Total Collected</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#16a34a' }}>OMR {s.total_collected.toFixed(3)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase' }}>Total Profit</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#2563eb' }}>OMR {s.total_profit.toFixed(3)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase' }}>Running Due</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: s.running_due > 0 ? '#dc2626' : '#16a34a' }}>
                      OMR {s.running_due.toFixed(3)}
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: 8, fontSize: 12, color: '#94a3b8' }}>
                  {s.sheet_count} sheets | Last: {s.last_date || '—'}
                </div>
              </div>
            ))}
          </div>

          {/* Selected Driver History */}
          {selectedDriver && (
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1a2332', marginBottom: 12 }}>
                Daily Sheets — {selectedSummary?.driver_name}
              </h3>
              {history.length === 0 ? (
                <EmptyState title="No sheets" hint="No daily sheets found for this driver" />
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        <th style={thStyle}>Date</th>
                        <th style={thStyle}>Sales</th>
                        <th style={thStyle}>Cost</th>
                        <th style={thStyle}>Profit</th>
                        <th style={thStyle}>Collection</th>
                        <th style={thStyle}>Petrol</th>
                        <th style={thStyle}>Discounts</th>
                        <th style={thStyle}>Daily Due</th>
                        <th style={thStyle}>Running Due</th>
                        <th style={thStyle}>Status</th>
                        <th style={thStyle}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map(h => (
                        <tr key={h.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={tdStyle}>{h.date}</td>
                          <td style={{ ...tdStyle, textAlign: 'right' }}>{h.total_sales.toFixed(3)}</td>
                          <td style={{ ...tdStyle, textAlign: 'right' }}>{h.total_cost.toFixed(3)}</td>
                          <td style={{ ...tdStyle, textAlign: 'right', color: '#16a34a', fontWeight: 600 }}>{h.total_profit.toFixed(3)}</td>
                          <td style={{ ...tdStyle, textAlign: 'right' }}>{h.collection_cash.toFixed(3)}</td>
                          <td style={{ ...tdStyle, textAlign: 'right' }}>{h.expense_petrol.toFixed(3)}</td>
                          <td style={{ ...tdStyle, textAlign: 'right' }}>{h.sales_discounts.toFixed(3)}</td>
                          <td style={{ ...tdStyle, textAlign: 'right', color: '#92400e', fontWeight: 600 }}>{h.daily_due.toFixed(3)}</td>
                          <td style={{ ...tdStyle, textAlign: 'right', color: '#dc2626', fontWeight: 700, fontSize: 14 }}>{h.running_due.toFixed(3)}</td>
                          <td style={tdStyle}>
                            <span className={`wms-badge ${h.status === 'settled' ? 'completed' : 'pending'}`}>{h.status}</span>
                          </td>
                          <td style={tdStyle}>
                            {h.status !== 'settled' && (
                              <button onClick={() => handleSettle(h.id)}
                                style={{ padding: '3px 8px', fontSize: 11, borderRadius: 4, border: 'none', background: '#16a34a', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
                                Settle
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const thStyle = { padding: '8px 10px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #e2e8f0' };
const tdStyle = { padding: '8px 10px', fontSize: 13, color: '#1a2332', textAlign: 'center' };

export default DriverDueSummary;
