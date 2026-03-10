import React, { useState, useEffect } from 'react';
import { notificationAPI } from '../services/api';

function NotificationSettings() {
  const [settings, setSettings] = useState({});
  const [log, setLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('settings');

  useEffect(() => {
    Promise.all([
      notificationAPI.getSettings(),
      notificationAPI.getLog(),
    ]).then(([settingsRes, logRes]) => {
      setSettings(settingsRes);
      setLog(logRes.log || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const saveSettings = () => {
    setSaving(true); setError(''); setSuccess('');
    notificationAPI.updateSettings(settings)
      .then(() => { setSuccess('Settings saved!'); setSaving(false); })
      .catch(e => { setError(e.response?.data?.detail || 'Failed to save'); setSaving(false); });
  };

  const sendTest = () => {
    if (!testEmail) { setError('Enter test email'); return; }
    setError(''); setSuccess('');
    notificationAPI.testSMTP(testEmail)
      .then(res => setSuccess(res.message))
      .catch(e => setError(e.response?.data?.detail || 'Test failed'));
  };

  const triggerAlert = (type) => {
    setError(''); setSuccess('');
    const fn = type === 'low-stock' ? notificationAPI.triggerLowStock
      : type === 'overdue' ? notificationAPI.triggerOverdue
      : notificationAPI.triggerExpiring;
    fn().then(res => { setSuccess(res.message); refreshLog(); })
      .catch(e => setError(e.response?.data?.detail || 'Trigger failed'));
  };

  const refreshLog = () => {
    notificationAPI.getLog().then(res => setLog(res.log || [])).catch(() => {});
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Loading notification settings...</div>;

  return (
    <div style={{ padding: '20px 24px', maxWidth: 800, margin: '0 auto' }}>
      <h2 style={{ color: '#0d7a3e', marginBottom: 4 }}>Email Notifications</h2>
      <p style={{ color: '#666', fontSize: 13, marginBottom: 16 }}>Configure SMTP, manage alerts for low stock, overdue payments, and expiring inventory</p>

      {error && <div style={errS}>{error}</div>}
      {success && <div style={okS}>{success}</div>}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 20, borderBottom: '2px solid #e5e5e5' }}>
        {[{ id: 'settings', label: 'Settings' }, { id: 'trigger', label: 'Send Alerts' }, { id: 'log', label: 'Log' }].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            padding: '9px 18px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            background: activeTab === t.id ? '#0d7a3e' : 'transparent',
            color: activeTab === t.id ? '#fff' : '#555', borderRadius: '8px 8px 0 0',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── SMTP Settings Tab ── */}
      {activeTab === 'settings' && (
        <div>
          <h3 style={secTitle}>SMTP Configuration</h3>
          <p style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>For Gmail: use smtp.gmail.com, port 587, and an App Password (not your regular password).</p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            <Field label="SMTP Host" value={settings.smtp_host} onChange={v => updateSetting('smtp_host', v)} placeholder="smtp.gmail.com" />
            <Field label="SMTP Port" value={settings.smtp_port} onChange={v => updateSetting('smtp_port', v)} placeholder="587" />
            <Field label="Username / Email" value={settings.smtp_username} onChange={v => updateSetting('smtp_username', v)} placeholder="your@email.com" />
            <Field label="Password" value={settings.smtp_password} onChange={v => updateSetting('smtp_password', v)} placeholder="••••••••" type="password" />
            <Field label="From Name" value={settings.smtp_from_name} onChange={v => updateSetting('smtp_from_name', v)} />
            <Field label="From Email" value={settings.smtp_from_email} onChange={v => updateSetting('smtp_from_email', v)} />
          </div>

          <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
            <input value={testEmail} onChange={e => setTestEmail(e.target.value)} placeholder="Test email address"
              style={{ flex: 1, padding: '8px 12px', borderRadius: 6, border: '1px solid #ccc', fontSize: 13 }} />
            <button onClick={sendTest} style={btn}>Send Test</button>
          </div>

          <h3 style={secTitle}>Alert Toggles & Recipients</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
            <AlertToggle label="Low Stock Alerts" enabled={settings.notify_low_stock === 'true'}
              onToggle={v => updateSetting('notify_low_stock', v ? 'true' : 'false')}
              recipients={settings.low_stock_recipients || ''}
              onRecipients={v => updateSetting('low_stock_recipients', v)}
              desc="Sends when products fall below threshold" />

            <AlertToggle label="Overdue Payment Alerts" enabled={settings.notify_overdue_payments === 'true'}
              onToggle={v => updateSetting('notify_overdue_payments', v ? 'true' : 'false')}
              recipients={settings.payment_recipients || ''}
              onRecipients={v => updateSetting('payment_recipients', v)}
              desc="Sends when invoices pass due date" />

            <AlertToggle label="Expiring Stock Alerts" enabled={settings.notify_expiring_stock === 'true'}
              onToggle={v => updateSetting('notify_expiring_stock', v ? 'true' : 'false')}
              recipients={settings.expiry_recipients || ''}
              onRecipients={v => updateSetting('expiry_recipients', v)}
              desc="Sends when FIFO batches near expiry" />
          </div>

          <button onClick={saveSettings} disabled={saving} style={{ ...btn, background: '#0d7a3e', padding: '10px 24px' }}>
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      )}

      {/* ── Trigger Alerts Tab ── */}
      {activeTab === 'trigger' && (
        <div>
          <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>Manually send alert emails now. In production, these can be scheduled via a cron job or background task.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <TriggerCard icon="" title="Low Stock Alert" desc="Sends list of products below threshold" onClick={() => triggerAlert('low-stock')} />
            <TriggerCard icon="" title="Overdue Payment Alert" desc="Sends list of overdue customer invoices" onClick={() => triggerAlert('overdue')} />
            <TriggerCard icon="" title="Expiring Stock Alert" desc="Sends list of batches expiring within 30 days" onClick={() => triggerAlert('expiring')} />
          </div>
        </div>
      )}

      {/* ── Log Tab ── */}
      {activeTab === 'log' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: '#666' }}>Recent notifications</span>
            <button onClick={refreshLog} style={{ ...btn, padding: '4px 12px', fontSize: 12 }}>Refresh</button>
          </div>
          {log.length === 0 ? (
            <div style={{ padding: 30, textAlign: 'center', color: '#888' }}>No notifications sent yet</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                    <th style={thS}>Date</th><th style={thS}>Type</th><th style={thS}>Subject</th>
                    <th style={thS}>Recipients</th><th style={thS}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {log.map((l, i) => (
                    <tr key={l.id || i} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={tdS}>{l.created_at?.slice(0, 16)}</td>
                      <td style={tdS}>{l.notification_type}</td>
                      <td style={tdS}>{l.subject?.slice(0, 50)}</td>
                      <td style={{ ...tdS, fontSize: 11 }}>{l.recipient_email?.slice(0, 40)}</td>
                      <td style={tdS}>
                        <span style={{ color: l.status === 'sent' ? '#27ae60' : '#c0392b', fontWeight: 600 }}>
                          {l.status}
                        </span>
                        {l.error_message && <div style={{ fontSize: 10, color: '#c0392b', marginTop: 2 }}>{l.error_message.slice(0, 80)}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder = '', type = 'text' }) {
  return (
    <div>
      <label style={{ display: 'block', marginBottom: 3, fontWeight: 600, fontSize: 11, color: '#444' }}>{label}</label>
      <input type={type} value={value || ''} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ccc', fontSize: 13, boxSizing: 'border-box' }} />
    </div>
  );
}

function AlertToggle({ label, enabled, onToggle, recipients, onRecipients, desc }) {
  return (
    <div style={{ background: '#f8f8f8', borderRadius: 8, padding: 14, borderLeft: `3px solid ${enabled ? '#27ae60' : '#ccc'}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
          <input type="checkbox" checked={enabled} onChange={e => onToggle(e.target.checked)} style={{ width: 16, height: 16 }} />
          {label}
        </label>
        <span style={{ fontSize: 11, color: '#888' }}>{desc}</span>
      </div>
      {enabled && (
        <input value={recipients} onChange={e => onRecipients(e.target.value)}
          placeholder="Recipient emails (comma-separated)"
          style={{ width: '100%', padding: '6px 10px', borderRadius: 4, border: '1px solid #ddd', fontSize: 12, boxSizing: 'border-box' }} />
      )}
    </div>
  );
}

function TriggerCard({ icon, title, desc, onClick }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: '#fff', borderRadius: 10, padding: 16, border: '1px solid #e5e5e5' }}>
      <span style={{ fontSize: 28 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{title}</div>
        <div style={{ fontSize: 12, color: '#888' }}>{desc}</div>
      </div>
      <button onClick={onClick} style={{ background: '#0d7a3e', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
        Send Now
      </button>
    </div>
  );
}

const btn = { background: '#3498db', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const secTitle = { fontSize: 15, color: '#333', marginBottom: 8, marginTop: 8 };
const thS = { padding: '8px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#555' };
const tdS = { padding: '8px', fontSize: 12 };
const errS = { background: '#fce4e4', color: '#c0392b', padding: '10px 16px', borderRadius: 8, marginBottom: 12, fontSize: 13 };
const okS = { background: '#e8f8e8', color: '#0d7a3e', padding: '10px 16px', borderRadius: 8, marginBottom: 12, fontSize: 13 };

export default NotificationSettings;
