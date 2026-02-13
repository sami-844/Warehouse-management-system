/**
 * DonutChart — pie with centre total, custom legend
 * Props: title, data [{name, value}], colors []
 */
import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const DonutChart = ({ data, title, colors }) => {
  const total = data.reduce((s, d) => s + (d.value || 0), 0);

  /* centre label */
  const CentreLabel = ({ cx, cy }) => (
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central"
          style={{ fontSize: '1.5rem', fontWeight: 700, fill: '#1C2333', fontFamily: 'Outfit, system-ui, sans-serif' }}>
      {total}
    </text>
  );

  /* tooltip */
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const pct = total ? ((payload[0].value / total) * 100).toFixed(1) : 0;
      return (
        <div className="chart-tooltip">
          <p className="chart-tooltip-name">{payload[0].name}</p>
          <p className="chart-tooltip-value">{payload[0].value} items &middot; {pct}%</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="chart-card">
      <div className="chart-header">
        <h3 className="chart-title">{title}</h3>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%"
               innerRadius={55} outerRadius={85}
               paddingAngle={2} dataKey="value"
               label={CentreLabel} labelLine={false}
               stroke="none">
            {data.map((_, i) => (
              <Cell key={i} fill={colors[i % colors.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      {/* legend */}
      <div className="chart-legend">
        {data.map((item, i) => (
          <div key={i} className="chart-legend-item">
            <div className="chart-legend-left">
              <div className="chart-legend-color" style={{ backgroundColor: colors[i % colors.length] }} />
              <span className="chart-legend-name">{item.name}</span>
            </div>
            <span className="chart-legend-value">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DonutChart;