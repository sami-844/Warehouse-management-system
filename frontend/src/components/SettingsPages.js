// SettingsPages.js — WMS Configuration: Taxes, Payment Types, Units, Expense Categories
import React, { useState } from 'react';
import { Settings } from 'lucide-react';
import './AdminPanel.css';

// ─── Exported helpers for use in other components ─────────────────────────────
export const getWMSTaxes = () =>
  JSON.parse(localStorage.getItem('wms_taxes') || 'null') ||
  [{ id: 1, name: 'VAT 5%', rate: 5 }, { id: 2, name: 'Zero Rate', rate: 0 }, { id: 3, name: 'Exempt', rate: 0 }];

export const getWMSUnits = () =>
  JSON.parse(localStorage.getItem('wms_units') || 'null') ||
  ['PCS', 'KG', 'GM', 'Liter', 'ML', 'Carton', 'Box', 'Dozen', 'Bag'];

export const getWMSPaymentTypes = () =>
  JSON.parse(localStorage.getItem('wms_payment_types') || 'null') ||
  ['Cash', 'Bank Transfer', 'Credit', 'COD', 'Cheque'];

export const getWMSExpenseCategories = () =>
  JSON.parse(localStorage.getItem('wms_expense_categories') || 'null') ||
  ['Transport', 'Fuel', 'Office Supplies', 'Utilities', 'Rent', 'Salary', 'Maintenance', 'Other'];

// ─── Defaults ─────────────────────────────────────────────────────────────────
const DEFAULT_TAXES    = [{ id: 1, name: 'VAT 5%', rate: 5 }, { id: 2, name: 'Zero Rate', rate: 0 }, { id: 3, name: 'Exempt', rate: 0 }];
const DEFAULT_PAYMENTS = ['Cash', 'Bank Transfer', 'Credit', 'COD', 'Cheque'];
const DEFAULT_UNITS    = ['PCS', 'KG', 'GM', 'Liter', 'ML', 'Carton', 'Box', 'Dozen', 'Bag'];
const DEFAULT_EXPENSES = ['Transport', 'Fuel', 'Office Supplies', 'Utilities', 'Rent', 'Salary', 'Maintenance', 'Other'];

// ─── Simple string-list sub-component ─────────────────────────────────────────
function StringListTab({ storageKey, defaultList, label, placeholder }) {
  const [items, setItems] = useState(() =>
    JSON.parse(localStorage.getItem(storageKey) || 'null') || defaultList
  );
  const [newItem, setNewItem] = useState('');
  const [message, setMessage] = useState({ text: '', type: '' });

  const save = (updated) => {
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setItems(updated);
  };

  const flash = (text, type) => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 2500);
  };

  const handleAdd = () => {
    const trimmed = newItem.trim();
    if (!trimmed) return;
    if (items.includes(trimmed)) {
      flash('That entry already exists.', 'error');
      return;
    }
    save([...items, trimmed]);
    setNewItem('');
    flash(`"${trimmed}" added.`, 'success');
  };

  const handleDelete = (item) => {
    if (!window.confirm(`Remove "${item}"?`)) return;
    save(items.filter(i => i !== item));
    flash(`"${item}" removed.`, 'success');
  };

  const handleReset = () => {
    if (!window.confirm('Reset to factory defaults?')) return;
    save(defaultList);
    flash('Reset to defaults.', 'success');
  };

  return (
    <div>
      {message.text && (
        <div className={`message ${message.type}`}>{message.text}</div>
      )}

      {/* Add row */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <input
          className="search-input"
          style={{ flex: 1, minWidth: 0 }}
          placeholder={placeholder}
          value={newItem}
          onChange={e => setNewItem(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
        />
        <button className="action-btn primary" onClick={handleAdd}>+ Add</button>
        <button className="action-btn" onClick={handleReset}
          style={{ color: 'var(--ds-text-muted)', fontSize: 'var(--ds-text-xs)' }}>
          Reset Defaults
        </button>
      </div>

      {/* List */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>{label}</th>
              <th style={{ width: 80, textAlign: 'center' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan="3" className="no-data">No entries. Add one above.</td></tr>
            ) : (
              items.map((item, idx) => (
                <tr key={idx}>
                  <td style={{ width: 40, color: 'var(--ds-text-muted)', fontFamily: 'var(--ds-font-mono)', fontSize: 'var(--ds-text-xs)' }}>
                    {idx + 1}
                  </td>
                  <td className="name">{item}</td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      onClick={() => handleDelete(item)}
                      style={{
                        background: 'var(--ds-danger-bg)',
                        color: 'var(--ds-danger)',
                        border: '1px solid var(--ds-danger-border)',
                        borderRadius: 'var(--ds-r-sm)',
                        padding: '3px 10px',
                        cursor: 'pointer',
                        fontSize: 'var(--ds-text-xs)',
                        fontWeight: 700,
                      }}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p style={{ color: 'var(--ds-text-muted)', fontSize: 'var(--ds-text-xs)', marginTop: 8 }}>
        {items.length} {items.length === 1 ? 'entry' : 'entries'} stored locally
      </p>
    </div>
  );
}

// ─── Tax Rates Tab ─────────────────────────────────────────────────────────────
function TaxRatesTab() {
  const [taxes, setTaxes] = useState(() =>
    JSON.parse(localStorage.getItem('wms_taxes') || 'null') || DEFAULT_TAXES
  );
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: '', rate: '' });
  const [message, setMessage] = useState({ text: '', type: '' });

  const flash = (text, type) => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 2500);
  };

  const save = (updated) => {
    localStorage.setItem('wms_taxes', JSON.stringify(updated));
    setTaxes(updated);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const name = form.name.trim();
    const rate = parseFloat(form.rate);
    if (!name) { flash('Name is required.', 'error'); return; }
    if (isNaN(rate) || rate < 0 || rate > 100) { flash('Rate must be 0–100.', 'error'); return; }

    if (editingId !== null) {
      save(taxes.map(t => t.id === editingId ? { ...t, name, rate } : t));
      flash('Tax rate updated.', 'success');
    } else {
      const newId = taxes.length > 0 ? Math.max(...taxes.map(t => t.id)) + 1 : 1;
      save([...taxes, { id: newId, name, rate }]);
      flash('Tax rate added.', 'success');
    }
    setForm({ name: '', rate: '' });
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (tax) => {
    setForm({ name: tax.name, rate: String(tax.rate) });
    setEditingId(tax.id);
    setShowForm(true);
  };

  const handleDelete = (tax) => {
    if (!window.confirm(`Delete "${tax.name}"?`)) return;
    save(taxes.filter(t => t.id !== tax.id));
    flash(`"${tax.name}" deleted.`, 'success');
  };

  const handleReset = () => {
    if (!window.confirm('Reset tax rates to factory defaults?')) return;
    save(DEFAULT_TAXES);
    flash('Reset to defaults.', 'success');
  };

  const cancelForm = () => {
    setForm({ name: '', rate: '' });
    setEditingId(null);
    setShowForm(false);
  };

  return (
    <div>
      {message.text && (
        <div className={`message ${message.type}`}>{message.text}</div>
      )}

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button className="action-btn primary" onClick={() => { cancelForm(); setShowForm(!showForm); }}>
          {showForm && editingId === null ? 'Cancel' : '+ Add Tax Rate'}
        </button>
        <button className="action-btn" onClick={handleReset}
          style={{ color: 'var(--ds-text-muted)', fontSize: 'var(--ds-text-xs)' }}>
          Reset Defaults
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="form-card" style={{ marginBottom: 20 }}>
          <h3>{editingId !== null ? 'Edit Tax Rate' : 'New Tax Rate'}</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-row-2">
              <div className="form-group">
                <label>Name *</label>
                <input
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. VAT 5%"
                  required
                />
              </div>
              <div className="form-group">
                <label>Rate (%) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={form.rate}
                  onChange={e => setForm(p => ({ ...p, rate: e.target.value }))}
                  placeholder="5.00"
                  required
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button type="submit" className="action-btn primary">
                {editingId !== null ? 'Update' : 'Add Tax Rate'}
              </button>
              <button type="button" className="cancel-btn" onClick={cancelForm}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th style={{ textAlign: 'right' }}>Rate (%)</th>
              <th style={{ width: 120, textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {taxes.length === 0 ? (
              <tr><td colSpan="3" className="no-data">No tax rates defined.</td></tr>
            ) : (
              taxes.map(tax => (
                <tr key={tax.id}>
                  <td className="name">{tax.name}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--ds-font-mono)', fontWeight: 700 }}>
                    {Number(tax.rate).toFixed(2)}%
                  </td>
                  <td>
                    <div className="action-cell" style={{ justifyContent: 'center' }}>
                      <button
                        onClick={() => handleEdit(tax)}
                        style={{
                          background: 'var(--ds-info-bg)',
                          color: 'var(--ds-info)',
                          border: '1px solid var(--ds-info-border)',
                          borderRadius: 'var(--ds-r-sm)',
                          padding: '3px 10px',
                          cursor: 'pointer',
                          fontSize: 'var(--ds-text-xs)',
                          fontWeight: 700,
                        }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(tax)}
                        style={{
                          background: 'var(--ds-danger-bg)',
                          color: 'var(--ds-danger)',
                          border: '1px solid var(--ds-danger-border)',
                          borderRadius: 'var(--ds-r-sm)',
                          padding: '3px 10px',
                          cursor: 'pointer',
                          fontSize: 'var(--ds-text-xs)',
                          fontWeight: 700,
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p style={{ color: 'var(--ds-text-muted)', fontSize: 'var(--ds-text-xs)', marginTop: 8 }}>
        {taxes.length} tax {taxes.length === 1 ? 'rate' : 'rates'} configured
      </p>
    </div>
  );
}

// ─── Main SettingsPages Component ─────────────────────────────────────────────
const TABS = ['Tax Rates', 'Payment Types', 'Units of Measure', 'Expense Categories'];

function SettingsPages() {
  const [activeTab, setActiveTab] = useState('Tax Rates');

  return (
    <div className="admin-container">
      {/* Page Header */}
      <div className="page-header">
        <div className="header-content">
          <div className="header-icon settings">
            <Settings size={20} />
          </div>
          <div>
            <h1>Settings</h1>
            <p>Configure taxes, payment methods, units and expense categories</p>
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="tab-bar">
        {TABS.map(tab => (
          <button
            key={tab}
            className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'Tax Rates' && (
          <>
            <h3>Tax Rates</h3>
            <p style={{ color: 'var(--ds-text-muted)', fontSize: 'var(--ds-text-sm)', marginBottom: 20 }}>
              Define VAT rates applied to products and sales orders.
            </p>
            <TaxRatesTab />
          </>
        )}

        {activeTab === 'Payment Types' && (
          <>
            <h3>Payment Types</h3>
            <p style={{ color: 'var(--ds-text-muted)', fontSize: 'var(--ds-text-sm)', marginBottom: 20 }}>
              Available payment methods for invoices and purchases.
            </p>
            <StringListTab
              storageKey="wms_payment_types"
              defaultList={DEFAULT_PAYMENTS}
              label="Payment Method"
              placeholder="e.g. Cheque"
            />
          </>
        )}

        {activeTab === 'Units of Measure' && (
          <>
            <h3>Units of Measure</h3>
            <p style={{ color: 'var(--ds-text-muted)', fontSize: 'var(--ds-text-sm)', marginBottom: 20 }}>
              Unit options available when creating or editing products.
            </p>
            <StringListTab
              storageKey="wms_units"
              defaultList={DEFAULT_UNITS}
              label="Unit"
              placeholder="e.g. Pallet"
            />
          </>
        )}

        {activeTab === 'Expense Categories' && (
          <>
            <h3>Expense Categories</h3>
            <p style={{ color: 'var(--ds-text-muted)', fontSize: 'var(--ds-text-sm)', marginBottom: 20 }}>
              Categories used when recording business expenses.
            </p>
            <StringListTab
              storageKey="wms_expense_categories"
              defaultList={DEFAULT_EXPENSES}
              label="Category"
              placeholder="e.g. Insurance"
            />
          </>
        )}
      </div>
    </div>
  );
}

export default SettingsPages;
