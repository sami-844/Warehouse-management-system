import LoadingSpinner from './LoadingSpinner';
import React, { useState } from 'react';
import { accountingAPI } from '../services/api';
import './AdminPanel.css';
import { Landmark, Upload, Link2, Check, X } from 'lucide-react';

/* ── CSV Parser ── */
const parseBankCSV = (csvText) => {
  const rows = csvText.trim().split('\n').map(r => r.split(','));
  const header = rows[0].map(h => h.trim().toLowerCase());

  const dateIdx = header.findIndex(h => h.includes('date'));
  const descIdx = header.findIndex(h => h.includes('description') || h.includes('reference') || h.includes('narration'));
  const creditIdx = header.findIndex(h => h.includes('credit') || h.includes('amount in') || h.includes('deposit'));
  const debitIdx = header.findIndex(h => h.includes('debit') || h.includes('amount out') || h.includes('withdrawal'));
  const amountIdx = header.findIndex(h => h === 'amount');

  return rows.slice(1).map((row, i) => {
    let amountIn = 0, amountOut = 0;
    if (amountIdx !== -1 && creditIdx === -1) {
      const val = parseFloat((row[amountIdx] || '').replace(/[^0-9.-]/g, '')) || 0;
      if (val >= 0) amountIn = val; else amountOut = Math.abs(val);
    } else {
      amountIn = parseFloat((row[creditIdx] || '').replace(/[^0-9.-]/g, '')) || 0;
      amountOut = parseFloat((row[debitIdx] || '').replace(/[^0-9.-]/g, '')) || 0;
    }
    return {
      id: `bank-${i}`,
      date: (row[dateIdx] || '').trim(),
      description: (row[descIdx >= 0 ? descIdx : 1] || '').trim(),
      amount_in: amountIn,
      amount_out: amountOut,
      matched: false,
      matched_system_id: null,
    };
  }).filter(r => r.date);
};

function BankReconciliation() {
  const [bankItems, setBankItems] = useState([]);
  const [systemRecords, setSystemRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fromDate, setFromDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedBank, setSelectedBank] = useState(null);
  const [selectedSystem, setSelectedSystem] = useState(null);
  const [matchedPairs, setMatchedPairs] = useState([]);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [manualEntry, setManualEntry] = useState({ date: '', description: '', amount_in: '', amount_out: '' });

  const loadSystemRecords = async () => {
    setLoading(true);
    try {
      const d = await accountingAPI.bankReconSystemRecords({ from_date: fromDate, to_date: toDate });
      const records = (Array.isArray(d) ? d : []).map(r => ({
        ...r,
        amount: parseFloat(r.amount) || 0,
        matched: false,
        matched_bank_id: null,
      }));
      setSystemRecords(records);
    } catch (e) {
      setMessage({ text: 'Failed to load system records', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleCSVUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const items = parseBankCSV(ev.target.result);
      setBankItems(prev => [...prev, ...items]);
      setMessage({ text: `Imported ${items.length} bank transactions`, type: 'success' });
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const addManualEntry = () => {
    if (!manualEntry.date || !manualEntry.description) return;
    const newItem = {
      id: `bank-manual-${Date.now()}`,
      date: manualEntry.date,
      description: manualEntry.description,
      amount_in: parseFloat(manualEntry.amount_in) || 0,
      amount_out: parseFloat(manualEntry.amount_out) || 0,
      matched: false,
      matched_system_id: null,
    };
    setBankItems(prev => [...prev, newItem]);
    setManualEntry({ date: '', description: '', amount_in: '', amount_out: '' });
  };

  const matchSelected = () => {
    if (!selectedBank || !selectedSystem) return;
    const pair = { bank_id: selectedBank, system_id: selectedSystem };
    setMatchedPairs(prev => [...prev, pair]);
    setBankItems(prev => prev.map(b => b.id === selectedBank ? { ...b, matched: true, matched_system_id: selectedSystem } : b));
    setSystemRecords(prev => prev.map(s => s.id === selectedSystem ? { ...s, matched: true, matched_bank_id: selectedBank } : s));
    setSelectedBank(null);
    setSelectedSystem(null);
  };

  const unmatch = (bankId, systemId) => {
    setMatchedPairs(prev => prev.filter(p => !(p.bank_id === bankId && p.system_id === systemId)));
    setBankItems(prev => prev.map(b => b.id === bankId ? { ...b, matched: false, matched_system_id: null } : b));
    setSystemRecords(prev => prev.map(s => s.id === systemId ? { ...s, matched: false, matched_bank_id: null } : s));
  };

  const saveReconciliation = async () => {
    try {
      const res = await accountingAPI.bankReconSave({
        reconciliation_date: new Date().toISOString().slice(0, 10),
        opening_balance: 0,
        closing_balance: 0,
        matched_pairs: matchedPairs,
        notes: `Period: ${fromDate} to ${toDate}`,
      });
      setMessage({ text: res.message || 'Reconciliation saved', type: 'success' });
    } catch (e) {
      setMessage({ text: 'Failed to save reconciliation', type: 'error' });
    }
  };

  const fmt = (v) => (v || 0).toFixed(3);

  // Summary calcs
  const bankTotal = bankItems.reduce((s, b) => s + b.amount_in - b.amount_out, 0);
  const systemTotal = systemRecords.reduce((s, r) => {
    if (r.type === 'PURCHASE_PAYMENT' || r.type === 'TRANSFER') return s - r.amount;
    return s + r.amount;
  }, 0);
  const unmatchedBank = bankItems.filter(b => !b.matched);
  const unmatchedSystem = systemRecords.filter(s => !s.matched);
  const unmatchedBankTotal = unmatchedBank.reduce((s, b) => s + b.amount_in - b.amount_out, 0);
  const unmatchedSystemTotal = unmatchedSystem.reduce((s, r) => {
    if (r.type === 'PURCHASE_PAYMENT' || r.type === 'TRANSFER') return s - r.amount;
    return s + r.amount;
  }, 0);

  const typeColor = (t) => ({
    SALES_PAYMENT: '#16a34a', PURCHASE_PAYMENT: '#d97706', TRANSFER: '#6366f1',
  }[t] || '#6b7280');

  return (
    <div className="admin-container">
      <div className="page-header">
        <div className="header-content">
          <div className="header-icon finance"><Landmark size={20} /></div>
          <div><h1>Bank Reconciliation</h1><p>Match bank statement transactions with system records</p></div>
        </div>
        {matchedPairs.length > 0 && (
          <button onClick={saveReconciliation} className="action-btn primary">
            Save Reconciliation ({matchedPairs.length} matched)
          </button>
        )}
      </div>

      {message.text && <div className={`message ${message.type}`}>{message.text}</div>}

      {/* Controls */}
      <div className="filter-bar">
        <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="filter-input" />
        <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="filter-input" />
        <button className="action-btn primary" onClick={loadSystemRecords}>Load System Records</button>
        <label style={{
          display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
          background: '#1a2332', color: '#fff', padding: '8px 14px', borderRadius: 6, fontSize: 13, fontWeight: 600,
        }}>
          <Upload size={14} /> Import CSV
          <input type="file" accept=".csv" onChange={handleCSVUpload} style={{ display: 'none' }} />
        </label>
      </div>

      {loading && <LoadingSpinner text="Loading system records..." />}

      {/* Two-Panel Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 12, marginTop: 16 }}>

        {/* LEFT: Bank Statement */}
        <div style={{ background: 'var(--ds-surface)', border: '1px solid var(--ds-border)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{
            padding: '12px 16px', background: '#1a2332', color: '#fff',
            fontWeight: 700, fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span>Bank Statement ({bankItems.length})</span>
            <span style={{ fontSize: 12, opacity: 0.8 }}>Net: OMR {fmt(bankTotal)}</span>
          </div>

          {/* Manual Entry Row */}
          <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--ds-border)', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <input type="date" value={manualEntry.date} onChange={e => setManualEntry(p => ({ ...p, date: e.target.value }))}
              style={{ flex: '0 0 110px', fontSize: 11, padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 4 }} />
            <input placeholder="Description" value={manualEntry.description} onChange={e => setManualEntry(p => ({ ...p, description: e.target.value }))}
              style={{ flex: 1, minWidth: 100, fontSize: 11, padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 4 }} />
            <input placeholder="In" value={manualEntry.amount_in} onChange={e => setManualEntry(p => ({ ...p, amount_in: e.target.value }))}
              style={{ flex: '0 0 65px', fontSize: 11, padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 4, textAlign: 'right' }} />
            <input placeholder="Out" value={manualEntry.amount_out} onChange={e => setManualEntry(p => ({ ...p, amount_out: e.target.value }))}
              style={{ flex: '0 0 65px', fontSize: 11, padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 4, textAlign: 'right' }} />
            <button onClick={addManualEntry} style={{
              background: '#16a34a', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 8px', fontSize: 11, cursor: 'pointer', fontWeight: 700,
            }}>+</button>
          </div>

          <div style={{ maxHeight: 400, overflow: 'auto' }}>
            {bankItems.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--ds-text-muted)', fontSize: 13 }}>
                Upload a CSV or add entries manually
              </div>
            ) : bankItems.map(item => (
              <div
                key={item.id}
                onClick={() => !item.matched && setSelectedBank(item.id)}
                style={{
                  padding: '8px 12px', borderBottom: '1px solid var(--ds-border)', cursor: item.matched ? 'default' : 'pointer',
                  background: item.matched ? '#f0fdf4' : item.id === selectedBank ? '#eff6ff' : 'transparent',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
                  transition: 'background 0.15s',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.description}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ds-text-muted)' }}>{item.date}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  {item.amount_in > 0 && <div style={{ fontSize: 12, fontFamily: 'var(--ds-font-mono)', fontWeight: 700, color: '#16a34a' }}>+{fmt(item.amount_in)}</div>}
                  {item.amount_out > 0 && <div style={{ fontSize: 12, fontFamily: 'var(--ds-font-mono)', fontWeight: 700, color: '#dc2626' }}>-{fmt(item.amount_out)}</div>}
                </div>
                {item.matched && <Check size={14} color="#16a34a" />}
                {!item.matched && item.id === selectedBank && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6' }} />}
              </div>
            ))}
          </div>
        </div>

        {/* MIDDLE: Match Button */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '0 4px' }}>
          <button
            onClick={matchSelected}
            disabled={!selectedBank || !selectedSystem}
            style={{
              background: selectedBank && selectedSystem ? '#16a34a' : '#d1d5db',
              color: '#fff', border: 'none', borderRadius: 8, padding: '10px 14px',
              cursor: selectedBank && selectedSystem ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700,
              transition: 'background 0.2s',
            }}
          >
            <Link2 size={14} /> Match
          </button>
          <div style={{ fontSize: 10, color: 'var(--ds-text-muted)', textAlign: 'center', maxWidth: 70 }}>
            Select one from each side
          </div>
        </div>

        {/* RIGHT: System Records */}
        <div style={{ background: 'var(--ds-surface)', border: '1px solid var(--ds-border)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{
            padding: '12px 16px', background: '#1a2332', color: '#fff',
            fontWeight: 700, fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span>System Records ({systemRecords.length})</span>
            <span style={{ fontSize: 12, opacity: 0.8 }}>Net: OMR {fmt(systemTotal)}</span>
          </div>
          <div style={{ maxHeight: 440, overflow: 'auto' }}>
            {systemRecords.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--ds-text-muted)', fontSize: 13 }}>
                Click "Load System Records" to fetch payments
              </div>
            ) : systemRecords.map(rec => (
              <div
                key={`${rec.type}-${rec.id}`}
                onClick={() => !rec.matched && setSelectedSystem(rec.id)}
                style={{
                  padding: '8px 12px', borderBottom: '1px solid var(--ds-border)',
                  cursor: rec.matched ? 'default' : 'pointer',
                  background: rec.matched ? '#f0fdf4' : rec.id === selectedSystem ? '#eff6ff' : 'transparent',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
                  transition: 'background 0.15s',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      background: typeColor(rec.type), color: '#fff', padding: '1px 6px', borderRadius: 3,
                      fontSize: 9, fontWeight: 700, textTransform: 'uppercase', flexShrink: 0,
                    }}>{(rec.type || '').replace('_', ' ')}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {rec.description}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ds-text-muted)', marginTop: 2 }}>
                    {rec.date} {rec.reference ? `| ${rec.reference}` : ''}
                  </div>
                </div>
                <div style={{
                  fontSize: 12, fontFamily: 'var(--ds-font-mono)', fontWeight: 700, flexShrink: 0,
                  color: rec.type === 'SALES_PAYMENT' ? '#16a34a' : '#dc2626',
                }}>
                  {rec.type === 'SALES_PAYMENT' ? '+' : '-'}{fmt(rec.amount)}
                </div>
                {rec.matched && <Check size={14} color="#16a34a" />}
                {!rec.matched && rec.id === selectedSystem && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6' }} />}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Matched Pairs */}
      {matchedPairs.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: 'var(--ds-text)' }}>
            Matched Transactions ({matchedPairs.length})
          </h3>
          <div className="table-container">
            <table className="data-table" style={{ fontSize: 12 }}>
              <thead>
                <tr>
                  <th>Bank Transaction</th>
                  <th>Bank Amount</th>
                  <th>System Record</th>
                  <th>System Amount</th>
                  <th>Difference</th>
                  <th style={{ width: 60 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {matchedPairs.map((pair, i) => {
                  const bank = bankItems.find(b => b.id === pair.bank_id);
                  const sys = systemRecords.find(s => s.id === pair.system_id);
                  const bankAmt = bank ? bank.amount_in - bank.amount_out : 0;
                  const sysAmt = sys ? (sys.type === 'SALES_PAYMENT' ? sys.amount : -sys.amount) : 0;
                  const diff = Math.abs(bankAmt - sysAmt);
                  return (
                    <tr key={i}>
                      <td>{bank?.description || '-'}</td>
                      <td style={{ fontFamily: 'var(--ds-font-mono)', fontWeight: 600 }}>{fmt(bankAmt)}</td>
                      <td>{sys?.description || '-'}</td>
                      <td style={{ fontFamily: 'var(--ds-font-mono)', fontWeight: 600 }}>{fmt(sysAmt)}</td>
                      <td style={{
                        fontFamily: 'var(--ds-font-mono)', fontWeight: 600,
                        color: diff > 0.001 ? '#dc2626' : '#16a34a',
                      }}>{fmt(diff)}</td>
                      <td>
                        <button onClick={() => unmatch(pair.bank_id, pair.system_id)} style={{
                          background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 4,
                          padding: '3px 8px', cursor: 'pointer', fontSize: 11, fontWeight: 600,
                          display: 'flex', alignItems: 'center', gap: 3,
                        }}>
                          <X size={11} /> Unmatch
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bottom Summary */}
      {(bankItems.length > 0 || systemRecords.length > 0) && (
        <div style={{
          marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 12,
        }}>
          <div style={{ background: 'var(--ds-surface)', border: '1px solid var(--ds-border)', borderRadius: 8, padding: '12px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ds-text-muted)' }}>Bank Statement Total</div>
            <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--ds-font-mono)', marginTop: 4 }}>OMR {fmt(bankTotal)}</div>
          </div>
          <div style={{ background: 'var(--ds-surface)', border: '1px solid var(--ds-border)', borderRadius: 8, padding: '12px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ds-text-muted)' }}>System Records Total</div>
            <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--ds-font-mono)', marginTop: 4 }}>OMR {fmt(systemTotal)}</div>
          </div>
          <div style={{ background: '#fffbeb', border: '1px solid #f59e0b', borderRadius: 8, padding: '12px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#92400e' }}>
              Unmatched Bank ({unmatchedBank.length})
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--ds-font-mono)', color: '#d97706', marginTop: 4 }}>
              OMR {fmt(unmatchedBankTotal)}
            </div>
          </div>
          <div style={{ background: '#fffbeb', border: '1px solid #f59e0b', borderRadius: 8, padding: '12px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#92400e' }}>
              Unmatched System ({unmatchedSystem.length})
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--ds-font-mono)', color: '#d97706', marginTop: 4 }}>
              OMR {fmt(unmatchedSystemTotal)}
            </div>
          </div>
          <div style={{
            background: Math.abs(bankTotal - systemTotal) < 0.001 ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${Math.abs(bankTotal - systemTotal) < 0.001 ? '#86efac' : '#fca5a5'}`,
            borderRadius: 8, padding: '12px 16px',
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ds-text-muted)' }}>Reconciliation Diff</div>
            <div style={{
              fontSize: 18, fontWeight: 800, fontFamily: 'var(--ds-font-mono)', marginTop: 4,
              color: Math.abs(bankTotal - systemTotal) < 0.001 ? '#16a34a' : '#dc2626',
            }}>
              OMR {fmt(Math.abs(bankTotal - systemTotal))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BankReconciliation;
