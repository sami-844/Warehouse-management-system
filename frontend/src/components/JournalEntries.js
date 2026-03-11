import LoadingSpinner from './LoadingSpinner';
import React, { useState, useEffect } from 'react';
import { accountingAPI } from '../services/api';
import './AdminPanel.css';
import { BookOpen, Plus } from 'lucide-react';

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

  // Manual Journal Entry modal
  const [showJEModal, setShowJEModal] = useState(false);
  const [jeForm, setJeForm] = useState({
    entry_date: new Date().toISOString().slice(0, 10),
    description: '',
    reference: '',
    lines: [
      { account_code: '', description: '', debit: '', credit: '' },
      { account_code: '', description: '', debit: '', credit: '' },
    ],
  });
  const [jeSubmitting, setJeSubmitting] = useState(false);

  // VAT Payment modal
  const [showVATModal, setShowVATModal] = useState(false);
  const [vatForm, setVatForm] = useState({
    period_from: '',
    period_to: '',
    vat_amount: '',
    payment_date: new Date().toISOString().slice(0, 10),
    payment_account: '1120',
    reference: '',
  });
  const [vatSubmitting, setVatSubmitting] = useState(false);

  // Account list for dropdown
  const accountOptions = [
    { code: '1110', name: 'Cash on Hand' },
    { code: '1120', name: 'Bank Account' },
    { code: '1210', name: 'Accounts Receivable' },
    { code: '1310', name: 'Inventory' },
    { code: '1410', name: 'Input VAT Recoverable' },
    { code: '2110', name: 'Accounts Payable' },
    { code: '2120', name: 'Customer Advances' },
    { code: '2210', name: 'VAT Payable' },
    { code: '3100', name: 'Owner Equity' },
    { code: '4110', name: 'Sales Revenue' },
    { code: '4200', name: 'Service Income' },
    { code: '4900', name: 'Other Income' },
    { code: '5100', name: 'Cost of Goods Sold' },
    { code: '6100', name: 'Rent Expense' },
    { code: '6200', name: 'Utilities' },
    { code: '6300', name: 'Salaries & Wages' },
    { code: '6400', name: 'Transportation' },
    { code: '6500', name: 'Office Supplies' },
    { code: '6600', name: 'Maintenance' },
    { code: '6700', name: 'Insurance' },
    { code: '6800', name: 'Marketing' },
    { code: '6900', name: 'Miscellaneous Expense' },
  ];

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
    EXPENSE: '#dc2626', MANUAL: '#6366f1', VAT_PAYMENT: '#8b5cf6',
    ADVANCE_PAYMENT: '#0891b2', ADVANCE_APPLICATION: '#0d9488',
    SALES_RETURN: '#f59e0b', PURCHASE_RETURN: '#ef4444',
    CASH_IN: '#16a34a', CASH_OUT: '#dc2626',
  }[t] || '#6b7280');

  const totalDebit = entries.reduce((s, e) => s + (e.total_debit || 0), 0);
  const totalCredit = entries.reduce((s, e) => s + (e.total_credit || 0), 0);

  // ─── Manual JE helpers ───
  const openJEModal = () => {
    setJeForm({
      entry_date: new Date().toISOString().slice(0, 10),
      description: '',
      reference: '',
      lines: [
        { account_code: '', description: '', debit: '', credit: '' },
        { account_code: '', description: '', debit: '', credit: '' },
      ],
    });
    setShowJEModal(true);
  };

  const updateJELine = (idx, field, value) => {
    const newLines = [...jeForm.lines];
    newLines[idx] = { ...newLines[idx], [field]: value };
    setJeForm({ ...jeForm, lines: newLines });
  };

  const addJELine = () => {
    setJeForm({ ...jeForm, lines: [...jeForm.lines, { account_code: '', description: '', debit: '', credit: '' }] });
  };

  const removeJELine = (idx) => {
    if (jeForm.lines.length <= 2) return;
    setJeForm({ ...jeForm, lines: jeForm.lines.filter((_, i) => i !== idx) });
  };

  const jeTotalDebit = jeForm.lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const jeTotalCredit = jeForm.lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const jeDifference = Math.abs(jeTotalDebit - jeTotalCredit);
  const jeBalanced = jeDifference < 0.001 && jeTotalDebit > 0;

  const handleJESubmit = async () => {
    if (!jeBalanced) return;
    if (!jeForm.description.trim()) {
      setMessage({ text: 'Description is required', type: 'error' });
      return;
    }
    setJeSubmitting(true);
    try {
      const payload = {
        entry_date: jeForm.entry_date,
        description: jeForm.description,
        reference: jeForm.reference || null,
        lines: jeForm.lines
          .filter(l => l.account_code && (Number(l.debit) > 0 || Number(l.credit) > 0))
          .map(l => ({
            account_code: l.account_code,
            description: l.description || null,
            debit: Number(l.debit) || 0,
            credit: Number(l.credit) || 0,
          })),
      };
      const res = await accountingAPI.createJournalEntry(payload);
      setMessage({ text: res.message || 'Journal entry created', type: 'success' });
      setShowJEModal(false);
      load();
    } catch (e) {
      setMessage({ text: e.response?.data?.detail || 'Failed to create journal entry', type: 'error' });
    } finally {
      setJeSubmitting(false);
    }
  };

  // ─── VAT Payment helpers ───
  const openVATModal = () => {
    setVatForm({
      period_from: '',
      period_to: '',
      vat_amount: '',
      payment_date: new Date().toISOString().slice(0, 10),
      payment_account: '1120',
      reference: '',
    });
    setShowVATModal(true);
  };

  const handleVATSubmit = async () => {
    if (!vatForm.vat_amount || Number(vatForm.vat_amount) <= 0) {
      setMessage({ text: 'VAT amount must be greater than 0', type: 'error' });
      return;
    }
    setVatSubmitting(true);
    try {
      const res = await accountingAPI.vatPayment({
        ...vatForm,
        vat_amount: Number(vatForm.vat_amount),
      });
      setMessage({ text: res.message || 'VAT payment recorded', type: 'success' });
      setShowVATModal(false);
      load();
    } catch (e) {
      setMessage({ text: e.response?.data?.detail || 'Failed to record VAT payment', type: 'error' });
    } finally {
      setVatSubmitting(false);
    }
  };

  return (
    <div className="admin-container">
      <div className="page-header">
        <div className="header-content">
          <div className="header-icon finance"><BookOpen size={20} /></div>
          <div><h1>Journal Entries</h1><p>Double-entry accounting records</p></div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={openJEModal} className="action-btn primary"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={16} /> New Journal Entry
          </button>
          <button onClick={openVATModal} className="action-btn"
            style={{ background: '#7c3aed', color: '#fff', border: 'none' }}>
            VAT Payment
          </button>
          <button onClick={recalculate} className="action-btn">Recalculate</button>
        </div>
      </div>

      {message.text && (
        <div className={`message ${message.type}`} style={{ marginBottom: 12 }}
          onClick={() => setMessage({ text: '', type: '' })}>{message.text}</div>
      )}

      <div className="filter-bar">
        <select value={refType} onChange={e => setRefType(e.target.value)} className="filter-input">
          <option value="">All Types</option>
          <option value="SALES_INVOICE">Sales Invoice</option>
          <option value="SALES_PAYMENT">Sales Payment</option>
          <option value="PURCHASE_INVOICE">Purchase Invoice</option>
          <option value="PURCHASE_PAYMENT">Purchase Payment</option>
          <option value="EXPENSE">Expense</option>
          <option value="MANUAL">Manual Entry</option>
          <option value="VAT_PAYMENT">VAT Payment</option>
          <option value="CASH_IN">Cash In</option>
          <option value="CASH_OUT">Cash Out</option>
          <option value="ADVANCE_PAYMENT">Advance Payment</option>
          <option value="ADVANCE_APPLICATION">Advance Application</option>
          <option value="SALES_RETURN">Sales Return</option>
          <option value="PURCHASE_RETURN">Purchase Return</option>
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
                      {(e.reference_type || '').replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)', fontWeight: 600 }}>{(e.total_debit || 0).toFixed(3)}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)', fontWeight: 600 }}>{(e.total_credit || 0).toFixed(3)}</td>
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
            background: 'var(--ds-surface, #fff)', borderRadius: 12, padding: 24,
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
                      {lines.reduce((s, l) => s + (l.debit || 0), 0).toFixed(3)}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)' }}>
                      {lines.reduce((s, l) => s + (l.credit || 0), 0).toFixed(3)}
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Manual Journal Entry Modal */}
      {showJEModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }} onClick={() => setShowJEModal(false)}>
          <div style={{
            background: 'var(--ds-surface, #fff)', borderRadius: 12, padding: 24,
            width: 700, maxWidth: '95vw', maxHeight: '90vh', overflow: 'auto',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0 }}>New Journal Entry</h3>
              <button onClick={() => setShowJEModal(false)} style={{
                background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280',
              }}>X</button>
            </div>

            {/* Header fields */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Date</label>
                <input type="date" value={jeForm.entry_date}
                  onChange={e => setJeForm({ ...jeForm, entry_date: e.target.value })}
                  className="filter-input" style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Description *</label>
                <input type="text" value={jeForm.description}
                  onChange={e => setJeForm({ ...jeForm, description: e.target.value })}
                  className="filter-input" style={{ width: '100%' }} placeholder="Journal entry description" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Reference</label>
                <input type="text" value={jeForm.reference}
                  onChange={e => setJeForm({ ...jeForm, reference: e.target.value })}
                  className="filter-input" style={{ width: '100%' }} placeholder="Optional ref" />
              </div>
            </div>

            {/* Lines table */}
            <table className="data-table" style={{ fontSize: 13, marginBottom: 12 }}>
              <thead>
                <tr>
                  <th style={{ width: 180 }}>Account</th>
                  <th>Description</th>
                  <th style={{ width: 120, textAlign: 'right' }}>Debit</th>
                  <th style={{ width: 120, textAlign: 'right' }}>Credit</th>
                  <th style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {jeForm.lines.map((line, idx) => (
                  <tr key={idx}>
                    <td>
                      <select value={line.account_code}
                        onChange={e => updateJELine(idx, 'account_code', e.target.value)}
                        style={{ width: '100%', padding: '4px 6px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 4 }}>
                        <option value="">— Account —</option>
                        {accountOptions.map(a => (
                          <option key={a.code} value={a.code}>{a.code} {a.name}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input type="text" value={line.description}
                        onChange={e => updateJELine(idx, 'description', e.target.value)}
                        style={{ width: '100%', padding: '4px 6px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 4 }}
                        placeholder="Line description" />
                    </td>
                    <td>
                      <input type="number" step="0.001" min="0" value={line.debit}
                        onChange={e => updateJELine(idx, 'debit', e.target.value)}
                        style={{ width: '100%', padding: '4px 6px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 4, textAlign: 'right' }}
                        placeholder="0.000" />
                    </td>
                    <td>
                      <input type="number" step="0.001" min="0" value={line.credit}
                        onChange={e => updateJELine(idx, 'credit', e.target.value)}
                        style={{ width: '100%', padding: '4px 6px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 4, textAlign: 'right' }}
                        placeholder="0.000" />
                    </td>
                    <td>
                      {jeForm.lines.length > 2 && (
                        <button onClick={() => removeJELine(idx)} style={{
                          background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 16, fontWeight: 700,
                        }}>X</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <button onClick={addJELine} className="action-btn" style={{ fontSize: 12, marginBottom: 16 }}>
              + Add Line
            </button>

            {/* Running totals */}
            <div style={{
              display: 'flex', gap: 16, padding: '10px 14px', borderRadius: 8,
              background: jeBalanced ? '#f0fdf4' : '#fef2f2',
              border: `1px solid ${jeBalanced ? '#bbf7d0' : '#fecaca'}`,
              fontSize: 13, fontWeight: 600, marginBottom: 16,
            }}>
              <span>Debits: {jeTotalDebit.toFixed(3)}</span>
              <span>Credits: {jeTotalCredit.toFixed(3)}</span>
              <span style={{ color: jeBalanced ? '#166534' : '#dc2626' }}>
                Difference: {jeDifference.toFixed(3)} {jeBalanced ? '(Balanced)' : '(Unbalanced)'}
              </span>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowJEModal(false)} className="action-btn">Cancel</button>
              <button onClick={handleJESubmit} disabled={jeSubmitting || !jeBalanced}
                className="action-btn primary"
                style={{ opacity: jeBalanced ? 1 : 0.5 }}>
                {jeSubmitting ? 'Saving...' : 'Post Journal Entry'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VAT Payment Modal */}
      {showVATModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }} onClick={() => setShowVATModal(false)}>
          <div style={{
            background: 'var(--ds-surface, #fff)', borderRadius: 12, padding: 24,
            width: 480, maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, color: '#7c3aed' }}>Record VAT Payment</h3>
              <button onClick={() => setShowVATModal(false)} style={{
                background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280',
              }}>X</button>
            </div>

            <div style={{ display: 'grid', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Period From</label>
                  <input type="date" value={vatForm.period_from}
                    onChange={e => setVatForm({ ...vatForm, period_from: e.target.value })}
                    className="filter-input" style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Period To</label>
                  <input type="date" value={vatForm.period_to}
                    onChange={e => setVatForm({ ...vatForm, period_to: e.target.value })}
                    className="filter-input" style={{ width: '100%' }} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>VAT Amount (OMR)</label>
                <input type="number" step="0.001" min="0" value={vatForm.vat_amount}
                  onChange={e => setVatForm({ ...vatForm, vat_amount: e.target.value })}
                  className="filter-input" style={{ width: '100%' }} placeholder="0.000" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Payment Date</label>
                  <input type="date" value={vatForm.payment_date}
                    onChange={e => setVatForm({ ...vatForm, payment_date: e.target.value })}
                    className="filter-input" style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Payment Account</label>
                  <select value={vatForm.payment_account}
                    onChange={e => setVatForm({ ...vatForm, payment_account: e.target.value })}
                    className="filter-input" style={{ width: '100%' }}>
                    <option value="1120">1120 — Bank Account</option>
                    <option value="1110">1110 — Cash on Hand</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Reference</label>
                <input type="text" value={vatForm.reference}
                  onChange={e => setVatForm({ ...vatForm, reference: e.target.value })}
                  className="filter-input" style={{ width: '100%' }} placeholder="Optional reference" />
              </div>

              <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 8, padding: 12, fontSize: 12, color: '#6b21a8' }}>
                Journal Entry: DR 2210 VAT Payable → CR {vatForm.payment_account === '1120' ? '1120 Bank' : '1110 Cash'}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setShowVATModal(false)} className="action-btn">Cancel</button>
              <button onClick={handleVATSubmit} disabled={vatSubmitting}
                className="action-btn primary" style={{ background: '#7c3aed', borderColor: '#7c3aed' }}>
                {vatSubmitting ? 'Saving...' : 'Record VAT Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default JournalEntries;
