import React, { useState, useEffect } from 'react';
import { currencyAPI } from '../services/api';
import './AdminPanel.css';
import { Globe } from 'lucide-react';

function MultiCurrencyDashboard() {
  const [data, setData] = useState(null);
  const [currencies, setCurrencies] = useState(['OMR', 'USD']);
  const [loading, setLoading] = useState(true);
  const [editingRates, setEditingRates] = useState(false);
  const [rates, setRates] = useState({});
  const [error, setError] = useState('');

  const loadDashboard = () => {
    setLoading(true);
    currencyAPI.dashboard(currencies.join(','))
      .then(d => { setData(d); setRates(d.available_rates || {}); setLoading(false); })
      .catch(() => { setError('Failed to load'); setLoading(false); });
  };

  useEffect(() => { loadDashboard(); }, [currencies]);

  const toggleCurrency = (curr) => {
    setCurrencies(prev => {
      if (prev.includes(curr)) return prev.filter(c => c !== curr);
      return [...prev, curr];
    });
  };

  const saveRate = (curr, rate) => {
    currencyAPI.updateRate(curr, parseFloat(rate))
      .then(() => loadDashboard())
      .catch(() => setError(`Failed to update ${curr} rate`));
  };

  const fmt = (n, curr) => {
    const num = Number(n) || 0;
    const decimals = curr === 'OMR' ? 3 : 2;
    return num.toLocaleString('en', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };

  const availableCurrencies = ['OMR', 'USD', 'EUR', 'GBP', 'INR', 'AED', 'SAR'];

  const metrics = [
    { key: 'total_sales',      label: 'Total Sales',      color: '#0d7a3e' },
    { key: 'total_purchases',  label: 'Total Purchases',  color: '#e67e22' },
    { key: 'gross_profit',     label: 'Gross Profit',     color: '#27ae60' },
    { key: 'total_receivables',label: 'Receivables',      color: '#3498db' },
    { key: 'total_payables',   label: 'Payables',         color: '#e74c3c' },
    { key: 'net_receivables',  label: 'Net Position',     color: '#8e44ad' },
    { key: 'stock_value',      label: 'Stock Value',      color: '#2c3e50' },
    { key: 'open_credit_notes',label: 'Open Credits',     color: '#7f8c8d' },
  ];

  if (loading) return <div className="admin-container"><div className="loading-state">Loading multi-currency data...</div></div>;

  return (
    <div className="admin-container">
      <div className="page-header">
        <div className="header-content">
          <div className="header-icon finance"><Globe size={20} /></div>
          <div><h1>Multi-Currency Dashboard</h1><p>Financial overview in multiple currencies (base: OMR)</p></div>
        </div>
      </div>

      {error && <div className="message error">{error}</div>}

      {/* Currency Selector */}
      <div className="filter-bar" style={{ marginBottom: 'var(--ds-sp-5)' }}>
        <span style={{ fontSize: 'var(--ds-text-sm)', fontWeight: 600, color: 'var(--ds-text-sub)' }}>Show:</span>
        {availableCurrencies.map(curr => {
          const active = currencies.includes(curr);
          return (
            <button key={curr} onClick={() => toggleCurrency(curr)} style={{
              padding: '5px 14px', borderRadius: 20,
              border: active ? '2px solid var(--ds-green)' : '1px solid var(--ds-border-mid)',
              background: active ? 'var(--ds-green-tint)' : 'var(--ds-surface)',
              color: active ? 'var(--ds-green)' : 'var(--ds-text-muted)',
              fontWeight: 600, fontSize: 'var(--ds-text-xs)', cursor: 'pointer',
              fontFamily: 'var(--ds-font-ui)',
            }}>
              {curr}{active ? ' ✓' : ''}
            </button>
          );
        })}
        <button onClick={() => setEditingRates(!editingRates)} className="action-btn" style={{ marginLeft: 'auto' }}>
          {editingRates ? 'Hide Rates' : 'Edit Rates'}
        </button>
      </div>

      {/* Rate Editor */}
      {editingRates && (
        <div className="form-card" style={{ marginBottom: 'var(--ds-sp-5)' }}>
          <p style={{ fontSize: 'var(--ds-text-xs)', color: 'var(--ds-text-muted)', margin: '0 0 var(--ds-sp-3)' }}>
            Exchange rates: 1 OMR = X currency
          </p>
          <div className="export-grid">
            {availableCurrencies.filter(c => c !== 'OMR').map(curr => (
              <div key={curr} style={{ display: 'flex', alignItems: 'center', gap: 'var(--ds-sp-2)' }}>
                <span style={{ fontWeight: 700, fontSize: 'var(--ds-text-xs)', color: 'var(--ds-text-sub)', minWidth: 30, fontFamily: 'var(--ds-font-mono)' }}>{curr}</span>
                <input type="number" step="0.001" value={rates[curr] || ''}
                  onChange={e => setRates(prev => ({ ...prev, [curr]: e.target.value }))}
                  style={{ flex: 1, padding: '5px 8px', borderRadius: 'var(--ds-r-sm)', border: '1px solid var(--ds-border-mid)', fontSize: 'var(--ds-text-sm)', fontFamily: 'var(--ds-font-mono)' }} />
                <button onClick={() => saveRate(curr, rates[curr])} className="action-btn primary" style={{ padding: '4px 10px', fontSize: 'var(--ds-text-xs)' }}>
                  Save
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Financial Metrics Grid */}
      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 'var(--ds-sp-4)' }}>
          {metrics.map(metric => (
            <div key={metric.key} className="section-card" style={{ borderTop: `3px solid ${metric.color}`, padding: 'var(--ds-sp-5)' }}>
              <div style={{ marginBottom: 'var(--ds-sp-3)' }}>
                <span style={{ fontSize: 'var(--ds-text-sm)', fontWeight: 700, color: 'var(--ds-text-sub)', fontFamily: 'var(--ds-font-ui)' }}>{metric.label}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-sp-2)' }}>
                {currencies.map(curr => {
                  const val = data.currencies?.[curr]?.[metric.key];
                  const isBase = curr === 'OMR';
                  return (
                    <div key={curr} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '6px 10px', borderRadius: 'var(--ds-r-sm)',
                      background: isBase ? 'var(--ds-green-tint)' : 'var(--ds-surface-raised)',
                    }}>
                      <span style={{
                        fontSize: 'var(--ds-text-xs)', fontWeight: 700,
                        color: isBase ? 'var(--ds-green)' : 'var(--ds-text-muted)',
                        textTransform: 'uppercase', fontFamily: 'var(--ds-font-ui)',
                      }}>
                        {curr}
                      </span>
                      <span style={{
                        fontSize: isBase ? 'var(--ds-text-lg)' : 'var(--ds-text-sm)',
                        fontWeight: isBase ? 800 : 600,
                        color: val < 0 ? 'var(--ds-danger)' : metric.color,
                        fontFamily: 'var(--ds-font-mono)',
                      }}>
                        {fmt(val, curr)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Rates Footer */}
      {data && (
        <div style={{ marginTop: 'var(--ds-sp-6)', padding: 'var(--ds-sp-3) var(--ds-sp-4)', background: 'var(--ds-surface-raised)', borderRadius: 'var(--ds-r-sm)', border: '1px solid var(--ds-border)', fontSize: 'var(--ds-text-xs)', color: 'var(--ds-text-muted)', fontFamily: 'var(--ds-font-ui)' }}>
          <strong style={{ color: 'var(--ds-text-sub)' }}>Current Rates (1 OMR):</strong>{' '}
          {Object.entries(data.available_rates || {}).filter(([k]) => k !== 'OMR').map(([curr, rate]) => (
            <span key={curr} style={{ marginRight: 'var(--ds-sp-4)', fontFamily: 'var(--ds-font-mono)' }}>{curr}: {rate}</span>
          ))}
        </div>
      )}
    </div>
  );
}

export default MultiCurrencyDashboard;
