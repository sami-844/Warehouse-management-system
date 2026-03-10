import LoadingSpinner from './LoadingSpinner';
import React, { useState, useEffect } from 'react';
import { accountingAPI } from '../services/api';
import './AdminPanel.css';
import { Wallet } from 'lucide-react';

function CashTransactions() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState({ total_in: 0, total_out: 0, net: 0 });
  const [fromDate, setFromDate] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10));
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));
  const [filterType, setFilterType] = useState('');

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [fromDate, toDate, filterType]);

  const load = async () => {
    setLoading(true);
    try {
      const params = { from_date: fromDate, to_date: toDate };
      if (filterType) params.tx_type = filterType;
      const data = await accountingAPI.cashTransactions(params);
      setTransactions(data.data || []);
      setTotals({ total_in: data.total_in || 0, total_out: data.total_out || 0, net: data.net || 0 });
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fmt = (v) => (Number(v) || 0).toFixed(3);

  return (
    <div className="admin-container">
      <div className="page-header">
        <div className="header-content">
          <div className="header-icon cash"><Wallet size={20} /></div>
          <div><h1>Cash Transactions</h1><p>All cash movements in one view</p></div>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ padding: '14px 24px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0', flex: 1, minWidth: 160 }}>
          <div style={{ fontSize: 12, color: '#15803d', fontWeight: 600 }}>Total In</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#166534' }}>{fmt(totals.total_in)} OMR</div>
        </div>
        <div style={{ padding: '14px 24px', background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca', flex: 1, minWidth: 160 }}>
          <div style={{ fontSize: 12, color: '#dc2626', fontWeight: 600 }}>Total Out</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#991b1b' }}>{fmt(totals.total_out)} OMR</div>
        </div>
        <div style={{ padding: '14px 24px', background: '#f0f9ff', borderRadius: 8, border: '1px solid #bae6fd', flex: 1, minWidth: 160 }}>
          <div style={{ fontSize: 12, color: '#0369a1', fontWeight: 600 }}>Net Cash Flow</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: totals.net >= 0 ? '#166534' : '#991b1b' }}>{fmt(totals.net)} OMR</div>
        </div>
      </div>

      <div className="filter-bar">
        <label>From:</label>
        <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="filter-input" />
        <label>To:</label>
        <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="filter-input" />
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="filter-select">
          <option value="">All Types</option>
          <option value="sales_payment">Sales Payments</option>
          <option value="purchase_payment">Purchase Payments</option>
          <option value="transfer">Transfers</option>
        </select>
      </div>

      {loading ? <LoadingSpinner /> : (
        <div className="table-container"><table className="data-table">
          <thead><tr><th>#</th><th>Date</th><th>Type</th><th>Reference</th><th>Description</th><th>In (OMR)</th><th>Out (OMR)</th></tr></thead>
          <tbody>
            {transactions.length === 0 ? <tr><td colSpan="7" className="no-data">No transactions found</td></tr> :
              transactions.map((t, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>{t.date}</td>
                  <td><span className="type-badge">{t.type}</span></td>
                  <td className="code">{t.reference}</td>
                  <td style={{ fontSize: 13 }}>{t.description}</td>
                  <td className={`value ${t.amount_in > 0 ? 'positive' : ''}`}>{t.amount_in > 0 ? fmt(t.amount_in) : '-'}</td>
                  <td className={`value ${t.amount_out > 0 ? 'negative' : ''}`}>{t.amount_out > 0 ? fmt(t.amount_out) : '-'}</td>
                </tr>
              ))
            }
          </tbody>
          {transactions.length > 0 && (
            <tfoot>
              <tr style={{ fontWeight: 700, background: '#f8fafc' }}>
                <td colSpan="5" style={{ textAlign: 'right' }}>Totals:</td>
                <td className="value positive">{fmt(totals.total_in)}</td>
                <td className="value negative">{fmt(totals.total_out)}</td>
              </tr>
            </tfoot>
          )}
        </table></div>
      )}
    </div>
  );
}

export default CashTransactions;
