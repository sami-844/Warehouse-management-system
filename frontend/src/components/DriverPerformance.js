import React, { useState, useEffect } from 'react';
import { vanSalesAPI } from '../services/api';
import { Trophy, TrendingUp, DollarSign, Star } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function DriverPerformance() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const now = new Date();
  const [fromDate, setFromDate] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`);
  const [toDate, setToDate] = useState(now.toISOString().slice(0, 10));

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await vanSalesAPI.performance({ from_date: fromDate, to_date: toDate });
        setData(res);
      } catch { setData(null); }
      setLoading(false);
    })();
  }, [fromDate, toDate]);

  const cardStyle = { background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', padding: 20, marginBottom: 20 };
  const inputStyle = { padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13 };

  const awardCard = (title, name, icon, borderColor) => (
    <div style={{ ...cardStyle, flex: 1, minWidth: 200, borderTop: `3px solid ${borderColor}`, textAlign: 'center' }}>
      <div style={{ marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#1a2332', marginTop: 4 }}>{name || '--'}</div>
    </div>
  );

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Trophy size={28} color="#D4A017" />
        <h1 style={{ margin: 0, fontSize: 24, color: '#1a2332' }}>Driver Performance</h1>
      </div>

      {/* Date Filter */}
      <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4, color: '#64748b' }}>From</label>
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4, color: '#64748b' }}>To</label>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} style={inputStyle} />
        </div>
        <span style={{ fontSize: 13, color: '#64748b', paddingTop: 18 }}>
          {data ? `${data.drivers?.length || 0} driver(s)` : ''}
        </span>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#94a3b8' }}>Loading performance data...</div>
      ) : !data || !data.drivers || data.drivers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#94a3b8' }}>No driver data found for this period</div>
      ) : (
        <>
          {/* Awards Row */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
            {awardCard('Top Seller', data.top_seller, <DollarSign size={28} color="#D4A017" />, '#D4A017')}
            {awardCard('Best Margin', data.highest_margin, <TrendingUp size={28} color="#16a34a" />, '#16a34a')}
            {awardCard('Best Collector', data.best_collector, <Star size={28} color="#2563eb" />, '#2563eb')}
          </div>

          {/* Comparison Table */}
          <div style={cardStyle}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, color: '#1a2332' }}>Driver Comparison</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#1A3A5C', color: 'white' }}>
                    <th style={{ padding: '10px 8px', textAlign: 'center', width: 40 }}>#</th>
                    <th style={{ padding: '10px 8px', textAlign: 'left' }}>Driver</th>
                    <th style={{ padding: '10px 8px', textAlign: 'left' }}>Route Area</th>
                    <th style={{ padding: '10px 8px', textAlign: 'center' }}>Days</th>
                    <th style={{ padding: '10px 8px', textAlign: 'right' }}>Total Sales</th>
                    <th style={{ padding: '10px 8px', textAlign: 'right' }}>Total Profit</th>
                    <th style={{ padding: '10px 8px', textAlign: 'right' }}>Avg Margin %</th>
                    <th style={{ padding: '10px 8px', textAlign: 'right' }}>Avg Daily</th>
                    <th style={{ padding: '10px 8px', textAlign: 'right' }}>Collection %</th>
                    <th style={{ padding: '10px 8px', textAlign: 'right' }}>Running Due</th>
                    <th style={{ padding: '10px 8px', textAlign: 'right' }}>Expenses</th>
                    <th style={{ padding: '10px 8px', textAlign: 'right' }}>Best Day</th>
                  </tr>
                </thead>
                <tbody>
                  {data.drivers.map((d, i) => (
                    <tr key={d.driver_id} style={{ borderBottom: '1px solid #e2e8f0', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <td style={{ padding: '8px', textAlign: 'center', fontWeight: 700, color: i === 0 ? '#D4A017' : '#64748b' }}>
                        {i + 1}
                      </td>
                      <td style={{ padding: '8px', fontWeight: 600, color: '#1a2332' }}>{d.driver_name}</td>
                      <td style={{ padding: '8px', color: '#64748b' }}>{d.route_area || '--'}</td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>{d.sheet_count}</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600, color: '#1A7B5B' }}>{d.total_sales.toFixed(3)}</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600, color: d.total_profit > 0 ? '#16a34a' : '#dc2626' }}>{d.total_profit.toFixed(3)}</td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>{d.avg_margin_pct.toFixed(1)}%</td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>{d.avg_daily_sales.toFixed(3)}</td>
                      <td style={{ padding: '8px', textAlign: 'right', color: d.collection_rate_pct >= 80 ? '#16a34a' : '#d97706' }}>{d.collection_rate_pct.toFixed(1)}%</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600, color: d.running_due > 50 ? '#dc2626' : '#1a2332' }}>{d.running_due.toFixed(3)}</td>
                      <td style={{ padding: '8px', textAlign: 'right', color: '#64748b' }}>{d.total_expenses.toFixed(3)}</td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>
                        <div style={{ fontWeight: 600 }}>{d.best_day_sales.toFixed(3)}</div>
                        {d.best_day_date && <div style={{ fontSize: 10, color: '#94a3b8' }}>{d.best_day_date}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bar Chart */}
          {data.drivers.length > 0 && (
            <div style={cardStyle}>
              <h3 style={{ margin: '0 0 16px', fontSize: 16, color: '#1a2332' }}>Sales vs Profit vs Collected</h3>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={data.drivers.map(d => ({
                  name: d.driver_name.split(' ')[0],
                  Sales: d.total_sales,
                  Profit: d.total_profit,
                  Collected: d.total_collected,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis fontSize={11} />
                  <Tooltip formatter={(v) => `${Number(v).toFixed(3)} OMR`} />
                  <Legend />
                  <Bar dataKey="Sales" fill="#1A7B5B" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Profit" fill="#D4A017" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Collected" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  );
}
