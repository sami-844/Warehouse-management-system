import LoadingSpinner from './LoadingSpinner';
import React, { useState, useEffect } from 'react';
import { accountingAPI } from '../services/api';
import './AdminPanel.css';
import { BookOpen } from 'lucide-react';

function JournalEntries() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10));
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));
  const [refType, setRefType] = useState('');
  const [search, setSearch] = useState('');
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [lines, setLines] = useState([]);
  const [linesLoading, setLinesLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  useEffect(() => { load(); }, [fromDate, toDate, refType]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = async () => {
    setLoading(true);
    try {
      const params = { from_date: fromDate, to_date: toDate };
      if (refType) params.reference_type = refType;
      if (search) params.search = search;
      const d = await accountingAPI.journalEntries(params);
      setEntries(Array.isArray(d) ? d : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const viewLines = async (entry) => {
    setSelectedEntry(entry);
    setLinesLoading(true);
    try {
      const d = await accountingAPI.journalEntryLines(entry.id);
      setLines(Array.isArray(d) ? d : []);
    } catch (e) {
      setLines([]);
    } finally {
      setLinesLoading(false);
    }
  };

  const recalculate = async () => {
    try {
      const res = await accountingAPI.recalculateBalances();
      setMessage({ text: res.message || 'Balances recalculated', type: 'success' });
    } catch (e) {
      setMessage({ text: e.response?.data?.detail || 'Failed', type: 'error' });
    }
  };

  const refTypeColor = (t) => ({
    SALES_INVOICE: '#16a34a', SALES_PAYMENT: '#059669',
    PURCHASE_INVOICE: '#d97706', PURCHASE_PAYMENT: '#ea580c',
    EXPENSE: '#dc2626',
  }[t] || '#6b7280');

  const totalDebit = entries.reduce((s, e) => s + (e.total_debit || 0), 0);
  const totalCredit = entries.reduce((s, e) => s + (e.total_credit || 0), 0);

  return (
    <div className="admin-container">
      <div className="page-header">
        <div className="header-content">
          <div className="header-icon finance"><BookOpen size={20} /></div>
          <div><h1>Journal Entries</h1><p>Double-entry accounting records — auto-posted from transactions</p></div>
        </div>
        <button onClick={recalculate} className="action-btn primary">Recalculate Balances</button>
      </div>

      {message.text && <div className={`message ${message.type}`}>{message.text}</div>}

      <div className="filter-bar">
        <select value={refType} onChange={e => setRefType(e.target.value)} className="filter-input">
          <option value="">All Types</option>
          <option value="SALES_INVOICE">Sales Invoice</option>
          <option value="SALES_PAYMENT">Sales Payment</option>
          <option value="PURCHASE_INVOICE">Purchase Invoice</option>
          <option value="PURCHASE_PAYMENT">Purchase Payment</option>
          <option value="EXPENSE">Expense</option>
        </select>
        <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="filter-input" />
        <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="filter-input" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="filter-input"
          onKeyDown={e => e.key === 'Enter' && load()} />
        <button className="action-btn" onClick={load}>Search</button>
      </div>

      {/* Summary */}
      {!loading && entries.length > 0 && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ background: 'var(--ds-surface)', border: '1px solid var(--ds-border)', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, color: 'var(--ds-text-sub)' }}>
            Entries: {entries.length}
          </div>
          <div style={{ background: 'var(--ds-surface)', border: '1px solid #16a34a', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, color: '#16a34a' }}>
            Total Debit: {totalDebit.toFixed(3)}
          </div>
          <div style={{ background: 'var(--ds-surface)', border: '1px solid #dc2626', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, color: '#dc2626' }}>
            Total Credit: {totalCredit.toFixed(3)}
          </div>
        </div>
      )}

      {loading ? <LoadingSpinner text="Loading journal entries..." /> : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Entry #</th><th>Date</th><th>Description</th><th>Reference</th>
                <th style={{ textAlign: 'right' }}>Debit</th><th style={{ textAlign: 'right' }}>Credit</th>
                <th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr><td colSpan="8" className="no-data">No journal entries found</td></tr>
              ) : entries.map(e => (
                <tr key={e.id}>
                  <td style={{ fontFamily: 'var(--ds-font-mono)', fontSize: 12 }}>{e.entry_number}</td>
                  <td>{e.entry_date}</td>
                  <td>{e.description}</td>
                  <td>
                    <span style={{
                      background: refTypeColor(e.reference_type), color: '#fff',
                      padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                    }}>
                      {(e.reference_type || '').replace('_', ' ')}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)', fontWeight: 600 }}>{e.total_debit.toFixed(3)}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)', fontWeight: 600 }}>{e.total_credit.toFixed(3)}</td>
                  <td>
                    <span className={e.is_posted === 'posted' ? 'positive' : 'negative'}>{e.is_posted}</span>
                  </td>
                  <td>
                    <button className="view-btn" onClick={() => viewLines(e)}>Lines</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Lines Modal */}
      {selectedEntry && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }} onClick={() => setSelectedEntry(null)}>
          <div style={{
            background: 'var(--ds-surface)', borderRadius: 12, padding: 24,
            minWidth: 600, maxWidth: '90vw', maxHeight: '80vh', overflow: 'auto',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontFamily: 'var(--ds-font-ui)' }}>{selectedEntry.entry_number}</h3>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--ds-text-muted)' }}>
                  {selectedEntry.entry_date} — {selectedEntry.description}
                </p>
              </div>
              <button onClick={() => setSelectedEntry(null)} style={{
                background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--ds-text-muted)',
              }}>X</button>
            </div>
            {linesLoading ? <LoadingSpinner text="Loading lines..." /> : (
              <table className="data-table" style={{ fontSize: 13 }}>
                <thead>
                  <tr>
                    <th>Account</th><th>Name</th><th>Description</th>
                    <th style={{ textAlign: 'right' }}>Debit</th><th style={{ textAlign: 'right' }}>Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map(l => (
                    <tr key={l.id}>
                      <td style={{ fontFamily: 'var(--ds-font-mono)', fontWeight: 700 }}>{l.account_code}</td>
                      <td>{l.account_name}</td>
                      <td style={{ color: 'var(--ds-text-muted)', fontSize: 12 }}>{l.description}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)', color: l.debit > 0 ? '#16a34a' : 'var(--ds-text-muted)' }}>
                        {l.debit > 0 ? l.debit.toFixed(3) : '-'}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)', color: l.credit > 0 ? '#dc2626' : 'var(--ds-text-muted)' }}>
                        {l.credit > 0 ? l.credit.toFixed(3) : '-'}
                      </td>
                    </tr>
                  ))}
                  <tr style={{ fontWeight: 700, borderTop: '2px solid var(--ds-border)' }}>
                    <td colSpan="3" style={{ textAlign: 'right' }}>Total</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)' }}>
                      {lines.reduce((s, l) => s + l.debit, 0).toFixed(3)}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)' }}>
                      {lines.reduce((s, l) => s + l.credit, 0).toFixed(3)}
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default JournalEntries;
