import React, { useState, useEffect } from 'react';
import { fawtaraAPI } from '../services/api';
import LoadingSpinner from './LoadingSpinner';
import './AdminPanel.css';
import { Shield } from 'lucide-react';

const STATUS_COLORS = {
  pending: { bg: '#f1f5f9', border: '#cbd5e1', text: '#475569' },
  ready: { bg: '#fef9c3', border: '#fde047', text: '#854d0e' },
  submitted: { bg: '#dcfce7', border: '#86efac', text: '#166534' },
  failed: { bg: '#fee2e2', border: '#fca5a5', text: '#991b1b' },
};

function FawtaraDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [message, setMessage] = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const d = await fawtaraAPI.dashboard();
      setData(d);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fmt = (v) => (Number(v) || 0).toFixed(3);

  const handlePrepare = async (invoiceId) => {
    setActionLoading(invoiceId);
    try {
      const res = await fawtaraAPI.prepare(invoiceId);
      setMessage(res.message || 'Invoice prepared');
      load();
    } catch (e) {
      setMessage(e.response?.data?.detail || 'Failed to prepare');
    }
    setActionLoading(null);
  };

  const handleSubmit = async (invoiceId) => {
    setActionLoading(invoiceId);
    try {
      const res = await fawtaraAPI.submit(invoiceId);
      setMessage(res.message || 'Invoice submitted');
      load();
    } catch (e) {
      setMessage(e.response?.data?.detail || 'Failed to submit');
    }
    setActionLoading(null);
  };

  const handleDownloadXml = async (invoiceId, invoiceNumber) => {
    try {
      const blob = await fawtaraAPI.downloadXml(invoiceId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fawtara_${invoiceNumber || invoiceId}.xml`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      setMessage(e.response?.data?.detail || 'Failed to download XML');
    }
  };

  const handlePrepareAll = async () => {
    if (!window.confirm('Prepare all pending invoices for Fawtara?')) return;
    setActionLoading('all');
    try {
      const res = await fawtaraAPI.prepareAll();
      setMessage(res.message || `Prepared ${res.prepared} invoices`);
      load();
    } catch (e) {
      setMessage(e.response?.data?.detail || 'Failed to prepare all');
    }
    setActionLoading(null);
  };

  const statusBadge = (status) => {
    const c = STATUS_COLORS[status] || STATUS_COLORS.pending;
    return (
      <span style={{
        padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
        background: c.bg, border: `1px solid ${c.border}`, color: c.text,
      }}>
        {status}
      </span>
    );
  };

  return (
    <div className="admin-container">
      <div className="page-header">
        <div className="header-content">
          <div className="header-icon finance"><Shield size={20} /></div>
          <div><h1>Fawtara E-Invoicing</h1><p>Oman Tax Authority compliance dashboard</p></div>
        </div>
      </div>

      {message && (
        <div style={{
          padding: '10px 14px', borderRadius: 6, marginBottom: 16, fontSize: 13,
          background: '#f0fdf4', border: '1px solid #86efac', color: '#166534',
        }}>
          {message}
          <button onClick={() => setMessage('')} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: '#166534' }}>x</button>
        </div>
      )}

      {loading ? <LoadingSpinner text="Loading Fawtara dashboard..." /> : !data ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>No data available</div>
      ) : (
        <>
          {/* KPI Cards */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            <KPICard label="Total Invoices" value={data.total_invoices} color="#0c4a6e" bg="#eff6ff" border="#bfdbfe" />
            <KPICard label="Pending" value={data.status_counts.pending || 0} color="#475569" bg="#f1f5f9" border="#cbd5e1" />
            <KPICard label="Ready" value={data.status_counts.ready || 0} color="#854d0e" bg="#fef9c3" border="#fde047" />
            <KPICard label="Submitted" value={data.status_counts.submitted || 0} color="#166534" bg="#dcfce7" border="#86efac" />
            <KPICard label="Compliance Rate" value={`${data.compliance_rate}%`} color="#7c3aed" bg="#faf5ff" border="#e9d5ff" />
          </div>

          {/* Hash Chain Status */}
          <div style={{
            padding: '12px 16px', borderRadius: 8, marginBottom: 16, fontSize: 13, fontWeight: 600,
            background: data.hash_chain_valid ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${data.hash_chain_valid ? '#bbf7d0' : '#fecaca'}`,
            color: data.hash_chain_valid ? '#166534' : '#991b1b',
          }}>
            {data.hash_chain_valid
              ? 'Hash Chain Valid — All invoice hashes are correctly linked'
              : `Hash Chain BROKEN — ${data.hash_chain_errors.length} error(s) detected`}
            {data.hash_chain_errors.length > 0 && (
              <ul style={{ margin: '8px 0 0', paddingLeft: 20, fontWeight: 400, fontSize: 12 }}>
                {data.hash_chain_errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            )}
          </div>

          {/* Actions */}
          <div className="filter-bar" style={{ marginBottom: 16 }}>
            <button className="action-btn primary" onClick={handlePrepareAll} disabled={actionLoading === 'all'}>
              {actionLoading === 'all' ? 'Preparing...' : 'Prepare All Pending'}
            </button>
            <button className="action-btn" onClick={load}>Refresh</button>
          </div>

          {/* Invoice Table */}
          <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', overflow: 'hidden', marginBottom: 20 }}>
            <div style={{ padding: '10px 16px', background: '#f8fafc', borderBottom: '2px solid #e5e7eb', fontWeight: 700, fontSize: 14, color: '#374151' }}>
              Recent Invoices
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={thStyle}>Invoice #</th>
                    <th style={thStyle}>Date</th>
                    <th style={thStyle}>Customer</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Amount (OMR)</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Hash</th>
                    <th style={thStyle}>UUID</th>
                    <th style={thStyle}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.recent_invoices || []).map(inv => (
                    <tr key={inv.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{inv.invoice_number}</td>
                      <td style={{ ...tdStyle, fontSize: 11, color: '#6b7280' }}>{inv.invoice_date || '--'}</td>
                      <td style={tdStyle}>{inv.customer_name}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'var(--ds-font-mono)' }}>{fmt(inv.total_amount)}</td>
                      <td style={tdStyle}>{statusBadge(inv.fawtara_status)}</td>
                      <td style={{ ...tdStyle, fontFamily: 'var(--ds-font-mono)', fontSize: 10, color: '#6b7280' }}>
                        {inv.invoice_hash || '--'}
                      </td>
                      <td style={{ ...tdStyle, fontFamily: 'var(--ds-font-mono)', fontSize: 10, color: '#6b7280', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {inv.fawtara_uuid || '--'}
                      </td>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {inv.fawtara_status === 'pending' && (
                            <button onClick={() => handlePrepare(inv.id)} disabled={actionLoading === inv.id}
                              style={btnStyle('#2563eb')}>
                              {actionLoading === inv.id ? '...' : 'Prepare'}
                            </button>
                          )}
                          {inv.fawtara_status === 'ready' && (
                            <button onClick={() => handleSubmit(inv.id)} disabled={actionLoading === inv.id}
                              style={btnStyle('#16a34a')}>
                              {actionLoading === inv.id ? '...' : 'Submit'}
                            </button>
                          )}
                          {(inv.fawtara_status === 'ready' || inv.fawtara_status === 'submitted') && (
                            <button onClick={() => handleDownloadXml(inv.id, inv.invoice_number)}
                              style={btnStyle('#7c3aed')}>
                              XML
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Readiness Panel */}
          <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <div style={{ padding: '10px 16px', background: '#f8fafc', borderBottom: '2px solid #e5e7eb', fontWeight: 700, fontSize: 14, color: '#374151' }}>
              Fawtara Readiness
            </div>
            <div style={{ padding: '12px 16px', fontSize: 13 }}>
              {[
                { ready: true, text: 'UBL 2.1 XML generation' },
                { ready: true, text: 'TLV QR code on invoices' },
                { ready: true, text: 'Invoice hash chain (SHA-256)' },
                { ready: true, text: '10-year XML archiving' },
                { ready: false, text: 'XAdES digital signatures — Waiting for OTA certificates' },
                { ready: false, text: 'ASP API integration — Waiting for OTA to publish specs' },
              ].map((item, i) => (
                <div key={i} style={{ padding: '6px 0', color: item.ready ? '#166534' : '#92400e' }}>
                  {item.ready ? 'Ready: ' : 'Pending: '}<span style={{ fontWeight: 500 }}>{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function KPICard({ label, value, color, bg, border }) {
  return (
    <div style={{
      flex: 1, minWidth: 130, background: bg, border: `1px solid ${border}`,
      borderRadius: 8, padding: '14px 18px',
    }}>
      <div style={{ fontSize: 11, color, fontWeight: 600, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color, marginTop: 4 }}>{value}</div>
    </div>
  );
}

const thStyle = { padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#374151', borderBottom: '2px solid #e5e7eb' };
const tdStyle = { padding: '7px 10px' };
const btnStyle = (color) => ({
  padding: '3px 8px', fontSize: 10, fontWeight: 600, background: color, color: '#fff',
  border: 'none', borderRadius: 4, cursor: 'pointer', whiteSpace: 'nowrap',
});

export default FawtaraDashboard;
