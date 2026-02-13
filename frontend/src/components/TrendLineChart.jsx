/**
 * TrendLineChart — daily sales trend over the selected period
 * Props: data [{date, sales, order_count}], period (number of days)
 */
import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const TrendLineChart = ({ data = [], period }) => {
  /* format X-axis label based on period length */
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    if (period <= 14) return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (period <= 90) return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return d.toLocaleDateString('en-US', { month: 'short' });
  };

  /* pick tick interval so labels don't crowd */
  const tickInterval = useMemo(() => {
    if (data.length <= 7)  return 0;
    if (data.length <= 30) return 4;
    if (data.length <= 90) return 6;
    return 29;
  }, [data.length]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const d = new Date(label + 'T00:00:00');
      const fmtDate = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      return (
        <div className="chart-tooltip">
          <p className="chart-tooltip-name">{fmtDate}</p>
          {payload.map((entry, i) => (
            <p key={i} className="chart-tooltip-value" style={{ color: entry.color }}>
              {entry.name}: {Number(entry.value).toLocaleString('en-US', { minimumFractionDigits: 2 })} OMR
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (!data || data.length === 0) {
    return (
      <div className="chart-card">
        <div className="chart-header">
          <h3 className="chart-title">Sales Trend</h3>
          <span className="chart-subtitle">Last {period} days</span>
        </div>
        <div className="chart-empty">No trend data available for this period</div>
      </div>
    );
  }

  return (
    <div className="chart-card">
      <div className="chart-header">
        <h3 className="chart-title">Sales Trend</h3>
        <span className="chart-subtitle">Last {period} days</span>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data} margin={{ top: 8, right: 20, left: 10, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={{ fontSize: 11, fill: '#6B7280', fontFamily: 'Outfit, system-ui, sans-serif' }}
            axisLine={{ stroke: '#D1D5DB' }}
            tickLine={false}
            interval={tickInterval}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#6B7280', fontFamily: 'Outfit, system-ui, sans-serif' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            iconType="circle" iconSize={10}
            wrapperStyle={{ fontSize: '0.8rem', fontFamily: 'Outfit, system-ui, sans-serif', paddingTop: 8 }}
          />
          <Line
            type="monotone" dataKey="sales" name="Sales"
            stroke="#1A7B5B" strokeWidth={2.5}
            dot={data.length <= 30 ? { r: 3, fill: '#1A7B5B', stroke: '#fff', strokeWidth: 2 } : false}
            activeDot={{ r: 5, fill: '#1A7B5B', stroke: '#fff', strokeWidth: 2 }}
          />
          <Line
            type="monotone" dataKey="cogs" name="COGS"
            stroke="#D4A017" strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: '#D4A017', stroke: '#fff', strokeWidth: 2 }}
            strokeDasharray="5 3"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default TrendLineChart;