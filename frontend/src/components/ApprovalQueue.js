import React, { useState, useEffect, useCallback } from 'react';
import { purchaseAPI } from '../services/api';
import { CheckCircle, XCircle, Clock, Shield } from 'lucide-react';

export default function ApprovalQueue() {
  const [pending, setPending] = useState([]);
  const [rules, setRules] = useState([]);
  const [actionNotes, setActionNotes] = useState({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [p, r] = await Promise.all([
        purchaseAPI.pendingApprovals(),
        purchaseAPI.approvalRules(),
      ]);
      setPending(Array.isArray(p) ? p : []);
      setRules(Array.isArray(r) ? r : []);
    } catch { setPending([]); setRules([]); }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleApprove = async (poId, poNumber) => {
    try {
      await purchaseAPI.approvePO(poId, actionNotes[poId] || '');
      setMessage(`${poNumber} approved`);
      setActionNotes(n => ({ ...n, [poId]: '' }));
      loadData();
    } catch (err) { setMessage(err.response?.data?.detail || 'Error approving'); }
  };

  const handleReject = async (poId, poNumber) => {
    if (!actionNotes[poId]) { setMessage('Please add a reason for rejection'); return; }
    try {
      await purchaseAPI.rejectPO(poId, actionNotes[poId]);
      setMessage(`${poNumber} rejected`);
      setActionNotes(n => ({ ...n, [poId]: '' }));
      loadData();
    } catch (err) { setMessage(err.response?.data?.detail || 'Error rejecting'); }
  };

  const cardStyle = { background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', padding: 20, marginBottom: 20 };
  const btnApprove = { padding: '6px 16px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 };
  const btnReject = { padding: '6px 16px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 };

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <CheckCircle size={28} color="#1A7B5B" />
        <h1 style={{ margin: 0, fontSize: 24, color: '#1a2332' }}>Approval Queue</h1>
        {pending.length > 0 && (
          <span style={{ background: '#fef3c7', color: '#d97706', padding: '4px 12px', borderRadius: 12, fontSize: 13, fontWeight: 700 }}>
            {pending.length} pending
          </span>
        )}
      </div>

      {message && (
        <div style={{ padding: '10px 16px', marginBottom: 16, borderRadius: 6, background: message.includes('Error') || message.includes('reason') ? '#fef2f2' : '#f0fdf4', color: message.includes('Error') || message.includes('reason') ? '#dc2626' : '#16a34a', fontSize: 13, fontWeight: 600 }}>
          {message}
        </div>
      )}

      {/* Pending Approvals */}
      <div style={cardStyle}>
        <h2 style={{ margin: '0 0 16px', fontSize: 18, color: '#1a2332' }}>
          <Clock size={18} style={{ verticalAlign: 'middle', marginRight: 8 }} />
          Pending Approvals
        </h2>
        {loading ? (
          <p style={{ color: '#94a3b8', textAlign: 'center', padding: 24 }}>Loading...</p>
        ) : pending.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, color: '#16a34a' }}>
            <CheckCircle size={32} style={{ marginBottom: 8 }} />
            <div style={{ fontWeight: 600 }}>No pending approvals</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ padding: 8, textAlign: 'left' }}>PO Number</th>
                  <th style={{ padding: 8, textAlign: 'left' }}>Supplier</th>
                  <th style={{ padding: 8, textAlign: 'right' }}>Amount (OMR)</th>
                  <th style={{ padding: 8, textAlign: 'center' }}>Date</th>
                  <th style={{ padding: 8, textAlign: 'left' }}>Created By</th>
                  <th style={{ padding: 8, textAlign: 'left' }}>Notes</th>
                  <th style={{ padding: 8, textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pending.map(po => (
                  <tr key={po.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: 8, fontWeight: 600, fontFamily: 'monospace' }}>{po.po_number}</td>
                    <td style={{ padding: 8 }}>{po.supplier_name}</td>
                    <td style={{ padding: 8, textAlign: 'right', fontWeight: 600, color: '#d97706' }}>{po.total_amount.toFixed(3)}</td>
                    <td style={{ padding: 8, textAlign: 'center' }}>{po.order_date}</td>
                    <td style={{ padding: 8 }}>{po.created_by_name}</td>
                    <td style={{ padding: 8, color: '#64748b', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{po.notes || '—'}</td>
                    <td style={{ padding: 8 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
                        <input
                          type="text" placeholder="Notes (required for reject)"
                          value={actionNotes[po.id] || ''}
                          onChange={e => setActionNotes(n => ({ ...n, [po.id]: e.target.value }))}
                          style={{ width: '100%', padding: '4px 8px', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 12 }}
                        />
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button style={btnApprove} onClick={() => handleApprove(po.id, po.po_number)}>
                            <CheckCircle size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />Approve
                          </button>
                          <button style={btnReject} onClick={() => handleReject(po.id, po.po_number)}>
                            <XCircle size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />Reject
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Approval Rules */}
      <div style={cardStyle}>
        <h2 style={{ margin: '0 0 16px', fontSize: 18, color: '#1a2332' }}>
          <Shield size={18} style={{ verticalAlign: 'middle', marginRight: 8 }} />
          Active Approval Rules
        </h2>
        {rules.length === 0 ? (
          <p style={{ color: '#94a3b8', textAlign: 'center', padding: 16 }}>No approval rules configured</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: 8, textAlign: 'left' }}>Rule</th>
                <th style={{ padding: 8, textAlign: 'left' }}>Entity</th>
                <th style={{ padding: 8, textAlign: 'left' }}>Condition</th>
                <th style={{ padding: 8, textAlign: 'left' }}>Approver</th>
                <th style={{ padding: 8, textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {rules.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: 8, fontWeight: 600 }}>{r.rule_name}</td>
                  <td style={{ padding: 8 }}>{(r.entity_type || '').replace('_', ' ')}</td>
                  <td style={{ padding: 8, fontFamily: 'monospace' }}>{r.condition_field} {r.condition_operator} {parseFloat(r.condition_value || 0).toFixed(3)}</td>
                  <td style={{ padding: 8 }}>{r.approver_role}</td>
                  <td style={{ padding: 8, textAlign: 'center' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: r.is_active ? '#dcfce7' : '#fee2e2', color: r.is_active ? '#16a34a' : '#dc2626' }}>
                      {r.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
