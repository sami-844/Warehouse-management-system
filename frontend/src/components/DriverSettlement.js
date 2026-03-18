import React, { useState, useEffect, useCallback } from 'react';
import { vanSalesAPI } from '../services/api';
import { Wallet, AlertTriangle, CheckCircle, DollarSign } from 'lucide-react';

export default function DriverSettlement() {
  const [drivers, setDrivers] = useState([]);
  const [overdueData, setOverdueData] = useState(null);
  const [settlements, setSettlements] = useState([]);
  const [selectedDriver, setSelectedDriver] = useState('');
  const [driverDue, setDriverDue] = useState(0);
  const [form, setForm] = useState({
    amount: '', payment_method: 'cash', bank_reference: '', notes: '', settlement_date: new Date().toISOString().split('T')[0]
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const loadOverdue = useCallback(async () => {
    try {
      const d = await vanSalesAPI.overdue(50);
      setOverdueData(d);
    } catch { setOverdueData(null); }
  }, []);

  const loadSettlements = useCallback(async () => {
    try {
      const params = {};
      if (selectedDriver) params.driver_id = selectedDriver;
      const d = await vanSalesAPI.settlements(params);
      setSettlements(Array.isArray(d) ? d : []);
    } catch { setSettlements([]); }
  }, [selectedDriver]);

  const loadDriverDue = useCallback(async () => {
    if (!selectedDriver) { setDriverDue(0); return; }
    try {
      const summaries = await vanSalesAPI.driverSummary({ driver_id: selectedDriver });
      const s = Array.isArray(summaries) ? summaries[0] : null;
      setDriverDue(s ? s.running_due : 0);
    } catch { setDriverDue(0); }
  }, [selectedDriver]);

  useEffect(() => {
    (async () => {
      try {
        const d = await vanSalesAPI.drivers();
        setDrivers(Array.isArray(d) ? d : []);
      } catch { setDrivers([]); }
    })();
    loadOverdue();
  }, [loadOverdue]);

  useEffect(() => { loadSettlements(); loadDriverDue(); }, [loadSettlements, loadDriverDue]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedDriver || !form.amount) return;
    setSaving(true);
    setMessage('');
    try {
      const res = await vanSalesAPI.recordSettlement({
        driver_id: parseInt(selectedDriver),
        amount: parseFloat(form.amount),
        payment_method: form.payment_method,
        bank_reference: form.bank_reference || null,
        notes: form.notes,
        settlement_date: form.settlement_date,
      });
      setMessage(res.message || 'Settlement recorded');
      setForm({ amount: '', payment_method: 'cash', bank_reference: '', notes: '', settlement_date: new Date().toISOString().split('T')[0] });
      loadSettlements();
      loadDriverDue();
      loadOverdue();
    } catch (err) {
      setMessage(err.response?.data?.detail || 'Error recording settlement');
    } finally { setSaving(false); }
  };

  const fillFullBalance = () => {
    setForm(f => ({ ...f, amount: driverDue.toFixed(3) }));
  };

  const cardStyle = { background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', padding: 20, marginBottom: 20 };
  const inputStyle = { width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 14 };
  const btnStyle = { padding: '10px 24px', background: '#1A7B5B', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14, fontWeight: 600 };

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Wallet size={28} color="#1A7B5B" />
        <h1 style={{ margin: 0, fontSize: 24, color: '#1a2332' }}>Driver Settlement</h1>
      </div>

      {/* Overdue Alert Panel */}
      {overdueData && overdueData.overdue_count > 0 ? (
        <div style={{ ...cardStyle, borderLeft: '4px solid #dc2626', background: '#fef2f2' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <AlertTriangle size={20} color="#dc2626" />
            <strong style={{ color: '#dc2626' }}>{overdueData.overdue_count} Driver(s) Overdue (threshold: OMR {overdueData.threshold.toFixed(3)})</strong>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #fecaca' }}>
                <th style={{ textAlign: 'left', padding: 6 }}>Driver</th>
                <th style={{ textAlign: 'right', padding: 6 }}>Running Due</th>
                <th style={{ textAlign: 'center', padding: 6 }}>Last Sheet</th>
                <th style={{ textAlign: 'center', padding: 6 }}>Days Since Settlement</th>
              </tr>
            </thead>
            <tbody>
              {overdueData.drivers.map(d => (
                <tr key={d.driver_id} style={{ borderBottom: '1px solid #fecaca' }}>
                  <td style={{ padding: 6 }}>{d.driver_name}</td>
                  <td style={{ padding: 6, textAlign: 'right', color: '#dc2626', fontWeight: 600 }}>OMR {d.running_due.toFixed(3)}</td>
                  <td style={{ padding: 6, textAlign: 'center' }}>{d.last_sheet_date || '—'}</td>
                  <td style={{ padding: 6, textAlign: 'center' }}>{d.days_since_last_settlement != null ? `${d.days_since_last_settlement}d` : 'Never'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : overdueData ? (
        <div style={{ ...cardStyle, borderLeft: '4px solid #16a34a', background: '#f0fdf4' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle size={20} color="#16a34a" />
            <strong style={{ color: '#16a34a' }}>All drivers clear — no overdue balances above OMR 50.000</strong>
          </div>
        </div>
      ) : null}

      {/* Settlement Form */}
      <div style={cardStyle}>
        <h2 style={{ margin: '0 0 16px', fontSize: 18, color: '#1a2332' }}>Record Settlement</h2>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Driver</label>
              <select style={inputStyle} value={selectedDriver} onChange={e => setSelectedDriver(e.target.value)} required>
                <option value="">Select driver...</option>
                {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Settlement Date</label>
              <input type="date" style={inputStyle} value={form.settlement_date} onChange={e => setForm(f => ({ ...f, settlement_date: e.target.value }))} required />
            </div>
          </div>

          {/* Current Due Display */}
          {selectedDriver && (
            <div style={{ background: driverDue > 0 ? '#fef3c7' : '#f0fdf4', border: `1px solid ${driverDue > 0 ? '#f59e0b' : '#16a34a'}`, borderRadius: 8, padding: 16, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 13, color: '#64748b' }}>Current Running Due</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: driverDue > 0 ? '#d97706' : '#16a34a' }}>OMR {driverDue.toFixed(3)}</div>
              </div>
              {driverDue > 0 && (
                <button type="button" onClick={fillFullBalance} style={{ ...btnStyle, background: '#d97706' }}>
                  Settle Full Balance
                </button>
              )}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Amount (OMR)</label>
              <input type="number" step="0.001" min="0.001" style={inputStyle} value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required placeholder="0.000" />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Payment Method</label>
              <div style={{ display: 'flex', gap: 16, paddingTop: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input type="radio" name="method" value="cash" checked={form.payment_method === 'cash'} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))} />
                  Cash
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input type="radio" name="method" value="bank" checked={form.payment_method === 'bank'} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))} />
                  Bank Transfer
                </label>
              </div>
            </div>
          </div>

          {form.payment_method === 'bank' && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Bank Reference</label>
              <input type="text" style={inputStyle} value={form.bank_reference} onChange={e => setForm(f => ({ ...f, bank_reference: e.target.value }))} placeholder="Transfer reference number" />
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Notes</label>
            <input type="text" style={inputStyle} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes" />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button type="submit" disabled={saving || !selectedDriver} style={{ ...btnStyle, opacity: saving || !selectedDriver ? 0.5 : 1 }}>
              <DollarSign size={16} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              {saving ? 'Recording...' : 'Record Settlement'}
            </button>
            {message && <span style={{ fontSize: 14, color: message.includes('Error') || message.includes('exceeds') ? '#dc2626' : '#16a34a', fontWeight: 600 }}>{message}</span>}
          </div>
        </form>
      </div>

      {/* Settlement History */}
      <div style={cardStyle}>
        <h2 style={{ margin: '0 0 16px', fontSize: 18, color: '#1a2332' }}>Settlement History</h2>
        {settlements.length === 0 ? (
          <p style={{ color: '#94a3b8', textAlign: 'center', padding: 24 }}>No settlements recorded{selectedDriver ? ' for this driver' : ''}</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ padding: 8, textAlign: 'left' }}>Date</th>
                  <th style={{ padding: 8, textAlign: 'left' }}>Driver</th>
                  <th style={{ padding: 8, textAlign: 'right' }}>Amount</th>
                  <th style={{ padding: 8, textAlign: 'center' }}>Method</th>
                  <th style={{ padding: 8, textAlign: 'right' }}>Due Before</th>
                  <th style={{ padding: 8, textAlign: 'right' }}>Due After</th>
                  <th style={{ padding: 8, textAlign: 'left' }}>Reference</th>
                  <th style={{ padding: 8, textAlign: 'left' }}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {settlements.map(s => (
                  <tr key={s.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: 8 }}>{s.settlement_date}</td>
                    <td style={{ padding: 8 }}>{s.driver_name}</td>
                    <td style={{ padding: 8, textAlign: 'right', fontWeight: 600, color: '#16a34a' }}>OMR {s.amount.toFixed(3)}</td>
                    <td style={{ padding: 8, textAlign: 'center' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, background: s.payment_method === 'cash' ? '#dbeafe' : '#e0e7ff', color: s.payment_method === 'cash' ? '#1d4ed8' : '#4338ca' }}>
                        {s.payment_method}
                      </span>
                    </td>
                    <td style={{ padding: 8, textAlign: 'right', color: '#dc2626' }}>{s.running_due_before.toFixed(3)}</td>
                    <td style={{ padding: 8, textAlign: 'right', color: s.running_due_after <= 0 ? '#16a34a' : '#d97706' }}>{s.running_due_after.toFixed(3)}</td>
                    <td style={{ padding: 8, color: '#64748b' }}>{s.bank_reference || '—'}</td>
                    <td style={{ padding: 8, color: '#64748b' }}>{s.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
