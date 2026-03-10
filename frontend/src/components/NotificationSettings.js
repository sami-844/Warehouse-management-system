import React, { useState, useEffect } from 'react';
import LoadingSpinner from './LoadingSpinner'; // eslint-disable-line no-unused-vars
import { notificationAPI } from '../services/api';
import './AdminPanel.css';
import { Bell } from 'lucide-react';

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

  if (loading) return <div className="admin-container"><LoadingSpinner text="Loading notifications..." /></div>;

  return (
    <div className="admin-container">
      <div className="page-header">
        <div className="header-content">
          <div className="header-icon notifications"><Bell size={20} /></div>
          <div><h1>Email Notifications</h1><p>Configure SMTP, manage alerts for low stock, overdue payments, and expiring inventory</p></div>
        </div>
      </div>

      {error && <div className="message error">{error}</div>}
      {success && <div className="message success">{success}</div>}

      {/* Tabs */}
      <div className="tab-bar">
        {[{ id: 'settings', label: 'Settings' }, { id: 'trigger', label: 'Send Alerts' }, { id: 'log', label: 'Log' }].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} className={`tab-btn ${activeTab === t.id ? 'active' : ''}`}>{t.label}</button>
        ))}
      </div>

      {/* ── SMTP Settings Tab ── */}
      {activeTab === 'settings' && (
        <div className="tab-content">
          <h3>SMTP Configuration</h3>
          <p style={{ fontSize: 'var(--ds-text-xs)', color: 'var(--ds-text-muted)', marginBottom: 'var(--ds-sp-4)' }}>
            For Gmail: use smtp.gmail.com, port 587, and an App Password (not your regular password).
          </p>

          <div className="form-row-2">
            <Field label="SMTP Host" value={settings.smtp_host} onChange={v => updateSetting('smtp_host', v)} placeholder="smtp.gmail.com" />
            <Field label="SMTP Port" value={settings.smtp_port} onChange={v => updateSetting('smtp_port', v)} placeholder="587" />
          </div>
          <div className="form-row-2">
            <Field label="Username / Email" value={settings.smtp_username} onChange={v => updateSetting('smtp_username', v)} placeholder="your@email.com" />
            <Field label="Password" value={settings.smtp_password} onChange={v => updateSetting('smtp_password', v)} placeholder="••••••••" type="password" />
          </div>
          <div className="form-row-2">
            <Field label="From Name" value={settings.smtp_from_name} onChange={v => updateSetting('smtp_from_name', v)} />
            <Field label="From Email" value={settings.smtp_from_email} onChange={v => updateSetting('smtp_from_email', v)} />
          </div>

          <div className="filter-bar" style={{ marginBottom: 'var(--ds-sp-5)' }}>
            <input value={testEmail} onChange={e => setTestEmail(e.target.value)} placeholder="Test email address"
              className="search-input" style={{ flex: 1 }} />
            <button onClick={sendTest} className="action-btn">Send Test</button>
          </div>

          <h4>Alert Toggles & Recipients</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-sp-3)', marginBottom: 'var(--ds-sp-5)' }}>
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

          <button onClick={saveSettings} disabled={saving} className="submit-btn" style={{ maxWidth: 200 }}>
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      )}

      {/* ── Trigger Alerts Tab ── */}
      {activeTab === 'trigger' && (
        <div className="tab-content">
          <p style={{ fontSize: 'var(--ds-text-sm)', color: 'var(--ds-text-muted)', marginBottom: 'var(--ds-sp-4)' }}>
            Manually send alert emails now. In production, these can be scheduled via a cron job or background task.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-sp-3)' }}>
            <TriggerCard title="Low Stock Alert" desc="Sends list of products below threshold" onClick={() => triggerAlert('low-stock')} />
            <TriggerCard title="Overdue Payment Alert" desc="Sends list of overdue customer invoices" onClick={() => triggerAlert('overdue')} />
            <TriggerCard title="Expiring Stock Alert" desc="Sends list of batches expiring within 30 days" onClick={() => triggerAlert('expiring')} />
          </div>
        </div>
      )}

      {/* ── Log Tab ── */}
      {activeTab === 'log' && (
        <div className="tab-content">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--ds-sp-3)' }}>
            <span style={{ fontSize: 'var(--ds-text-sm)', color: 'var(--ds-text-muted)' }}>Recent notifications</span>
            <button onClick={refreshLog} className="action-btn">Refresh</button>
          </div>
          {log.length === 0 ? (
            <div className="no-data">No notifications sent yet</div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th><th>Type</th><th>Subject</th>
                    <th>Recipients</th><th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {log.map((l, i) => (
                    <tr key={l.id || i}>
                      <td>{l.created_at?.slice(0, 16)}</td>
                      <td>{l.notification_type}</td>
                      <td>{l.subject?.slice(0, 50)}</td>
                      <td style={{ fontSize: 'var(--ds-text-xs)' }}>{l.recipient_email?.slice(0, 40)}</td>
                      <td>
                        <span className={l.status === 'sent' ? 'positive' : 'negative'}>{l.status}</span>
                        {l.error_message && <div style={{ fontSize: 'var(--ds-text-xs)', color: 'var(--ds-danger)', marginTop: 2 }}>{l.error_message.slice(0, 80)}</div>}
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
    <div className="form-group">
      <label>{label}</label>
      <input type={type} value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

function AlertToggle({ label, enabled, onToggle, recipients, onRecipients, desc }) {
  return (
    <div style={{
      background: 'var(--ds-surface-raised)', borderRadius: 'var(--ds-r-md)', padding: 'var(--ds-sp-4)',
      borderLeft: `3px solid ${enabled ? 'var(--ds-green)' : 'var(--ds-border-mid)'}`,
      border: '1px solid var(--ds-border)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--ds-sp-3)', marginBottom: 'var(--ds-sp-2)' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--ds-sp-2)', cursor: 'pointer', fontWeight: 700, fontSize: 'var(--ds-text-sm)', fontFamily: 'var(--ds-font-ui)' }}>
          <input type="checkbox" checked={enabled} onChange={e => onToggle(e.target.checked)} style={{ width: 16, height: 16 }} />
          {label}
        </label>
        <span style={{ fontSize: 'var(--ds-text-xs)', color: 'var(--ds-text-muted)' }}>{desc}</span>
      </div>
      {enabled && (
        <input value={recipients} onChange={e => onRecipients(e.target.value)}
          placeholder="Recipient emails (comma-separated)"
          style={{ width: '100%', padding: '6px 10px', borderRadius: 'var(--ds-r-sm)', border: '1px solid var(--ds-border-mid)', fontSize: 'var(--ds-text-sm)', boxSizing: 'border-box', fontFamily: 'var(--ds-font-ui)' }} />
      )}
    </div>
  );
}

function TriggerCard({ title, desc, onClick }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--ds-sp-4)', background: 'var(--ds-surface)', borderRadius: 'var(--ds-r-md)', padding: 'var(--ds-sp-4)', border: '1px solid var(--ds-border)', boxShadow: 'var(--ds-shadow-card)' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 'var(--ds-text-md)', color: 'var(--ds-text)', fontFamily: 'var(--ds-font-ui)' }}>{title}</div>
        <div style={{ fontSize: 'var(--ds-text-sm)', color: 'var(--ds-text-muted)' }}>{desc}</div>
      </div>
      <button onClick={onClick} className="action-btn primary">Send Now</button>
    </div>
  );
}

export default NotificationSettings;
