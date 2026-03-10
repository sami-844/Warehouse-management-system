import LoadingSpinner from './LoadingSpinner';
import React, { useState } from 'react';
import { reportsAPI } from '../services/api';
import './AdminPanel.css';
import { FileText, Printer } from 'lucide-react';

function VATReturn() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [year, setYear] = useState(new Date().getFullYear());
  const [quarter, setQuarter] = useState(Math.ceil((new Date().getMonth() + 1) / 3));
  const [message, setMessage] = useState({ text: '', type: '' });

  const getQuarterDates = (y, q) => {
    const starts = [`${y}-01-01`, `${y}-04-01`, `${y}-07-01`, `${y}-10-01`];
    const ends = [`${y}-03-31`, `${y}-06-30`, `${y}-09-30`, `${y}-12-31`];
    return { start: starts[q - 1], end: ends[q - 1] };
  };

  const load = async () => {
    setLoading(true);
    setMessage({ text: '', type: '' });
    try {
      const { start, end } = getQuarterDates(year, quarter);
      const d = await reportsAPI.vatReturn({ start_date: start, end_date: end });
      setData(d);
    } catch (e) {
      setMessage({ text: e.response?.data?.detail || 'Failed to load VAT return data', type: 'error' });
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const fmt = (v) => (v || 0).toFixed(3);

  const handlePrint = () => window.print();

  return (
    <div className="admin-container">
      <div className="page-header">
        <div className="header-content">
          <div className="header-icon finance"><FileText size={20} /></div>
          <div><h1>VAT Return</h1><p>Oman Tax Authority — Quarterly VAT filing summary</p></div>
        </div>
        {data && (
          <button onClick={handlePrint} className="action-btn primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Printer size={15} /> Print
          </button>
        )}
      </div>

      {message.text && <div className={`message ${message.type}`}>{message.text}</div>}

      {/* Quarter Selector */}
      <div className="filter-bar">
        <select value={year} onChange={e => setYear(Number(e.target.value))} className="filter-input">
          {[...Array(5)].map((_, i) => {
            const y = new Date().getFullYear() - i;
            return <option key={y} value={y}>{y}</option>;
          })}
        </select>
        <select value={quarter} onChange={e => setQuarter(Number(e.target.value))} className="filter-input">
          <option value={1}>Q1 — Jan to Mar</option>
          <option value={2}>Q2 — Apr to Jun</option>
          <option value={3}>Q3 — Jul to Sep</option>
          <option value={4}>Q4 — Oct to Dec</option>
        </select>
        <button className="action-btn primary" onClick={load}>Generate VAT Return</button>
      </div>

      {loading && <LoadingSpinner text="Calculating VAT return..." />}

      {data && !loading && (
        <div style={{ marginTop: 16 }}>
          {/* Period Header */}
          <div style={{
            background: 'var(--ds-surface)', border: '1px solid var(--ds-border)', borderRadius: 10,
            padding: '16px 20px', marginBottom: 16,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ds-text-muted)', letterSpacing: 0.5 }}>
                  Tax Period
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ds-text)', marginTop: 2 }}>
                  Q{quarter} {year} — {data.period_start} to {data.period_end}
                </div>
              </div>
              <div style={{
                background: data.box6_net_vat_payable >= 0 ? '#fef2f2' : '#f0fdf4',
                border: `1px solid ${data.box6_net_vat_payable >= 0 ? '#fca5a5' : '#86efac'}`,
                borderRadius: 8, padding: '8px 16px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ds-text-muted)' }}>
                  Net VAT {data.box6_net_vat_payable >= 0 ? 'Payable' : 'Refundable'}
                </div>
                <div style={{
                  fontSize: 22, fontWeight: 800, fontFamily: 'var(--ds-font-mono)',
                  color: data.box6_net_vat_payable >= 0 ? '#dc2626' : '#16a34a',
                }}>
                  OMR {fmt(Math.abs(data.box6_net_vat_payable))}
                </div>
              </div>
            </div>
          </div>

          {/* OTA-style VAT Return Table */}
          <div className="table-container">
            <table className="data-table" style={{ fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ width: 60, textAlign: 'center' }}>Box</th>
                  <th>Description</th>
                  <th style={{ textAlign: 'right', width: 160 }}>Amount (OMR)</th>
                </tr>
              </thead>
              <tbody>
                {/* Sales Section */}
                <tr style={{ background: '#f8fafc' }}>
                  <td colSpan="3" style={{ fontWeight: 700, fontSize: 12, textTransform: 'uppercase', color: '#16a34a', letterSpacing: 0.5 }}>
                    Output Tax (Sales)
                  </td>
                </tr>
                <tr>
                  <td style={{ textAlign: 'center', fontWeight: 700 }}>1</td>
                  <td>Standard rated sales (5% VAT)</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)', fontWeight: 600 }}>{fmt(data.box1_standard_sales)}</td>
                </tr>
                <tr>
                  <td style={{ textAlign: 'center', fontWeight: 700 }}>2</td>
                  <td>Zero-rated / exempt sales</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)', fontWeight: 600 }}>{fmt(data.box2_zero_rated_sales)}</td>
                </tr>
                <tr style={{ background: '#f0fdf4' }}>
                  <td style={{ textAlign: 'center', fontWeight: 800, color: '#16a34a' }}>3</td>
                  <td style={{ fontWeight: 700, color: '#16a34a' }}>Output VAT due on sales</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)', fontWeight: 800, color: '#16a34a' }}>
                    {fmt(data.box3_output_vat)}
                  </td>
                </tr>

                {/* Purchases Section */}
                <tr style={{ background: '#f8fafc' }}>
                  <td colSpan="3" style={{ fontWeight: 700, fontSize: 12, textTransform: 'uppercase', color: '#d97706', letterSpacing: 0.5, paddingTop: 16 }}>
                    Input Tax (Purchases)
                  </td>
                </tr>
                <tr>
                  <td style={{ textAlign: 'center', fontWeight: 700 }}>4</td>
                  <td>Standard rated purchases (VAT claimable)</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)', fontWeight: 600 }}>{fmt(data.box4_standard_purchases)}</td>
                </tr>
                <tr style={{ background: '#fffbeb' }}>
                  <td style={{ textAlign: 'center', fontWeight: 800, color: '#d97706' }}>5</td>
                  <td style={{ fontWeight: 700, color: '#d97706' }}>Input VAT reclaimable on purchases</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)', fontWeight: 800, color: '#d97706' }}>
                    {fmt(data.box5_input_vat)}
                  </td>
                </tr>

                {/* Net VAT */}
                <tr style={{ background: '#f8fafc' }}>
                  <td colSpan="3" style={{ fontWeight: 700, fontSize: 12, textTransform: 'uppercase', color: '#6b7280', letterSpacing: 0.5, paddingTop: 16 }}>
                    Net VAT
                  </td>
                </tr>
                <tr style={{
                  background: data.box6_net_vat_payable >= 0 ? '#fef2f2' : '#f0fdf4',
                  borderTop: '2px solid var(--ds-border)',
                }}>
                  <td style={{ textAlign: 'center', fontWeight: 800, fontSize: 15, color: data.box6_net_vat_payable >= 0 ? '#dc2626' : '#16a34a' }}>6</td>
                  <td style={{ fontWeight: 800, fontSize: 14, color: data.box6_net_vat_payable >= 0 ? '#dc2626' : '#16a34a' }}>
                    Net VAT {data.box6_net_vat_payable >= 0 ? 'payable to OTA' : 'refundable from OTA'}
                  </td>
                  <td style={{
                    textAlign: 'right', fontFamily: 'var(--ds-font-mono)',
                    fontWeight: 800, fontSize: 16,
                    color: data.box6_net_vat_payable >= 0 ? '#dc2626' : '#16a34a',
                  }}>
                    {fmt(Math.abs(data.box6_net_vat_payable))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Summary Cards */}
          <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
            <div style={{
              flex: 1, minWidth: 180, background: 'var(--ds-surface)', border: '1px solid var(--ds-border)',
              borderRadius: 8, padding: '12px 16px',
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ds-text-muted)' }}>Total Sales</div>
              <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--ds-font-mono)', color: '#16a34a', marginTop: 4 }}>
                OMR {fmt(data.total_sales)}
              </div>
            </div>
            <div style={{
              flex: 1, minWidth: 180, background: 'var(--ds-surface)', border: '1px solid var(--ds-border)',
              borderRadius: 8, padding: '12px 16px',
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ds-text-muted)' }}>Total Purchases</div>
              <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--ds-font-mono)', color: '#d97706', marginTop: 4 }}>
                OMR {fmt(data.total_purchases)}
              </div>
            </div>
            <div style={{
              flex: 1, minWidth: 180, background: 'var(--ds-surface)', border: '1px solid var(--ds-border)',
              borderRadius: 8, padding: '12px 16px',
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ds-text-muted)' }}>VAT Rate</div>
              <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--ds-font-mono)', color: 'var(--ds-text)', marginTop: 4 }}>5%</div>
            </div>
          </div>

          {/* Filing Note */}
          <div style={{
            marginTop: 16, padding: '12px 16px', background: '#eff6ff', border: '1px solid #93c5fd',
            borderRadius: 8, fontSize: 12, color: '#1e40af', lineHeight: 1.5,
          }}>
            This is a summary for internal reference. File your official VAT return through the Oman Tax Authority (OTA) portal at
            <strong> taxoman.tax.gov.om</strong>. Ensure all figures are verified before submission.
          </div>
        </div>
      )}
    </div>
  );
}

export default VATReturn;
