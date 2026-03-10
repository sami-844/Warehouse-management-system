import LoadingSpinner from './LoadingSpinner';
import React, { useState, useEffect } from 'react';
import { adminAPI } from '../services/api';
import './AdminPanel.css';
import { Settings } from 'lucide-react';

function CompanySettings() {
  const [tab, setTab] = useState('company');
  const [settings, setSettings] = useState({}); // eslint-disable-line no-unused-vars
  const [activityLog, setActivityLog] = useState([]);
  const [backups, setBackups] = useState([]);
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [form, setForm] = useState({});
  const [selectedFont, setSelectedFont] = useState(localStorage.getItem('app_font') || "'Figtree', sans-serif");

  useEffect(() => { loadSettings(); loadActivity(); loadBackups(); loadTables(); }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await adminAPI.getSettings();
      setSettings(data);
      const formData = {};
      Object.entries(data).forEach(([k, v]) => { formData[k] = v.value; });
      setForm(formData);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  };
  const loadActivity = async () => { try { setActivityLog(await adminAPI.getActivityLog({ limit: 50 })); } catch(e) {} };
  const loadBackups = async () => { try { const data = await adminAPI.listBackups(); setBackups(data.backups || []); } catch(e) {} };
  const loadTables = async () => { try { const data = await adminAPI.exportableList(); setTables(data.tables || []); } catch(e) {} };

  const saveSettings = async () => {
    try {
      await adminAPI.updateSettingsBulk(form);
      setMessage({ text: 'Settings saved!', type: 'success' });
      loadSettings();
    } catch(e) { setMessage({ text: `Error: ${e.response?.data?.detail || e.message}`, type: 'error' }); }
  };

  const createBackup = async () => {
    try {
      const result = await adminAPI.createBackup();
      setMessage({ text: `Backup created! (${result.size_mb} MB)`, type: 'success' });
      loadBackups();
    } catch(e) { setMessage({ text: `Error: ${e.response?.data?.detail || e.message}`, type: 'error' }); }
  };

  const exportCSV = (tableName) => {
    const token = localStorage.getItem('token');
    const url = `/api/admin/export/${tableName}`;
    // Open in new window with auth header workaround
    fetch(url, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.blob())
      .then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${tableName}_${new Date().toISOString().slice(0,10)}.csv`;
        a.click();
      })
      .catch(err => setMessage({ text: `Export failed: ${err.message}`, type: 'error' }));
  };

  return (
    <div className="admin-container">
      <div className="page-header"><div className="header-content"><div className="header-icon settings"><Settings size={20} /></div><div><h1>Settings & Admin</h1><p>Company configuration and maintenance</p></div></div></div>

      {message.text && <div className={`message ${message.type}`}>{message.text}</div>}

      <div className="tab-bar">
        <button className={`tab-btn ${tab === 'company' ? 'active' : ''}`} onClick={() => setTab('company')}>Company</button>
        <button className={`tab-btn ${tab === 'system' ? 'active' : ''}`} onClick={() => setTab('system')}>System</button>
        <button className={`tab-btn ${tab === 'appearance' ? 'active' : ''}`} onClick={() => setTab('appearance')}>Appearance</button>
        <button className={`tab-btn ${tab === 'backup' ? 'active' : ''}`} onClick={() => setTab('backup')}>Backup</button>
        <button className={`tab-btn ${tab === 'export' ? 'active' : ''}`} onClick={() => setTab('export')}>Export</button>
        <button className={`tab-btn ${tab === 'activity' ? 'active' : ''}`} onClick={() => setTab('activity')}>Activity Log</button>
      </div>

      {/* Company Tab */}
      {tab === 'company' && (
        <div className="tab-content">
          <h3>Company Information</h3>
          {loading ? <LoadingSpinner /> : (
            <div className="settings-form">
              <div className="form-row-2">
                <div className="form-group"><label>Company Name</label>
                  <input value={form.company_name || ''} onChange={e => setForm(p => ({...p, company_name: e.target.value}))} /></div>
                <div className="form-group"><label>Commercial Registration</label>
                  <input value={form.company_cr || ''} onChange={e => setForm(p => ({...p, company_cr: e.target.value}))} placeholder="CR Number" /></div>
              </div>
              <div className="form-group"><label>Address</label>
                <textarea value={form.company_address || ''} onChange={e => setForm(p => ({...p, company_address: e.target.value}))} rows="2" /></div>
              <div className="form-row-2">
                <div className="form-group"><label>Phone</label>
                  <input value={form.company_phone || ''} onChange={e => setForm(p => ({...p, company_phone: e.target.value}))} placeholder="+968 ..." /></div>
                <div className="form-group"><label>Email</label>
                  <input value={form.company_email || ''} onChange={e => setForm(p => ({...p, company_email: e.target.value}))} placeholder="info@akmomaiza.com" /></div>
              </div>
              <button className="submit-btn" onClick={saveSettings}>Save Company Info</button>
            </div>
          )}
        </div>
      )}

      {/* System Tab */}
      {tab === 'system' && (
        <div className="tab-content">
          <h3>System Settings</h3>
          <div className="settings-form">
            <div className="form-row-3">
              <div className="form-group"><label>VAT Rate (%)</label>
                <input type="number" step="0.1" value={form.tax_rate || ''} onChange={e => setForm(p => ({...p, tax_rate: e.target.value}))} /></div>
              <div className="form-group"><label>Currency</label>
                <select value={form.currency || 'OMR'} onChange={e => setForm(p => ({...p, currency: e.target.value}))}>
                  <option value="OMR">OMR - Omani Rial</option><option value="USD">USD - US Dollar</option><option value="AED">AED - UAE Dirham</option>
                </select></div>
              <div className="form-group"><label>Default Payment Terms (days)</label>
                <select value={form.default_payment_terms_days || '30'} onChange={e => setForm(p => ({...p, default_payment_terms_days: e.target.value}))}>
                  <option value="0">Cash on Delivery</option><option value="7">Net 7</option><option value="14">Net 14</option><option value="30">Net 30</option><option value="60">Net 60</option>
                </select></div>
            </div>
            <div className="form-row-3">
              <div className="form-group"><label>Invoice Prefix</label>
                <input value={form.invoice_prefix || ''} onChange={e => setForm(p => ({...p, invoice_prefix: e.target.value}))} /></div>
              <div className="form-group"><label>PO Prefix</label>
                <input value={form.po_prefix || ''} onChange={e => setForm(p => ({...p, po_prefix: e.target.value}))} /></div>
              <div className="form-group"><label>SO Prefix</label>
                <input value={form.so_prefix || ''} onChange={e => setForm(p => ({...p, so_prefix: e.target.value}))} /></div>
            </div>
            <div className="form-row-2">
              <div className="form-group"><label>Low Stock Threshold</label>
                <input type="number" value={form.low_stock_threshold || ''} onChange={e => setForm(p => ({...p, low_stock_threshold: e.target.value}))} /></div>
              <div className="form-group"><label>Expiry Warning (days before)</label>
                <input type="number" value={form.expiry_warning_days || ''} onChange={e => setForm(p => ({...p, expiry_warning_days: e.target.value}))} /></div>
            </div>
            <button className="submit-btn" onClick={saveSettings}>Save System Settings</button>
          </div>
        </div>
      )}

      {/* Appearance Tab */}
      {tab === 'appearance' && (
        <div className="tab-content">
          <h3>App Font</h3>
          <p style={{ color: 'var(--ds-text-muted)', fontSize: 13, marginBottom: 16 }}>
            Choose the font used throughout the entire app. Changes apply immediately after saving.
          </p>
          <div className="settings-form">
            <div className="form-group">
              <label>Select Font Family</label>
              <select value={selectedFont} onChange={e => setSelectedFont(e.target.value)} style={{ maxWidth: 350 }}>
                <option value="'Figtree', sans-serif">Figtree (Current Default)</option>
                <option value="'Inter', sans-serif">Inter (Modern)</option>
                <option value="'Segoe UI', sans-serif">Segoe UI (Windows)</option>
                <option value="'Roboto', sans-serif">Roboto (Google)</option>
                <option value="'Open Sans', sans-serif">Open Sans (Friendly)</option>
                <option value="'Noto Sans', sans-serif">Noto Sans (Arabic support)</option>
                <option value="'Cairo', sans-serif">Cairo (Arabic-friendly)</option>
                <option value="'Tajawal', sans-serif">Tajawal (Arabic)</option>
                <option value="Arial, sans-serif">Arial (Classic)</option>
                <option value="'Times New Roman', serif">Times New Roman (Formal)</option>
              </select>
            </div>
            <div style={{
              marginTop: 12, padding: 16, border: '1px solid var(--ds-border)',
              borderRadius: 8, fontFamily: selectedFont, maxWidth: 450, background: 'var(--ds-surface)',
            }}>
              <strong style={{ fontSize: 18 }}>Preview: AK Al Momaiza WMS</strong>
              <p style={{ margin: '8px 0 0', fontSize: 14, color: 'var(--ds-text-muted)' }}>
                The quick brown fox jumps over the lazy dog — 0123456789 — OMR 5.500
              </p>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--ds-text-sub)' }}>
                ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz
              </p>
            </div>
            <button className="submit-btn" style={{ marginTop: 16 }} onClick={() => {
              document.documentElement.style.setProperty('--font-main', selectedFont);
              document.documentElement.style.fontFamily = selectedFont;
              localStorage.setItem('app_font', selectedFont);
              setMessage({ text: 'Font updated! Applied across the app.', type: 'success' });
            }}>Save Font</button>
          </div>
        </div>
      )}

      {/* Backup Tab */}
      {tab === 'backup' && (
        <div className="tab-content">
          <h3>Database Backup</h3>
          <div className="backup-section">
            <div className="backup-action">
              <p>Create a snapshot of your entire database. Backups are stored in the <code>backend/backups/</code> folder.</p>
              <button className="action-btn primary" onClick={createBackup}>Create Backup Now</button>
            </div>
            <h4 style={{marginTop: 24}}>Previous Backups</h4>
            {backups.length === 0 ? <div className="no-data">No backups yet</div> : (
              <table className="data-table compact">
                <thead><tr><th>Filename</th><th>Date</th><th>Size</th></tr></thead>
                <tbody>{backups.map((b, i) => (
                  <tr key={i}><td className="code">{b.filename}</td><td>{b.date}</td><td>{b.size_mb} MB</td></tr>
                ))}</tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Export Tab */}
      {tab === 'export' && (
        <div className="tab-content">
          <h3>Export Data to CSV</h3>
          <p>Download any table as a CSV file for Excel, Google Sheets, or other tools.</p>
          <div className="export-grid">
            {tables.map(t => (
              <div key={t.table} className="export-card" onClick={() => exportCSV(t.table)}>
                <div className="ec-name">{t.table}</div>
                <div className="ec-rows">{t.rows} rows</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activity Log Tab */}
      {tab === 'activity' && (
        <div className="tab-content">
          <h3>Activity Log</h3>
          <p>Recent actions performed by users in the system.</p>
          {activityLog.length === 0 ? <div className="no-data">No activity logged yet. Actions will appear here as users interact with the system.</div> : (
            <table className="data-table compact">
              <thead><tr><th>Date</th><th>User</th><th>Action</th><th>Entity</th><th>Description</th></tr></thead>
              <tbody>{activityLog.map(l => (
                <tr key={l.id}><td>{l.date ? l.date.slice(0, 19) : '-'}</td><td className="code">{l.username}</td>
                  <td><span className="action-badge">{l.action}</span></td>
                  <td>{l.entity_type || '-'}</td><td>{l.description || '-'}</td></tr>
              ))}</tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
export default CompanySettings;
