import React, { useState, useEffect } from 'react';
import { currencyAPI } from '../services/api';

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
    { key: 'total_sales', label: 'Total Sales', icon: '', color: '#0d7a3e' },
    { key: 'total_purchases', label: 'Total Purchases', icon: '', color: '#e67e22' },
    { key: 'gross_profit', label: 'Gross Profit', icon: '', color: '#27ae60' },
    { key: 'total_receivables', label: 'Receivables', icon: '', color: '#3498db' },
    { key: 'total_payables', label: 'Payables', icon: '', color: '#e74c3c' },
    { key: 'net_receivables', label: 'Net Position', icon: '', color: '#8e44ad' },
    { key: 'stock_value', label: 'Stock Value', icon: '', color: '#2c3e50' },
    { key: 'open_credit_notes', label: 'Open Credits', icon: '', color: '#7f8c8d' },
  ];

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Loading multi-currency data...</div>;

  return (
    <div style={{ padding: '20px 24px', maxWidth: 1100, margin: '0 auto' }}>
      <h2 style={{ color: '#0d7a3e', marginBottom: 4 }}>Multi-Currency Dashboard</h2>
      <p style={{ color: '#666', fontSize: 13, marginBottom: 20 }}>Financial overview in multiple currencies (base: OMR)</p>

      {error && <div style={{ background: '#fce4e4', color: '#c0392b', padding: '10px 16px', borderRadius: 8, marginBottom: 12, fontSize: 13 }}>{error}</div>}

      {/* Currency Selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#555', marginRight: 4 }}>Show:</span>
        {availableCurrencies.map(curr => (
          <button key={curr} onClick={() => toggleCurrency(curr)}
            style={{
              padding: '6px 14px', borderRadius: 20, border: currencies.includes(curr) ? '2px solid #0d7a3e' : '1px solid #ddd',
              background: currencies.includes(curr) ? '#e8f8e8' : '#fff',
              color: currencies.includes(curr) ? '#0d7a3e' : '#888',
              fontWeight: 600, fontSize: 12, cursor: 'pointer',
            }}>
            {curr} {currencies.includes(curr) ? '✓' : ''}
          </button>
        ))}
        <button onClick={() => setEditingRates(!editingRates)}
          style={{ marginLeft: 'auto', background: '#f0f0f0', border: 'none', padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          {editingRates ? 'Hide' : 'Edit'} Rates
        </button>
      </div>

      {/* Rate Editor */}
      {editingRates && (
        <div style={{ background: '#f8f8f8', borderRadius: 10, padding: 16, marginBottom: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
          <div style={{ gridColumn: '1/-1', fontSize: 12, color: '#666', marginBottom: 4 }}>
            Exchange rates: 1 OMR = X currency
          </div>
          {availableCurrencies.filter(c => c !== 'OMR').map(curr => (
            <div key={curr} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontWeight: 600, fontSize: 12, minWidth: 30 }}>{curr}</span>
              <input type="number" step="0.001" value={rates[curr] || ''}
                onChange={e => setRates(prev => ({ ...prev, [curr]: e.target.value }))}
                style={{ flex: 1, padding: '5px 8px', borderRadius: 4, border: '1px solid #ccc', fontSize: 12 }} />
              <button onClick={() => saveRate(curr, rates[curr])}
                style={{ background: '#0d7a3e', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>
                Save
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Financial Metrics Grid */}
      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
          {metrics.map(metric => (
            <div key={metric.key} style={{
              background: '#fff', borderRadius: 12, padding: 18,
              boxShadow: '0 1px 6px rgba(0,0,0,0.06)', borderTop: `3px solid ${metric.color}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 20 }}>{metric.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#555' }}>{metric.label}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {currencies.map(curr => {
                  const val = data.currencies?.[curr]?.[metric.key];
                  const isBase = curr === 'OMR';
                  return (
                    <div key={curr} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '6px 10px', borderRadius: 6,
                      background: isBase ? '#f0f8f4' : '#f8f8f8',
                    }}>
                      <span style={{
                        fontSize: 11, fontWeight: 600, color: isBase ? '#0d7a3e' : '#888',
                        textTransform: 'uppercase',
                      }}>
                        {curr}
                      </span>
                      <span style={{
                        fontSize: isBase ? 18 : 14,
                        fontWeight: isBase ? 700 : 600,
                        color: val < 0 ? '#c0392b' : metric.color,
                        fontFamily: 'monospace',
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
        <div style={{ marginTop: 24, padding: '12px 16px', background: '#f8f8f8', borderRadius: 8, fontSize: 12, color: '#888' }}>
          <strong>Current Rates (1 OMR):</strong>{' '}
          {Object.entries(data.available_rates || {}).filter(([k]) => k !== 'OMR').map(([curr, rate]) => (
            <span key={curr} style={{ marginRight: 12 }}>{curr}: {rate}</span>
          ))}
        </div>
      )}
    </div>
  );
}

export default MultiCurrencyDashboard;
