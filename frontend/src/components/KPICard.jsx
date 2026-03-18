/**
 * KPICard — single metric tile
 * Props: title, value, unit, icon, accent ("gold"|"green"|"blue"|"red")
 */
import React from 'react';

const KPICard = ({ title, value, unit = '', icon, accent = 'green', onClick }) => {
  const formatValue = (val) => {
    if (val === null || val === undefined) return '—';
    if (typeof val !== 'number') return val;
    if (val >= 1_000_000) return (val / 1_000_000).toFixed(2) + 'M';
    if (val >= 1000)      return val.toLocaleString('en-US', { maximumFractionDigits: 0 });
    return val.toLocaleString('en-US', { maximumFractionDigits: 2 });
  };

  return (
    <div className="kpi-card" data-accent={accent} onClick={onClick}
      style={onClick ? { cursor: 'pointer' } : undefined}>
      <div className="kpi-card-header">
        <h3 className="kpi-card-title">{title}</h3>
        {icon && <span className="kpi-card-icon">{icon}</span>}
      </div>
      <div className="kpi-card-value-row">
        <span className="kpi-card-value">{formatValue(value)}</span>
        {unit && <span className="kpi-card-unit">{unit}</span>}
      </div>
    </div>
  );
};

export default KPICard;