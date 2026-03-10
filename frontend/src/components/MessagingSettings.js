import React, { useState } from 'react';
import './AdminPanel.css';
import { MessageSquare } from 'lucide-react';

const DEFAULT_TEMPLATES = [
  {
    id: 1, name: 'Invoice Created', trigger: 'sales_invoice_created', is_active: true,
    body: 'Dear {customer_name}, Invoice #{invoice_number} for {amount} OMR has been created. Thank you for your business. - AK Al Momaiza'
  },
  {
    id: 2, name: 'Payment Received', trigger: 'payment_received', is_active: true,
    body: 'Dear {customer_name}, Payment of {amount} OMR received for Invoice #{invoice_number}. Balance: {balance} OMR. Thank you.'
  },
  {
    id: 3, name: 'Overdue Reminder', trigger: 'invoice_overdue', is_active: false,
    body: 'Dear {customer_name}, Invoice #{invoice_number} for {amount} OMR is overdue. Please contact us at {phone}. Thank you.'
  },
  {
    id: 4, name: 'Delivery Dispatched', trigger: 'order_shipped', is_active: true,
    body: 'Dear {customer_name}, Your order #{order_number} has been dispatched. Expected delivery: {delivery_date}.'
  },
];

function MessagingSettings() {
  const [config, setConfig] = useState({
    provider: 'none',
    api_url: '',
    api_key: '',
    sender: '',
  });
  const [templates, setTemplates] = useState(DEFAULT_TEMPLATES);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [message, setMessage] = useState({ text: '', type: '' });

  const updateConfig = (key, value) => setConfig(prev => ({ ...prev, [key]: value }));

  const saveConfig = () => {
    setMessage({ text: 'Settings saved locally. Backend API not connected yet.', type: 'success' });
  };

  const testConnection = () => {
    if (config.provider === 'none') {
      setMessage({ text: 'Select a provider first.', type: 'error' });
      return;
    }
    if (!config.api_url || !config.api_key) {
      setMessage({ text: 'API URL and API Key are required.', type: 'error' });
      return;
    }
    setMessage({ text: 'Test connection not available yet — backend API pending.', type: 'info' });
  };

  const toggleTemplate = (id) => {
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, is_active: !t.is_active } : t));
  };

  const saveTemplate = () => {
    if (!editingTemplate) return;
    setTemplates(prev => prev.map(t => t.id === editingTemplate.id ? editingTemplate : t));
    setEditingTemplate(null);
    setMessage({ text: 'Template updated.', type: 'success' });
  };

  return (
    <div className="admin-container">
      <div className="page-header">
        <div className="header-content">
          <div className="header-icon messaging"><MessageSquare size={20} /></div>
          <div><h1>Messaging Settings</h1><p>WhatsApp and SMS notification configuration</p></div>
        </div>
      </div>

      {message.text && <div className={`message ${message.type}`} style={{ marginBottom: 16 }}>{message.text}</div>}

      {/* Section 1: API Configuration */}
      <div className="form-card" style={{ marginBottom: 24 }}>
        <h3>API Configuration</h3>
        <div className="form-row-2">
          <div className="form-group">
            <label>Provider</label>
            <select value={config.provider} onChange={e => updateConfig('provider', e.target.value)}>
              <option value="none">None (Disabled)</option>
              <option value="twilio">Twilio</option>
              <option value="custom">Custom API</option>
            </select>
          </div>
          <div className="form-group">
            <label>Sender Name / Number</label>
            <input value={config.sender} onChange={e => updateConfig('sender', e.target.value)}
              placeholder="+968 1234 5678 or AK Al Momaiza" disabled={config.provider === 'none'} />
          </div>
        </div>
        <div className="form-row-2">
          <div className="form-group">
            <label>API URL</label>
            <input value={config.api_url} onChange={e => updateConfig('api_url', e.target.value)}
              placeholder="https://api.twilio.com/..." disabled={config.provider === 'none'} />
          </div>
          <div className="form-group">
            <label>API Key</label>
            <input type="password" value={config.api_key} onChange={e => updateConfig('api_key', e.target.value)}
              placeholder="Enter API key" disabled={config.provider === 'none'} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button className="action-btn primary" onClick={saveConfig}>Save Settings</button>
          <button className="action-btn" onClick={testConnection}
            style={{ background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd' }}
            disabled={config.provider === 'none'}>
            Test Connection
          </button>
        </div>
      </div>

      {/* Section 2: Message Templates */}
      <div className="form-card">
        <h3>Message Templates</h3>
        <p style={{ color: '#64748b', fontSize: 13, marginBottom: 16 }}>
          Variables: {'{customer_name}'}, {'{invoice_number}'}, {'{amount}'}, {'{balance}'}, {'{order_number}'}, {'{delivery_date}'}, {'{phone}'}
        </p>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr><th>Template</th><th>Trigger</th><th>Message Preview</th><th>Active</th><th></th></tr>
            </thead>
            <tbody>
              {templates.map(t => (
                <tr key={t.id}>
                  <td className="name">{t.name}</td>
                  <td><span className="type-badge">{t.trigger}</span></td>
                  <td style={{ maxWidth: 400, fontSize: 12, color: '#475569' }}>{t.body.length > 80 ? t.body.slice(0, 80) + '...' : t.body}</td>
                  <td className="center">
                    <button onClick={() => toggleTemplate(t.id)}
                      style={{
                        padding: '4px 12px', borderRadius: 12, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        background: t.is_active ? '#dcfce7' : '#fee2e2',
                        color: t.is_active ? '#166534' : '#991b1b',
                      }}>
                      {t.is_active ? 'ON' : 'OFF'}
                    </button>
                  </td>
                  <td>
                    <button className="edit-btn" onClick={() => setEditingTemplate({ ...t })}>Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Template Editor Modal */}
      {editingTemplate && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 32, width: 560, maxWidth: '90vw', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
            <h3 style={{ marginBottom: 16 }}>Edit Template: {editingTemplate.name}</h3>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label>Template Name</label>
              <input value={editingTemplate.name}
                onChange={e => setEditingTemplate(prev => ({ ...prev, name: e.target.value }))} />
            </div>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label>Trigger Event</label>
              <select value={editingTemplate.trigger}
                onChange={e => setEditingTemplate(prev => ({ ...prev, trigger: e.target.value }))}>
                <option value="sales_invoice_created">Invoice Created</option>
                <option value="payment_received">Payment Received</option>
                <option value="invoice_overdue">Invoice Overdue</option>
                <option value="order_shipped">Order Shipped</option>
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label>Message Body</label>
              <textarea value={editingTemplate.body} rows={4}
                onChange={e => setEditingTemplate(prev => ({ ...prev, body: e.target.value }))}
                style={{ fontFamily: 'monospace', fontSize: 13 }} />
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>
              Character count: {editingTemplate.body.length} / 160 (SMS limit)
              {editingTemplate.body.length > 160 && <span style={{ color: '#dc2626', marginLeft: 8 }}>Exceeds SMS limit — will be split into multiple messages</span>}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="action-btn" onClick={() => setEditingTemplate(null)}
                style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' }}>Cancel</button>
              <button className="action-btn primary" onClick={saveTemplate}>Save Template</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MessagingSettings;
