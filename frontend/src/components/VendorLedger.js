import LoadingSpinner from './LoadingSpinner';
import React, { useState, useEffect } from 'react';
import { reportsAPI, supplierAPI } from '../services/api';
import './AdminPanel.css';
import { Truck } from 'lucide-react';

function VendorLedger() {
  const [suppliers, setSuppliers] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fromDate, setFromDate] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10));
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    loadSuppliers();
  }, []);

  const loadSuppliers = async () => {
    try {
      const d = await supplierAPI.list();
      const list = Array.isArray(d) ? d : (d?.items || d?.suppliers || []);
      setSuppliers(list);
    } catch (e) { console.error(e); }
  };

  const loadLedger = async () => {
    if (!selectedSupplier) return;
    setLoading(true);
    try {
      const d = await reportsAPI.vendorLedger({
        supplier_id: selectedSupplier,
        from_date: fromDate,
        to_date: toDate,
      });
      setData(d);
    } catch (e) { console.error(e); setData(null); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (selectedSupplier) loadLedger();
  }, [selectedSupplier, fromDate, toDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const fmt = (v) => (Number(v) || 0).toFixed(3);

  const statusColor = (s) => ({
    paid: '#16a34a', partial: '#d97706', unpaid: '#dc2626',
  }[s] || '#6b7280');

  return (
    <div className="admin-container">
      <div className="page-header">
        <div className="header-content">
          <div className="header-icon"><Truck size={20} /></div>
          <div><h1>Vendor Ledger</h1><p>Supplier purchase and payment history</p></div>
        </div>
      </div>

      <div className="filter-bar" style={{ marginBottom: 16 }}>
        <select value={selectedSupplier} onChange={e => setSelectedSupplier(e.target.value)}
          className="filter-input" style={{ minWidth: 250 }}>
          <option value="">-- Select Supplier --</option>
          {suppliers.map(s => (
            <option key={s.id} value={s.id}>
              {s.code ? `${s.code} — ` : ''}{s.name}
            </option>
          ))}
        </select>
        <label>From:</label>
        <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="filter-input" />
        <label>To:</label>
        <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="filter-input" />
        <button className="action-btn primary" onClick={loadLedger}>Load</button>
      </div>

      {!selectedSupplier ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#6b7280', fontSize: 14 }}>
          Select a supplier to view their ledger
        </div>
      ) : loading ? <LoadingSpinner text="Loading vendor ledger..." /> : !data ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>No data available</div>
      ) : (
        <>
          {/* Supplier header */}
          <div style={{
            padding: '12px 16px', background: '#f8fafc', borderRadius: 8,
            border: '1px solid #e2e8f0', marginBottom: 16, fontSize: 13,
          }}>
            <strong>{data.supplier?.code} — {data.supplier?.name}</strong>
            <span style={{ marginLeft: 12, color: '#6b7280' }}>
              Period: {data.period?.from} to {data.period?.to}
            </span>
          </div>

          {/* Summary cards */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            <div style={{ padding: '12px 20px', background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca', flex: 1, minWidth: 160 }}>
              <div style={{ fontSize: 11, color: '#dc2626', fontWeight: 600 }}>Total Purchases</div>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--ds-font-mono)', color: '#991b1b' }}>{fmt(data.grand_total)} OMR</div>
            </div>
            <div style={{ padding: '12px 20px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0', flex: 1, minWidth: 160 }}>
              <div style={{ fontSize: 11, color: '#15803d', fontWeight: 600 }}>Total Paid</div>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--ds-font-mono)', color: '#166534' }}>{fmt(data.grand_paid)} OMR</div>
            </div>
            <div style={{ padding: '12px 20px', background: '#fff7ed', borderRadius: 8, border: '1px solid #fed7aa', flex: 1, minWidth: 160 }}>
              <div style={{ fontSize: 11, color: '#c2410c', fontWeight: 600 }}>Outstanding</div>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--ds-font-mono)', color: '#9a3412' }}>{fmt(data.grand_balance)} OMR</div>
            </div>
          </div>

          {/* Invoices table */}
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th><th>Invoice</th><th>Date</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                  <th style={{ textAlign: 'right' }}>Paid</th>
                  <th style={{ textAlign: 'right' }}>Balance</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.data?.length === 0 ? (
                  <tr><td colSpan="7" className="no-data">No invoices found for this period</td></tr>
                ) : data.data?.map((r, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td style={{ fontFamily: 'var(--ds-font-mono)', fontSize: 12 }}>{r.invoice}</td>
                    <td>{r.date}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)' }}>{fmt(r.total)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)', color: '#16a34a' }}>{fmt(r.paid)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)', fontWeight: 600, color: r.balance > 0 ? '#dc2626' : '#16a34a' }}>
                      {fmt(r.balance)}
                    </td>
                    <td>
                      <span style={{
                        background: statusColor(r.status), color: '#fff',
                        padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                      }}>{r.status}</span>
                    </td>
                  </tr>
                ))}
                {data.data?.length > 0 && (
                  <tr style={{ fontWeight: 700, background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
                    <td colSpan="3" style={{ textAlign: 'right' }}>Totals:</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)' }}>{fmt(data.grand_total)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)', color: '#16a34a' }}>{fmt(data.grand_paid)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)', color: '#dc2626' }}>{fmt(data.grand_balance)}</td>
                    <td></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

export default VendorLedger;
